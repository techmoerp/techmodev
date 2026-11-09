import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <AppShell fullName={profile.full_name} role={profile.role}>
      {children}
    </AppShell>
  );
}
