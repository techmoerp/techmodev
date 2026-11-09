-- ============================================================================
-- TECHMO ERP — PHASE 4: SALES & INVOICING
-- Run this entire file in the Supabase SQL Editor, after phase1, phase2, phase3.
-- Name this query: "phase4_sales"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SALES
-- ----------------------------------------------------------------------------
create sequence if not exists public.sale_no_seq;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_no text unique,
  customer_id uuid not null references public.customers (id),
  quotation_id uuid references public.quotations (id),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none', 'percentage', 'fixed')),
  discount_value numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_percent numeric(5, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  total_returned numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  notes text,
  terms text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sales_updated_at on public.sales;
create trigger trg_sales_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

create or replace function public.set_sale_no()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.sale_no is null then
    select invoice_prefix into v_prefix from public.company_settings where id = 1;
    new.sale_no := coalesce(v_prefix, 'INV-') || lpad(nextval('public.sale_no_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_no on public.sales;
create trigger trg_sales_no
  before insert on public.sales
  for each row execute function public.set_sale_no();

-- ----------------------------------------------------------------------------
-- 2. SALE ITEMS
-- ----------------------------------------------------------------------------
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  catalog_item_id uuid references public.catalog_items (id),
  description text not null,
  unit text not null default 'pcs',
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order int not null default 0
);

-- ----------------------------------------------------------------------------
-- 3. SALE PAYMENTS
-- ----------------------------------------------------------------------------
create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'bank_transfer', 'card', 'cheque', 'other')),
  paid_on date not null default current_date,
  reference text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. SALE RETURNS
-- ----------------------------------------------------------------------------
create table if not exists public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Link back from quotations once converted (one quotation -> at most one sale)
alter table public.quotations add column if not exists converted_to_sale_id uuid references public.sales (id);

