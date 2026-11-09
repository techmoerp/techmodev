"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, MoreVertical, Trash2, Mail } from "lucide-react";
import { initials, cn, formatDate } from "@/lib/utils";
import { ALL_ROLES, ROLE_LABELS, isSuperAdmin, type AppRole } from "@/lib/permissions";
import { inviteUser, updateUserRole, updateUserStatus, deleteUser } from "@/lib/actions/users";
import { Badge } from "@/components/ui/badge";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: "active" | "inactive";
  created_at: string;
};

const ROLE_BADGE_COLOR: Record<AppRole, "brand" | "slate" | "emerald" | "amber" | "rose"> = {
  super_admin: "rose",
  admin: "brand",
  sales: "emerald",
  accounts: "amber",
  inventory: "slate",
  support: "slate",
  marketing: "slate",
};

export function UsersTable({
  users,
  currentUserId,
  currentUserRole,
}: {
  users: UserRow[];
  currentUserId: string;
  currentUserRole: AppRole;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  const amSuperAdmin = isSuperAdmin(currentUserRole);
  const assignableRoles = amSuperAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r !== "admin" && r !== "super_admin");

  async function handleRoleChange(userId: string, role: AppRole) {
    const res = await updateUserRole(userId, role);
    if (!res.success) alert(res.error);
    router.refresh();
  }

  async function handleStatusToggle(userId: string, current: "active" | "inactive") {
    const next = current === "active" ? "inactive" : "active";
    const res = await updateUserStatus(userId, next);
    if (!res.success) alert(res.error);
    router.refresh();
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Remove ${name}? They will lose access immediately.`)) return;
    const res = await deleteUser(userId);
    if (!res.success) alert(res.error);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <p className="text-sm text-slate-500">{users.length} user{users.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <UserPlus size={16} /> Invite user
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const canEditThisRole = amSuperAdmin || (u.role !== "admin" && u.role !== "super_admin");
              return (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                        {initials(u.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">
                          {u.full_name} {u.id === currentUserId && <span className="text-slate-400">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canEditThisRole ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole)}
                        disabled={u.id === currentUserId}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 disabled:opacity-50"
                      >
                        {assignableRoles.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge color={ROLE_BADGE_COLOR[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleStatusToggle(u.id, u.status)}
                      disabled={u.id === currentUserId}
                      className="disabled:opacity-50"
                    >
                      <Badge color={u.status === "active" ? "emerald" : "slate"}>
                        {u.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="relative px-4 py-3 text-right">
                    {amSuperAdmin && u.id !== currentUserId && (
                      <div className="relative inline-block">
                        <button
                          onClick={() => setMenuOpenFor(menuOpenFor === u.id ? null : u.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuOpenFor === u.id && (
                          <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={() => {
                                setMenuOpenFor(null);
                                handleDelete(u.id, u.full_name);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} /> Remove user
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} amSuperAdmin={amSuperAdmin} />}
    </div>
  );
}

function InviteModal({ onClose, amSuperAdmin }: { onClose: () => void; amSuperAdmin: boolean }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const assignableRoles = amSuperAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r !== "admin" && r !== "super_admin");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await inviteUser({ fullName, email, role });
    setLoading(false);

    if (!res.success) {
      setError(res.error || "Something went wrong.");
      return;
    }
    setSent(true);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md animate-fade-in rounded-2xl bg-white p-6 shadow-xl">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Mail size={22} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Invite sent</h3>
            <p className="mt-1 text-sm text-slate-500">
              {email} will receive an email to set their password and sign in.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 className="mb-4 text-base font-semibold text-slate-900">Invite a new user</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="e.g. Nimal Perera"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="name@techmo.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AppRole)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send invite"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
