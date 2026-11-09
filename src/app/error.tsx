"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the full error in the server/browser console for debugging,
    // without exposing internals in the UI shown to the user.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle size={26} strokeWidth={1.75} />
      </div>
      <div>
        <h1 className="text-base font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          An unexpected error occurred. You can try again, or head back to the dashboard.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
