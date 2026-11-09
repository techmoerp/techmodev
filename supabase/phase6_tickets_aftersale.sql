-- ============================================================================
-- TECHMO ERP — PHASE 6: TICKETS & AFTER-SALE
-- Run this entire file in the Supabase SQL Editor, after phase1-phase5.
-- Name this query: "phase6_tickets_aftersale"
-- ============================================================================

alter table public.company_settings add column if not exists ticket_prefix text not null default 'TKT-';

-- ----------------------------------------------------------------------------
-- 1. TICKETS
-- ----------------------------------------------------------------------------
create sequence if not exists public.ticket_no_seq;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique,
  customer_id uuid not null references public.customers (id),
  related_sale_id uuid references public.sales (id),
  subject text not null,
  description text,
  category text not null default 'other' check (category in ('hardware', 'software', 'billing', 'other')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

create or replace function public.set_ticket_no()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.ticket_no is null then
    select ticket_prefix into v_prefix from public.company_settings where id = 1;
    new.ticket_no := coalesce(v_prefix, 'TKT-') || lpad(nextval('public.ticket_no_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tickets_no on public.tickets;
create trigger trg_tickets_no
  before insert on public.tickets
  for each row execute function public.set_ticket_no();

create index if not exists idx_tickets_customer on public.tickets (customer_id);
create index if not exists idx_tickets_status on public.tickets (status);

-- ----------------------------------------------------------------------------
-- 2. TICKET COMMENTS / ACTIVITY
-- ----------------------------------------------------------------------------
create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid references public.profiles (id),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_comments_ticket on public.ticket_comments (ticket_id, created_at);

-- ----------------------------------------------------------------------------
-- 3. AFTER-SALE RECORDS (warranty repairs, replacements, adjustments)
-- ----------------------------------------------------------------------------
create sequence if not exists public.after_sale_no_seq;

create table if not exists public.after_sale_records (
  id uuid primary key default gen_random_uuid(),
  record_no text unique,
  customer_id uuid not null references public.customers (id),
  sale_id uuid references public.sales (id),
  catalog_item_id uuid references public.catalog_items (id),
  record_type text not null default 'other' check (record_type in ('warranty_repair', 'replacement', 'refund_adjustment', 'other')),
  description text not null,
  cost numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.set_after_sale_no()
returns trigger
language plpgsql
as $$
begin
  if new.record_no is null then
    new.record_no := 'AS-' || lpad(nextval('public.after_sale_no_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_after_sale_no on public.after_sale_records;
create trigger trg_after_sale_no
  before insert on public.after_sale_records
  for each row execute function public.set_after_sale_no();

create index if not exists idx_after_sale_customer on public.after_sale_records (customer_id);

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.after_sale_records enable row level security;

drop policy if exists "tickets_select_all_authenticated" on public.tickets;
create policy "tickets_select_all_authenticated"
  on public.tickets for select to authenticated using (true);

drop policy if exists "tickets_write_admin" on public.tickets;
create policy "tickets_write_admin"
  on public.tickets for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "ticket_comments_select_all_authenticated" on public.ticket_comments;
create policy "ticket_comments_select_all_authenticated"
  on public.ticket_comments for select to authenticated using (true);

drop policy if exists "ticket_comments_write_admin" on public.ticket_comments;
create policy "ticket_comments_write_admin"
  on public.ticket_comments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "after_sale_select_all_authenticated" on public.after_sale_records;
create policy "after_sale_select_all_authenticated"
  on public.after_sale_records for select to authenticated using (true);

drop policy if exists "after_sale_write_admin" on public.after_sale_records;
create policy "after_sale_write_admin"
  on public.after_sale_records for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- (Actual inserts/updates go through the security-definer RPCs below, which
-- check has_manage_access('tickets') themselves — the direct-table policies
-- above are only a backstop for admins working straight against the tables.)

-- ----------------------------------------------------------------------------
-- 5. ATOMIC CREATE / UPDATE — TICKETS
-- ----------------------------------------------------------------------------
create or replace function public.save_ticket(
  p_id uuid,
  p_customer_id uuid,
  p_subject text,
  p_description text,
  p_category text,
  p_priority text,
  p_assigned_to uuid,
  p_related_sale_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  if not public.has_manage_access('tickets') then
    raise exception 'You do not have permission to manage tickets.';
  end if;

  if p_id is not null then
    select status into v_status from public.tickets where id = p_id for update;
    if v_status is null then
      raise exception 'Ticket not found.';
    end if;
    if v_status = 'closed' then
      raise exception 'This ticket is closed and can no longer be edited.';
    end if;
    v_id := p_id;
  end if;

  if v_id is null then
    insert into public.tickets (
      customer_id, subject, description, category, priority, assigned_to, related_sale_id, created_by
    ) values (
      p_customer_id, p_subject, p_description, p_category, p_priority, p_assigned_to, p_related_sale_id, auth.uid()
    )
    returning id into v_id;
  else
    update public.tickets set
      customer_id = p_customer_id,
      subject = p_subject,
      description = p_description,
      category = p_category,
      priority = p_priority,
      assigned_to = p_assigned_to,
      related_sale_id = p_related_sale_id
    where id = v_id;
  end if;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. STATUS TRANSITIONS — TICKETS
-- ----------------------------------------------------------------------------
create or replace function public.set_ticket_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current text;
begin
  if not public.has_manage_access('tickets') then
    raise exception 'You do not have permission to manage tickets.';
  end if;

  if p_status not in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed') then
    raise exception 'Invalid status.';
  end if;

  select status into v_current from public.tickets where id = p_id for update;
  if v_current is null then
    raise exception 'Ticket not found.';
  end if;

  update public.tickets set
    status = p_status,
    resolved_at = case when p_status = 'resolved' and resolved_at is null then now() else resolved_at end,
    closed_at = case when p_status = 'closed' and closed_at is null then now() else closed_at end
  where id = p_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. COMMENTS
-- ----------------------------------------------------------------------------
create or replace function public.add_ticket_comment(
  p_ticket_id uuid,
  p_body text,
  p_is_internal boolean
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_manage_access('tickets') then
    raise exception 'You do not have permission to comment on tickets.';
  end if;

  if not exists (select 1 from public.tickets where id = p_ticket_id) then
    raise exception 'Ticket not found.';
  end if;

  insert into public.ticket_comments (ticket_id, author_id, body, is_internal)
  values (p_ticket_id, auth.uid(), p_body, coalesce(p_is_internal, false))
  returning id into v_id;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. ATOMIC CREATE / UPDATE — AFTER-SALE RECORDS
-- ----------------------------------------------------------------------------
create or replace function public.save_after_sale_record(
  p_id uuid,
  p_customer_id uuid,
  p_sale_id uuid,
  p_catalog_item_id uuid,
  p_record_type text,
  p_description text,
  p_cost numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  if not public.has_manage_access('tickets') then
    raise exception 'You do not have permission to manage after-sale records.';
  end if;

  if p_id is not null then
    select status into v_status from public.after_sale_records where id = p_id for update;
    if v_status is null then
      raise exception 'Record not found.';
    end if;
    if v_status in ('completed', 'cancelled') then
      raise exception 'This record is % and can no longer be edited.', v_status;
    end if;
    v_id := p_id;
  end if;

  if v_id is null then
    insert into public.after_sale_records (
      customer_id, sale_id, catalog_item_id, record_type, description, cost, created_by
    ) values (
      p_customer_id, p_sale_id, p_catalog_item_id, p_record_type, p_description, coalesce(p_cost, 0), auth.uid()
    )
    returning id into v_id;
  else
    update public.after_sale_records set
      customer_id = p_customer_id,
      sale_id = p_sale_id,
      catalog_item_id = p_catalog_item_id,
      record_type = p_record_type,
      description = p_description,
      cost = coalesce(p_cost, 0)
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.set_after_sale_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current text;
begin
  if not public.has_manage_access('tickets') then
    raise exception 'You do not have permission to manage after-sale records.';
  end if;

  if p_status not in ('pending', 'in_progress', 'completed', 'cancelled') then
    raise exception 'Invalid status.';
  end if;

  select status into v_current from public.after_sale_records where id = p_id for update;
  if v_current is null then
    raise exception 'Record not found.';
  end if;
  if v_current in ('completed', 'cancelled') then
    raise exception 'This record is already %.', v_current;
  end if;

  update public.after_sale_records set
    status = p_status,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. DELETE (admin only, direct table policy above already covers this —
--    these RPCs just give a friendlier error message from the app)
-- ----------------------------------------------------------------------------
create or replace function public.delete_ticket(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete tickets.';
  end if;
  delete from public.tickets where id = p_id;
end;
$$;

create or replace function public.delete_after_sale_record(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete after-sale records.';
  end if;
  delete from public.after_sale_records where id = p_id;
end;
$$;

-- ============================================================================
-- Done. Refresh the app — Tickets and After-Sale Records are now live.
-- ============================================================================
