import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f6f7fb_55%)] px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-lg shadow-brand-600/30">
            T
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Techmo ERP</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>
        </div>

        <Suspense fallback={<div className="h-[260px] animate-pulse rounded-2xl bg-white" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-400">
          New accounts are created by an admin. Check your email for an invite.
        </p>
      </div>
    </div>
  );
}