-- ----------------------------------------------------------------------------
-- 5. KEEP amount_paid / total_returned / payment_status IN SYNC
-- ----------------------------------------------------------------------------
create or replace function public.recompute_sale_totals(p_sale_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_returned numeric(12,2);
  v_status text;
begin
  select total into v_total from public.sales where id = p_sale_id;

  select coalesce(sum(amount), 0) into v_paid from public.sale_payments where sale_id = p_sale_id;
  select coalesce(sum(amount), 0) into v_returned from public.sale_returns where sale_id = p_sale_id;

  v_status := case
    when v_paid <= 0 then 'unpaid'
    when v_paid >= (v_total - v_returned) then 'paid'
    else 'partial'
  end;

  update public.sales
  set amount_paid = v_paid, total_returned = v_returned, payment_status = v_status
  where id = p_sale_id;
end;
$$;

create or replace function public.trg_recompute_sale_totals()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_sale_totals(coalesce(new.sale_id, old.sale_id));
  return null;
end;
$$;

drop trigger if exists trg_sale_payments_recompute on public.sale_payments;
create trigger trg_sale_payments_recompute
  after insert or update or delete on public.sale_payments
  for each row execute function public.trg_recompute_sale_totals();

drop trigger if exists trg_sale_returns_recompute on public.sale_returns;
create trigger trg_sale_returns_recompute
  after insert or update or delete on public.sale_returns
  for each row execute function public.trg_recompute_sale_totals();

-- Who may record a payment/return: broader than full "manage sales" since
-- Accounts handles money even though their sales access is view-only.
create or replace function public.can_record_payment()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.current_role() in ('super_admin', 'admin', 'sales', 'accounts');
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------------------
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.sale_returns enable row level security;

drop policy if exists "sales_select_all_authenticated" on public.sales;
create policy "sales_select_all_authenticated"
  on public.sales for select to authenticated using (true);

drop policy if exists "sales_insert_manage" on public.sales;
create policy "sales_insert_manage"
  on public.sales for insert to authenticated
  with check (public.has_manage_access('sales'));

drop policy if exists "sales_update_manage" on public.sales;
create policy "sales_update_manage"
  on public.sales for update to authenticated
  using (public.has_manage_access('sales') or public.can_record_payment())
  with check (public.has_manage_access('sales') or public.can_record_payment());

drop policy if exists "sales_delete_admin" on public.sales;
create policy "sales_delete_admin"
  on public.sales for delete to authenticated
  using (public.is_admin());

drop policy if exists "sale_items_select_all_authenticated" on public.sale_items;
create policy "sale_items_select_all_authenticated"
  on public.sale_items for select to authenticated using (true);

drop policy if exists "sale_items_write_admin" on public.sale_items;
create policy "sale_items_write_admin"
  on public.sale_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "sale_payments_select_all_authenticated" on public.sale_payments;
create policy "sale_payments_select_all_authenticated"
  on public.sale_payments for select to authenticated using (true);

drop policy if exists "sale_payments_insert" on public.sale_payments;
create policy "sale_payments_insert"
  on public.sale_payments for insert to authenticated
  with check (public.can_record_payment());

drop policy if exists "sale_payments_delete_admin" on public.sale_payments;
create policy "sale_payments_delete_admin"
  on public.sale_payments for delete to authenticated
  using (public.is_admin());

drop policy if exists "sale_returns_select_all_authenticated" on public.sale_returns;
create policy "sale_returns_select_all_authenticated"
  on public.sale_returns for select to authenticated using (true);

drop policy if exists "sale_returns_insert" on public.sale_returns;
create policy "sale_returns_insert"
  on public.sale_returns for insert to authenticated
  with check (public.can_record_payment());

drop policy if exists "sale_returns_delete_admin" on public.sale_returns;
create policy "sale_returns_delete_admin"
  on public.sale_returns for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. ATOMIC CREATE / UPDATE (draft sales only — same shape as save_quotation)
-- ----------------------------------------------------------------------------
create or replace function public.save_sale(
  p_id uuid,
  p_customer_id uuid,
  p_issue_date date,
  p_due_date date,
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
  if not public.has_manage_access('sales') then
    raise exception 'You do not have permission to manage sales.';
  end if;

  if p_id is not null then
    select status into v_status from public.sales where id = p_id for update;
    if v_status is null then
      raise exception 'Sale not found.';
    end if;
    if v_status <> 'draft' then
      raise exception 'This sale is % and can no longer be edited.', v_status;
    end if;
    v_id := p_id;
  end if;

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
    insert into public.sales (
      customer_id, issue_date, due_date, discount_type, discount_value,
      discount_amount, tax_percent, tax_amount, subtotal, total, notes, terms, created_by
    ) values (
      p_customer_id, p_issue_date, p_due_date, p_discount_type, p_discount_value,
      v_discount_amount, coalesce(p_tax_percent, 0), v_tax_amount, v_subtotal, v_total, p_notes, p_terms, auth.uid()
    )
    returning id into v_id;
  else
    update public.sales set
      customer_id = p_customer_id,
      issue_date = p_issue_date,
      due_date = p_due_date,
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

    delete from public.sale_items where sale_id = v_id;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sale_items (
      sale_id, catalog_item_id, description, unit, quantity, unit_price, sort_order
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
-- 8. CONFIRM / CANCEL
-- ----------------------------------------------------------------------------
create or replace function public.set_sale_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current text;
  v_paid numeric(12,2);
begin
  if not public.has_manage_access('sales') then
    raise exception 'You do not have permission to manage sales.';
  end if;

  select status, amount_paid into v_current, v_paid from public.sales where id = p_id for update;
  if v_current is null then
    raise exception 'Sale not found.';
  end if;

  if p_status = 'confirmed' and v_current <> 'draft' then
    raise exception 'Only a draft sale can be confirmed.';
  end if;

  if p_status = 'cancelled' then
    if v_current = 'cancelled' then
      raise exception 'Already cancelled.';
    end if;
    if v_paid > 0 then
      raise exception 'Cannot cancel a sale with payments recorded — record a return instead.';
    end if;
  end if;

  update public.sales set status = p_status where id = p_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. CONVERT AN ACCEPTED QUOTATION INTO A DRAFT SALE
-- ----------------------------------------------------------------------------
create or replace function public.convert_quotation_to_sale(p_quotation_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_quotation record;
  v_sale_id uuid;
begin
  if not public.has_manage_access('sales') then
    raise exception 'You do not have permission to create sales.';
  end if;

  select * into v_quotation from public.quotations where id = p_quotation_id for update;
  if v_quotation is null then
    raise exception 'Quotation not found.';
  end if;
  if v_quotation.status <> 'accepted' then
    raise exception 'Only an accepted quotation can be converted to a sale.';
  end if;
  if v_quotation.converted_to_sale_id is not null then
    raise exception 'This quotation has already been converted.';
  end if;

  insert into public.sales (
    customer_id, quotation_id, issue_date, discount_type, discount_value,
    discount_amount, tax_percent, tax_amount, subtotal, total, notes, terms, created_by
  ) values (
    v_quotation.customer_id, v_quotation.id, current_date, v_quotation.discount_type, v_quotation.discount_value,
    v_quotation.discount_amount, v_quotation.tax_percent, v_quotation.tax_amount, v_quotation.subtotal,
    v_quotation.total, v_quotation.notes, v_quotation.terms, auth.uid()
  )
  returning id into v_sale_id;

  insert into public.sale_items (sale_id, catalog_item_id, description, unit, quantity, unit_price, sort_order)
  select v_sale_id, catalog_item_id, description, unit, quantity, unit_price, sort_order
  from public.quotation_items
  where quotation_id = v_quotation.id;

  update public.quotations set converted_to_sale_id = v_sale_id where id = v_quotation.id;

  return v_sale_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. PAYMENTS & RETURNS
-- ----------------------------------------------------------------------------
create or replace function public.add_sale_payment(
  p_sale_id uuid,
  p_amount numeric,
  p_method text,
  p_paid_on date,
  p_reference text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_sale record;
  v_id uuid;
begin
  if not public.can_record_payment() then
    raise exception 'You do not have permission to record payments.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale is null then
    raise exception 'Sale not found.';
  end if;
  if v_sale.status <> 'confirmed' then
    raise exception 'Only a confirmed sale can take payments.';
  end if;
  if p_amount > (v_sale.total - v_sale.total_returned - v_sale.amount_paid) then
    raise exception 'Payment exceeds the outstanding balance.';
  end if;

  insert into public.sale_payments (sale_id, amount, method, paid_on, reference, created_by)
  values (p_sale_id, p_amount, p_method, p_paid_on, p_reference, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.add_sale_return(
  p_sale_id uuid,
  p_amount numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_sale record;
  v_id uuid;
begin
  if not public.can_record_payment() then
    raise exception 'You do not have permission to record returns.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale is null then
    raise exception 'Sale not found.';
  end if;
  if v_sale.status <> 'confirmed' then
    raise exception 'Only a confirmed sale can have a return recorded.';
  end if;
  if p_amount > (v_sale.total - v_sale.total_returned) then
    raise exception 'Return amount exceeds what remains on this sale.';
  end if;

  insert into public.sale_returns (sale_id, amount, reason, created_by)
  values (p_sale_id, p_amount, p_reason, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================================
-- Done. Refresh the app — Sales is now live, and accepted quotations show a
-- "Convert to Sale" button.
-- ============================================================================
