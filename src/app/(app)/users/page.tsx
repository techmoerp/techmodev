import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { UsersTable } from "@/components/users/users-table";

export default async function UsersPage() {
  const profile = await requireProfile();

  if (!canManageUsers(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Users &amp; Roles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Invite staff and assign their fixed role. Roles control what each person can see.
          </p>
        </div>
      </div>

      <UsersTable users={users ?? []} currentUserId={profile.id} currentUserRole={profile.role} />
    </div>
  );
}
