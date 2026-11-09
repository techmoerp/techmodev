// Fixed roles & module access map for the whole ERP.
// Roles are NOT user-editable — this file is the single source of truth.
// Later phases (Sales, Purchases, Inventory, Tickets, Reports...) just add
// their module key here and reference can(role, moduleKey) to gate access.
//
// NOTE: the "manage" (true) entries here are mirrored in SQL by
// has_manage_access() in supabase/phase2_master_data.sql. Keep both in sync.

export type AppRole =
  | "super_admin"
  | "admin"
  | "sales"
  | "accounts"
  | "inventory"
  | "support"
  | "marketing";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sales: "Sales",
  accounts: "Accounts",
  inventory: "Inventory & Purchasing",
  support: "Support / Technician",
  marketing: "Marketing",
};

export const ALL_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "sales",
  "accounts",
  "inventory",
  "support",
  "marketing",
];

// Every module that exists now or will exist across the whole build.
// Phase 1 built dashboard / users / settings. Phase 2 adds customers,
// suppliers and catalog. The rest are wired into the sidebar + permission
// map now so later phases just add pages.
export type ModuleKey =
  | "dashboard"
  | "quotations"
  | "sales"
  | "purchases"
  | "customers"
  | "suppliers"
  | "catalog"
  | "inventory"
  | "tickets"
  | "reports"
  | "users"
  | "settings";

// true = full access, "view" = read-only, false = no access
export type AccessLevel = true | "view" | false;

const FULL_ACCESS: Record<ModuleKey, AccessLevel> = {
  dashboard: true,
  quotations: true,
  sales: true,
  purchases: true,
  customers: true,
  suppliers: true,
  catalog: true,
  inventory: true,
  tickets: true,
  reports: true,
  users: true,
  settings: true,
};

export const ROLE_PERMISSIONS: Record<AppRole, Record<ModuleKey, AccessLevel>> = {
  super_admin: { ...FULL_ACCESS },
  admin: { ...FULL_ACCESS, users: true },
  sales: {
    dashboard: true,
    quotations: true,
    sales: true,
    purchases: false,
    customers: true,
    suppliers: "view",
    catalog: "view",
    inventory: "view",
    tickets: "view",
    reports: "view",
    users: false,
    settings: false,
  },
  accounts: {
    dashboard: true,
    quotations: "view",
    sales: "view",
    purchases: true,
    customers: "view",
    suppliers: true,
    catalog: "view",
    inventory: "view",
    tickets: false,
    reports: true,
    users: false,
    settings: false,
  },
  inventory: {
    dashboard: true,
    quotations: false,
    sales: "view",
    purchases: true,
    customers: false,
    suppliers: true,
    catalog: true,
    inventory: true,
    tickets: false,
    reports: "view",
    users: false,
    settings: false,
  },
  support: {
    dashboard: true,
    quotations: false,
    sales: "view",
    purchases: false,
    customers: "view",
    suppliers: false,
    catalog: "view",
    inventory: "view",
    tickets: true,
    reports: false,
    users: false,
    settings: false,
  },
  marketing: {
    dashboard: true,
    quotations: "view",
    sales: "view",
    purchases: false,
    customers: "view",
    suppliers: false,
    catalog: "view",
    inventory: false,
    tickets: false,
    reports: "view",
    users: false,
    settings: false,
  },
};

export function can(role: AppRole | null | undefined, moduleKey: ModuleKey): AccessLevel {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[moduleKey] ?? false;
}

export function canManage(role: AppRole | null | undefined, moduleKey: ModuleKey): boolean {
  return can(role, moduleKey) === true;
}

export function canManageUsers(role: AppRole | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

export function isSuperAdmin(role: AppRole | null | undefined): boolean {
  return role === "super_admin";
}
