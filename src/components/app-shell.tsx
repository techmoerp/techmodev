"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type { AppRole } from "@/lib/permissions";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/quotations": "Quotations",
  "/sales": "Sales",
  "/purchases": "Purchases",
  "/customers": "Customers",
  "/suppliers": "Suppliers",
  "/catalog": "Product & Service Catalog",
  "/inventory": "Inventory",
  "/tickets": "Tickets",
  "/reports": "Reports & Analytics",
  "/users": "Users & Roles",
  "/settings": "Company Settings",
};

export function AppShell({
  fullName,
  role,
  children,
}: {
  fullName: string;
  role: AppRole;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const segment = "/" + (pathname.split("/")[1] ?? "");
  const pageTitle = TITLES[segment] ?? "Techmo ERP";

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7fb] print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="print:hidden">
        <Sidebar role={role} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col print:block">
        <div className="print:hidden">
          <Topbar
            fullName={fullName}
            role={role}
            pageTitle={pageTitle}
            onOpenMobile={() => setMobileOpen(true)}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
