-- ============================================================================
-- TECHMO ERP — PHASE 1: FOUNDATION (Auth, Fixed Roles, Profiles, Company Settings)
-- Run this entire file in the Supabase SQL Editor.
-- Name this query: "phase1_foundation"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIXED ROLES ENUM
-- ----------------------------------------------------------------------------
-- Fixed set of roles for the whole ERP (not user-editable). Later phases
-- reference these same role names when gating module access.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum (
      'super_admin',
      'admin',
      'sales',
      'accounts',
      'inventory',
      'support',
      'marketing'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. PROFILES  (1-1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role app_role not null default 'sales',
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per Techmo staff user. Role is fixed-set (app_role) and controls module access across the whole ERP.';

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
-- Role + full name come from raw_user_meta_data, set by the invite call
-- (see lib/actions/users.ts) — defaults to 'sales' if not provided.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'sales')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS (used by RLS policies in this and every later phase)
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns app_role
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY — profiles
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own_limited" on public.profiles;
create policy "profiles_update_own_limited"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_admin_update_any" on public.profiles;
create policy "profiles_admin_update_any"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "profiles_super_admin_delete" on public.profiles;
create policy "profiles_super_admin_delete"
  on public.profiles for delete
  to authenticated
  using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 5. COMPANY SETTINGS  (single row)
-- ----------------------------------------------------------------------------
create table if not exists public.company_settings (
  id int primary key default 1,
  company_name text not null default 'Techmo Software Solutions',
  logo_url text,
  address text,
  phone text,
  email text,
  website text,
  currency text not null default 'LKR',
  tax_id text,
  quotation_prefix text not null default 'QT-',
  invoice_prefix text not null default 'INV-',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

drop trigger if exists trg_company_settings_updated_at on public.company_settings;
create trigger trg_company_settings_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

insert into public.company_settings (id, company_name)
values (1, 'Techmo Software Solutions')
on conflict (id) do nothing;

alter table public.company_settings enable row level security;

drop policy if exists "company_settings_select_all_authenticated" on public.company_settings;
create policy "company_settings_select_all_authenticated"
  on public.company_settings for select
  to authenticated
  using (true);

drop policy if exists "company_settings_admin_update" on public.company_settings;
create policy "company_settings_admin_update"
  on public.company_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. STORAGE — company logo + user avatars bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

drop policy if exists "public_assets_read" on storage.objects;
create policy "public_assets_read"
  on storage.objects for select
  to public
  using (bucket_id = 'public-assets');

drop policy if exists "public_assets_admin_write" on storage.objects;
create policy "public_assets_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'public-assets' and public.is_admin());

drop policy if exists "public_assets_admin_update" on storage.objects;
create policy "public_assets_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'public-assets' and public.is_admin());

-- ============================================================================
-- Done. Next: in Supabase Dashboard > Authentication > Providers, confirm
-- Email provider is enabled. Then create your first Super Admin — see the
-- setup steps given in chat after this file.
-- ============================================================================
