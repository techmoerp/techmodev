-- ============================================================================
-- TECHMO ERP — PHASE 5: PURCHASES & INVENTORY
-- Run this entire file in the Supabase SQL Editor, after phases 1-4.
-- Name this query: "phase5_purchases_inventory"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMPANY SETTINGS — add a Purchase Order prefix
-- ----------------------------------------------------------------------------
alter table public.company_settings add column if not exists purchase_prefix text not null default 'PO-';

-- ----------------------------------------------------------------------------
-- 2. STOCK LEVELS (single location) + MOVEMENT LOG
-- ----------------------------------------------------------------------------
create table if not exists public.stock_levels (
  catalog_item_id uuid primary key references public.catalog_items (id),
  quantity_on_hand numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.catalog_items (id),
  change_qty numeric(12, 2) not null,
  reason text not null check (reason in ('purchase_receipt', 'sale', 'sale_cancelled_restock', 'adjustment')),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_item on public.stock_movements (catalog_item_id, created_at desc);

alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists "stock_levels_select_all_authenticated" on public.stock_levels;
create policy "stock_levels_select_all_authenticated"
  on public.stock_levels for select to authenticated using (true);

-- Stock levels are only ever written by the functions below (security definer).
drop policy if exists "stock_levels_write_admin" on public.stock_levels;
create policy "stock_levels_write_admin"
  on public.stock_levels for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "stock_movements_select_all_authenticated" on public.stock_movements;
create policy "stock_movements_select_all_authenticated"
  on public.stock_movements for select to authenticated using (true);

drop policy if exists "stock_movements_write_admin" on public.stock_movements;
create policy "stock_movements_write_admin"
  on public.stock_movements for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Shared helper: move stock for one catalog item and log it. Security
-- definer so it can be called from the RPCs below regardless of the
-- direct-table RLS (which is admin-only as a backstop).
create or replace function public.move_stock(
  p_catalog_item_id uuid,
  p_change_qty numeric,
  p_reason text,
  p_reference_type text,
  p_reference_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.stock_levels (catalog_item_id, quantity_on_hand)
  values (p_catalog_item_id, p_change_qty)
  on conflict (catalog_item_id)
  do update set quantity_on_hand = public.stock_levels.quantity_on_hand + excluded.quantity_on_hand,
                updated_at = now();

  insert into public.stock_movements (
    catalog_item_id, change_qty, reason, reference_type, reference_id, notes, created_by
  ) values (
    p_catalog_item_id, p_change_qty, p_reason, p_reference_type, p_reference_id, p_notes, auth.uid()
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. PURCHASE ORDERS
-- ----------------------------------------------------------------------------
create sequence if not exists public.purchase_order_no_seq;

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_no text unique,
  supplier_id uuid not null references public.suppliers (id),
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  order_date date not null default current_date,
  expected_date date,
  subtotal numeric(12, 2) not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none', 'percentage', 'fixed')),
  discount_value numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_percent numeric(5, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  terms text,
  received_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_purchase_orders_updated_at on public.purchase_orders;
create trigger trg_purchase_orders_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

create or replace function public.set_po_no()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.po_no is null then
    select purchase_prefix into v_prefix from public.company_settings where id = 1;
    new.po_no := coalesce(v_prefix, 'PO-') || lpad(nextval('public.purchase_order_no_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_orders_no on public.purchase_orders;
create trigger trg_purchase_orders_no
  before insert on public.purchase_orders
  for each row execute function public.set_po_no();

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  catalog_item_id uuid references public.catalog_items (id),
  description text not null,
  unit text not null default 'pcs',
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order int not null default 0
);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "purchase_orders_select_all_authenticated" on public.purchase_orders;
create policy "purchase_orders_select_all_authenticated"
  on public.purchase_orders for select to authenticated using (true);

drop policy if exists "purchase_orders_insert_manage" on public.purchase_orders;
create policy "purchase_orders_insert_manage"
  on public.purchase_orders for insert to authenticated
  with check (public.has_manage_access('purchases'));

drop policy if exists "purchase_orders_update_manage" on public.purchase_orders;
create policy "purchase_orders_update_manage"
  on public.purchase_orders for update to authenticated
  using (public.has_manage_access('purchases'))
  with check (public.has_manage_access('purchases'));

drop policy if exists "purchase_orders_delete_admin" on public.purchase_orders;
create policy "purchase_orders_delete_admin"
  on public.purchase_orders for delete to authenticated
  using (public.is_admin());

drop policy if exists "purchase_order_items_select_all_authenticated" on public.purchase_order_items;
create policy "purchase_order_items_select_all_authenticated"
  on public.purchase_order_items for select to authenticated using (true);

drop policy if exists "purchase_order_items_write_admin" on public.purchase_order_items;
create policy "purchase_order_items_write_admin"
  on public.purchase_order_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. ATOMIC CREATE / UPDATE (draft only)
-- ----------------------------------------------------------------------------
create or replace function public.save_purchase_order(
  p_id uuid,
  p_supplier_id uuid,
  p_order_date date,
  p_expected_date date,
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
  if not public.has_manage_access('purchases') then
    raise exception 'You do not have permission to manage purchases.';
  end if;

  if p_id is not null then
    select status into v_status from public.purchase_orders where id = p_id for update;
    if v_status is null then
      raise exception 'Purchase order not found.';
    end if;
    if v_status <> 'draft' then
      raise exception 'This purchase order is % and can no longer be edited.', v_status;
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
    insert into public.purchase_orders (
      supplier_id, order_date, expected_date, discount_type, discount_value,
      discount_amount, tax_percent, tax_amount, subtotal, total, notes, terms, created_by
    ) values (
      p_supplier_id, p_order_date, p_expected_date, p_discount_type, p_discount_value,
      v_discount_amount, coalesce(p_tax_percent, 0), v_tax_amount, v_subtotal, v_total, p_notes, p_terms, auth.uid()
    )
    returning id into v_id;
  else
    update public.purchase_orders set
      supplier_id = p_supplier_id,
      order_date = p_order_date,
      expected_date = p_expected_date,
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

    delete from public.purchase_order_items where purchase_order_id = v_id;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.purchase_order_items (
      purchase_order_id, catalog_item_id, description, unit, quantity, unit_price, sort_order
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
-- 5. STATUS TRANSITIONS — ordering + receiving (receiving moves stock)
-- ----------------------------------------------------------------------------
create or replace function public.set_purchase_order_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current text;
  v_allowed boolean := false;
  item record;
begin
  if not public.has_manage_access('purchases') then
    raise exception 'You do not have permission to manage purchases.';
  end if;

  select status into v_current from public.purchase_orders where id = p_id for update;
  if v_current is null then
    raise exception 'Purchase order not found.';
  end if;

  v_allowed := case v_current
    when 'draft' then p_status in ('ordered', 'cancelled')
    when 'ordered' then p_status in ('received', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'Cannot move a % purchase order to %.', v_current, p_status;
  end if;

  if p_status = 'received' then
    for item in
      select poi.catalog_item_id, poi.quantity
      from public.purchase_order_items poi
      join public.catalog_items ci on ci.id = poi.catalog_item_id
      where poi.purchase_order_id = p_id
        and poi.catalog_item_id is not null
        and ci.track_inventory = true
    loop
      perform public.move_stock(item.catalog_item_id, item.quantity, 'purchase_receipt', 'purchase_order', p_id);
    end loop;

    update public.purchase_orders set status = p_status, received_at = now() where id = p_id;
  else
    update public.purchase_orders set status = p_status where id = p_id;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. MANUAL STOCK ADJUSTMENTS
-- ----------------------------------------------------------------------------
create or replace function public.create_stock_adjustment(
  p_catalog_item_id uuid,
  p_change_qty numeric,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_manage_access('inventory') then
    raise exception 'You do not have permission to adjust stock.';
  end if;
  if p_change_qty = 0 then
    raise exception 'Adjustment quantity cannot be zero.';
  end if;

  perform public.move_stock(p_catalog_item_id, p_change_qty, 'adjustment', 'adjustment', null, p_reason);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. WIRE SALES INTO STOCK — confirming deducts, cancelling restores
-- ----------------------------------------------------------------------------
-- Replaces the Phase 4 version of this function with one that also moves
-- stock for tracked products. Everything else about it is unchanged.
create or replace function public.set_sale_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current text;
  v_paid numeric(12,2);
  item record;
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

  if p_status = 'confirmed' then
    for item in
      select si.catalog_item_id, si.quantity
      from public.sale_items si
      join public.catalog_items ci on ci.id = si.catalog_item_id
      where si.sale_id = p_id
        and si.catalog_item_id is not null
        and ci.track_inventory = true
    loop
      perform public.move_stock(item.catalog_item_id, -item.quantity, 'sale', 'sale', p_id);
    end loop;
  elsif p_status = 'cancelled' and v_current = 'confirmed' then
    for item in
      select si.catalog_item_id, si.quantity
      from public.sale_items si
      join public.catalog_items ci on ci.id = si.catalog_item_id
      where si.sale_id = p_id
        and si.catalog_item_id is not null
        and ci.track_inventory = true
    loop
      perform public.move_stock(item.catalog_item_id, item.quantity, 'sale_cancelled_restock', 'sale', p_id);
    end loop;
  end if;

  update public.sales set status = p_status where id = p_id;
end;
$$;

-- ============================================================================
-- Done. Refresh the app — Purchases and Inventory are now live, and
-- confirming/cancelling a sale moves stock for tracked products.
-- ============================================================================
