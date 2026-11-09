"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  Tags,
  Package,
  Ticket,
  Wrench,
  BarChart3,
  UserCog,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type AppRole, type ModuleKey } from "@/lib/permissions";

type NavItem = {
  key: ModuleKey;
  label: string;
  href: string;
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "quotations", label: "Quotations", href: "/quotations", icon: FileText },
  { key: "sales", label: "Sales", href: "/sales", icon: ShoppingCart },
  { key: "purchases", label: "Purchases", href: "/purchases", icon: Truck },
  { key: "customers", label: "Customers", href: "/customers", icon: Users },
  { key: "suppliers", label: "Suppliers", href: "/suppliers", icon: Building2 },
  { key: "catalog", label: "Catalog", href: "/catalog", icon: Tags },
  { key: "inventory", label: "Inventory", href: "/inventory", icon: Package },
  { key: "tickets", label: "Tickets", href: "/tickets", icon: Ticket },
  { key: "tickets", label: "After-Sale Records", href: "/after-sale", icon: Wrench },
  { key: "reports", label: "Reports & Analytics", href: "/reports", icon: BarChart3 },
];

const ADMIN_ITEMS: NavItem[] = [
  { key: "users", label: "Users & Roles", href: "/users", icon: UserCog },
  { key: "settings", label: "Company Settings", href: "/settings", icon: Settings },
];

const BUILT_ROUTES = new Set([
  "/dashboard",
  "/users",
  "/settings",
  "/customers",
  "/suppliers",
  "/catalog",
  "/quotations",
  "/sales",
  "/purchases",
  "/inventory",
  "/tickets",
  "/after-sale",
  "/reports",
]);

export function Sidebar({
  role,
  mobileOpen,
  onCloseMobile,
}: {
  role: AppRole;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  const visibleMain = NAV_ITEMS.filter((item) => can(role, item.key) !== false);
  const visibleAdmin = ADMIN_ITEMS.filter((item) => can(role, item.key) !== false);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-md shadow-brand-600/30">
          T
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-900">Techmo</p>
          <p className="text-[11px] leading-tight text-slate-400">ERP Workspace</p>
        </div>
        <button
          onClick={onCloseMobile}
          className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {visibleMain.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={pathname.startsWith(item.href)}
              comingSoon={!BUILT_ROUTES.has(item.href)}
            />
          ))}
        </div>

        {visibleAdmin.length > 0 && (
          <div>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Administration
            </p>
            <div className="space-y-0.5">
              {visibleAdmin.map((item) => (
                <NavLink
                  key={item.key}
                  item={item}
                  active={pathname.startsWith(item.href)}
                  comingSoon={!BUILT_ROUTES.has(item.href)}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <p className="text-[11px] text-slate-400">Techmo ERP</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        {content}
      </aside>

      {/* Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl animate-fade-in">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

function NavLink({
  item,
  active,
  comingSoon,
}: {
  item: NavItem;
  active: boolean;
  comingSoon: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon
        size={18}
        strokeWidth={2}
        className={cn(active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-500")}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {comingSoon && (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          Soon
        </span>
      )}
    </Link>
  );
}
