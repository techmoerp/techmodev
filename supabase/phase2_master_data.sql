-- ============================================================================
-- TECHMO ERP — PHASE 2: MASTER DATA (Customers, Suppliers, Catalog)
-- Run this entire file in the Supabase SQL Editor, after phase1_foundation.sql.
-- Name this query: "phase2_master_data"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MODULE-LEVEL ACCESS HELPER
-- ----------------------------------------------------------------------------
-- Mirrors src/lib/permissions.ts's ROLE_PERMISSIONS "manage" (true) entries.
-- Used by every later phase too — keep this in sync if you change the TS map.
create or replace function public.has_manage_access(p_module text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select case public.current_role()
    when 'super_admin' then true
    when 'admin' then true
    when 'sales' then p_module in ('quotations', 'sales', 'customers')
    when 'accounts' then p_module in ('purchases', 'suppliers', 'reports')
    when 'inventory' then p_module in ('purchases', 'suppliers', 'inventory', 'catalog')
    when 'support' then p_module in ('tickets')
    when 'marketing' then false
    else false
  end;
$$;

-- ----------------------------------------------------------------------------
-- 2. CUSTOMERS
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_type text not null default 'business' check (customer_type in ('individual', 'business')),
  email text,
  phone text,
  address text,
  tax_id text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create index if not exists idx_customers_name on public.customers using gin (to_tsvector('simple', name));

alter table public.customers enable row level security;

drop policy if exists "customers_select_all_authenticated" on public.customers;
create policy "customers_select_all_authenticated"
  on public.customers for select to authenticated using (true);

drop policy if exists "customers_insert_manage" on public.customers;
create policy "customers_insert_manage"
  on public.customers for insert to authenticated
  with check (public.has_manage_access('customers'));

drop policy if exists "customers_update_manage" on public.customers;
create policy "customers_update_manage"
  on public.customers for update to authenticated
  using (public.has_manage_access('customers'))
  with check (public.has_manage_access('customers'));

drop policy if exists "customers_delete_admin" on public.customers;
create policy "customers_delete_admin"
  on public.customers for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. SUPPLIERS
-- ----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  tax_id text,
  payment_terms text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_select_all_authenticated" on public.suppliers;
create policy "suppliers_select_all_authenticated"
  on public.suppliers for select to authenticated using (true);

drop policy if exists "suppliers_insert_manage" on public.suppliers;
create policy "suppliers_insert_manage"
  on public.suppliers for insert to authenticated
  with check (public.has_manage_access('suppliers'));

drop policy if exists "suppliers_update_manage" on public.suppliers;
create policy "suppliers_update_manage"
  on public.suppliers for update to authenticated
  using (public.has_manage_access('suppliers'))
  with check (public.has_manage_access('suppliers'));

drop policy if exists "suppliers_delete_admin" on public.suppliers;
create policy "suppliers_delete_admin"
  on public.suppliers for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. PRODUCT / SERVICE CATEGORIES
-- ----------------------------------------------------------------------------
create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('product', 'service')),
  created_at timestamptz not null default now(),
  unique (name, kind)
);

alter table public.catalog_categories enable row level security;

drop policy if exists "catalog_categories_select_all_authenticated" on public.catalog_categories;
create policy "catalog_categories_select_all_authenticated"
  on public.catalog_categories for select to authenticated using (true);

drop policy if exists "catalog_categories_manage" on public.catalog_categories;
create policy "catalog_categories_manage"
  on public.catalog_categories for all to authenticated
  using (public.has_manage_access('catalog'))
  with check (public.has_manage_access('catalog'));

insert into public.catalog_categories (name, kind) values
  ('Computers', 'product'),
  ('Printers', 'product'),
  ('Scanners', 'product'),
  ('Networking', 'product'),
  ('Accessories', 'product'),
  ('ERP Development', 'service'),
  ('Taxation Services', 'service'),
  ('Digital Marketing', 'service'),
  ('Website Development', 'service'),
  ('Support & Maintenance', 'service')
on conflict (name, kind) do nothing;

-- ----------------------------------------------------------------------------
-- 5. CATALOG ITEMS (products + services, one table)
-- ----------------------------------------------------------------------------
create sequence if not exists public.catalog_sku_seq;

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  kind text not null check (kind in ('product', 'service')),
  category_id uuid references public.catalog_categories (id),
  unit text not null default 'pcs',
  unit_price numeric(12, 2) not null default 0,
  cost_price numeric(12, 2),
  track_inventory boolean not null default false,
  reorder_level int not null default 0,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_dont_track_inventory check (not (kind = 'service' and track_inventory))
);

drop trigger if exists trg_catalog_items_updated_at on public.catalog_items;
create trigger trg_catalog_items_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();

-- Auto-generate a unique SKU for products that don't supply one.
-- Format: PRD-00001. Services are left without a SKU unless given one.
create or replace function public.set_catalog_sku()
returns trigger
language plpgsql
as $$
begin
  if new.sku is null and new.kind = 'product' then
    new.sku := 'PRD-' || lpad(nextval('public.catalog_sku_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_catalog_items_sku on public.catalog_items;
create trigger trg_catalog_items_sku
  before insert on public.catalog_items
  for each row execute function public.set_catalog_sku();

create index if not exists idx_catalog_items_name on public.catalog_items using gin (to_tsvector('simple', name));

alter table public.catalog_items enable row level security;

drop policy if exists "catalog_items_select_all_authenticated" on public.catalog_items;
create policy "catalog_items_select_all_authenticated"
  on public.catalog_items for select to authenticated using (true);

drop policy if exists "catalog_items_insert_manage" on public.catalog_items;
create policy "catalog_items_insert_manage"
  on public.catalog_items for insert to authenticated
  with check (public.has_manage_access('catalog'));

drop policy if exists "catalog_items_update_manage" on public.catalog_items;
create policy "catalog_items_update_manage"
  on public.catalog_items for update to authenticated
  using (public.has_manage_access('catalog'))
  with check (public.has_manage_access('catalog'));

drop policy if exists "catalog_items_delete_admin" on public.catalog_items;
create policy "catalog_items_delete_admin"
  on public.catalog_items for delete to authenticated
  using (public.is_admin());

-- ============================================================================
-- Done. Refresh the app — Customers, Suppliers and Catalog are now live.
-- ============================================================================
