"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu, ChevronDown, LogOut, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { initials, cn } from "@/lib/utils";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";

export function Topbar({
  fullName,
  role,
  onOpenMobile,
  pageTitle,
}: {
  fullName: string;
  role: AppRole;
  onOpenMobile: () => void;
  pageTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onOpenMobile}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <h1 className="truncate text-base font-semibold text-slate-900">{pageTitle}</h1>

      <div className="ml-auto" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-full border border-slate-200 py-1 pl-1 pr-2.5 transition hover:bg-slate-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {initials(fullName)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight text-slate-800">
              {fullName}
            </span>
            <span className="block text-[11px] leading-tight text-slate-400">
              {ROLE_LABELS[role]}
            </span>
          </span>
          <ChevronDown size={16} className="text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-4 mt-2 w-48 animate-fade-in rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg sm:right-6">
            <div className="px-3 py-2 sm:hidden">
              <p className="text-sm font-medium text-slate-800">{fullName}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p>
            </div>
            <button
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
              )}
            >
              <UserCircle size={16} /> My profile
            </button>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
