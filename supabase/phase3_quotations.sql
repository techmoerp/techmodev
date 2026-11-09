-- ============================================================================
-- TECHMO ERP — PHASE 3: QUOTATIONS
-- Run this entire file in the Supabase SQL Editor, after phase1 and phase2.
-- Name this query: "phase3_quotations"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. QUOTATIONS
-- ----------------------------------------------------------------------------
create sequence if not exists public.quotation_no_seq;

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_no text unique,
  customer_id uuid not null references public.customers (id),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  issue_date date not null default current_date,
  valid_until date,
  subtotal numeric(12, 2) not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none', 'percentage', 'fixed')),
  discount_value numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_percent numeric(5, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  terms text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_quotations_updated_at on public.quotations;
create trigger trg_quotations_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

create or replace function public.set_quotation_no()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.quotation_no is null then
    select quotation_prefix into v_prefix from public.company_settings where id = 1;
    new.quotation_no := coalesce(v_prefix, 'QT-') || lpad(nextval('public.quotation_no_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quotations_no on public.quotations;
create trigger trg_quotations_no
  before insert on public.quotations
  for each row execute function public.set_quotation_no();

-- Draft and Sent can be freely edited; anything past that is locked —
-- protects the figures on a quotation the customer has already acted on.
create or replace function public.guard_quotation_editable()
returns trigger
language plpgsql
as $$
begin
  if old.status not in ('draft', 'sent') then
    raise exception 'This quotation is % and can no longer be edited.', old.status;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. QUOTATION ITEMS
-- ----------------------------------------------------------------------------
create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  catalog_item_id uuid references public.catalog_items (id),
  description text not null,
  unit text not null default 'pcs',
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order int not null default 0
);

-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;

drop policy if exists "quotations_select_all_authenticated" on public.quotations;
create policy "quotations_select_all_authenticated"
  on public.quotations for select to authenticated using (true);

drop policy if exists "quotations_insert_manage" on public.quotations;
create policy "quotations_insert_manage"
  on public.quotations for insert to authenticated
  with check (public.has_manage_access('quotations'));

drop policy if exists "quotations_update_manage" on public.quotations;
create policy "quotations_update_manage"
  on public.quotations for update to authenticated
  using (public.has_manage_access('quotations'))
  with check (public.has_manage_access('quotations'));

drop policy if exists "quotations_delete_admin" on public.quotations;
create policy "quotations_delete_admin"
  on public.quotations for delete to authenticated
  using (public.is_admin());

drop policy if exists "quotation_items_select_all_authenticated" on public.quotation_items;
create policy "quotation_items_select_all_authenticated"
  on public.quotation_items for select to authenticated using (true);

-- Items are only ever written through the RPC functions below (security
-- definer), so direct table access for writes is admin-only as a backstop.
drop policy if exists "quotation_items_write_admin" on public.quotation_items;
create policy "quotation_items_write_admin"
  on public.quotation_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. ATOMIC CREATE / UPDATE — compute totals + replace line items in one go
-- ----------------------------------------------------------------------------
-- p_items shape: [{"catalog_item_id": uuid|null, "description": text,
--                   "unit": text, "quantity": numeric, "unit_price": numeric}]
create or replace function public.save_quotation(
  p_id uuid,                 -- null => create new
  p_customer_id uuid,
  p_issue_date date,
  p_valid_until date,
  p_discount_type text,
  p_discount_value numeric,
  p_tax_percent numeric,
  p_notes text,
  p_terms text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_discount_amount numeric(12,2) := 0;
  v_taxable numeric(12,2) := 0;
  v_tax_amount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_status text;
  item jsonb;
  v_sort int := 0;
begin
  if not public.has_manage_access('quotations') then
    raise exception 'You do not have permission to manage quotations.';
  end if;

  if p_id is not null then
    select status into v_status from public.quotations where id = p_id for update;
    if v_status is null then
      raise exception 'Quotation not found.';
    end if;
    if v_status not in ('draft', 'sent') then
      raise exception 'This quotation is % and can no longer be edited.', v_status;
    end if;
    v_id := p_id;
  end if;

  -- Totals from the submitted lines
  select coalesce(sum(round((i->>'quantity')::numeric * (i->>'unit_price')::numeric, 2)), 0)
    into v_subtotal
  from jsonb_array_elements(p_items) i;

  if p_discount_type = 'percentage' then
    v_discount_amount := round(v_subtotal * p_discount_value / 100, 2);
  elsif p_discount_type = 'fixed' then
    v_discount_amount := least(p_discount_value, v_subtotal);
  else
    v_discount_amount := 0;
  end if;

  v_taxable := v_subtotal - v_discount_amount;
  v_tax_amount := round(v_taxable * coalesce(p_tax_percent, 0) / 100, 2);
  v_total := v_taxable + v_tax_amount;

  if v_id is null then
    insert into public.quotations (
      customer_id, issue_date, valid_until, discount_type, discount_value,
      discount_amount, tax_percent, tax_amount, subtotal, total, notes, terms, created_by
    ) values (
      p_customer_id, p_issue_date, p_valid_until, p_discount_type, p_discount_value,
      v_discount_amount, coalesce(p_tax_percent, 0), v_tax_amount, v_subtotal, v_total, p_notes, p_terms, auth.uid()
    )
    returning id into v_id;
  else
    update public.quotations set
      customer_id = p_customer_id,
      issue_date = p_issue_date,
      valid_until = p_valid_until,
      discount_type = p_discount_type,
      discount_value = p_discount_value,
      discount_amount = v_discount_amount,
      tax_percent = coalesce(p_tax_percent, 0),
      tax_amount = v_tax_amount,
      subtotal = v_subtotal,
      total = v_total,
      notes = p_notes,
      terms = p_terms
    where id = v_id;

    delete from public.quotation_items where quotation_id = v_id;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.quotation_items (
      quotation_id, catalog_item_id, description, unit, quantity, unit_price, sort_order
    ) values (
      v_id,
      nullif(item->>'catalog_item_id', '')::uuid,
      item->>'description',
      coalesce(item->>'unit', 'pcs'),
      (item->>'quantity')::numeric,
      (item->>'unit_price')::numeric,
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. STATUS TRANSITIONS
-- ----------------------------------------------------------------------------
create or replace function public.set_quotation_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current text;
  v_allowed boolean := false;
begin
  if not public.has_manage_access('quotations') then
    raise exception 'You do not have permission to manage quotations.';
  end if;

  select status into v_current from public.quotations where id = p_id for update;
  if v_current is null then
    raise exception 'Quotation not found.';
  end if;

  v_allowed := case v_current
    when 'draft' then p_status in ('sent')
    when 'sent' then p_status in ('accepted', 'rejected', 'expired', 'draft')
    when 'accepted' then false
    when 'rejected' then p_status in ('draft')
    when 'expired' then p_status in ('draft')
    else false
  end;

  if not v_allowed then
    raise exception 'Cannot move a % quotation to %.', v_current, p_status;
  end if;

  update public.quotations set status = p_status where id = p_id;
end;
$$;

-- ============================================================================
-- Done. Refresh the app — Quotations is now live.
-- ============================================================================
