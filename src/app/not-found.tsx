import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <FileQuestion size={26} strokeWidth={1.75} />
      </div>
      <div>
        <h1 className="text-base font-semibold text-slate-900">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <a
        href="/dashboard"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        Go to dashboard
      </a>
    </div>
  );
}
