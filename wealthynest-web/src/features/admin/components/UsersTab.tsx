import { useEffect, useState } from "react";
import { RefreshCw, Search, X, KeyRound } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PaginationBar, PAGE_SIZE_OPTIONS } from "./PaginationBar";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  useAdminUsers, useToggleUserActive, useUpdateUserRole, useResetUserPassword,
} from "@/features/admin/hooks/useAdmin";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import type { User } from "@/features/auth/types/auth.types";

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    ADMIN:        "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    FAMILY_ADMIN: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    MEMBER:       "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
  };
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", map[role] ?? map.MEMBER)}>
      {role.toLowerCase().replace("_", " ")}
    </span>
  );
}

export function UsersTab() {
  const { user } = useAuthStore();
  const [page, setPage]                   = useState(0);
  const [search, setSearch]               = useState("");
  const [pageSize, setPageSize]           = useState(20);
  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 350);
  useEffect(() => { setPage(0); }, [debouncedSearch, pageSize]);

  const { data: usersPage, isLoading }               = useAdminUsers(page, debouncedSearch, pageSize);
  const { mutate: toggleActive, isPending: toggling } = useToggleUserActive();
  const { mutate: updateRole }                        = useUpdateUserRole();
  const { mutate: resetPassword } = useResetUserPassword();

  const users         = usersPage?.data ?? [];
  const totalPages    = usersPage?.meta?.totalPages    ?? 1;
  const totalElements = usersPage?.meta?.totalElements ?? 0;

  return (
    <>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground shrink-0">
            All Users
            {totalElements > 0 && <span className="ml-2 text-xs text-muted-foreground font-normal">({totalElements})</span>}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground hidden sm:inline">Show</span>
              <div className="flex border border-border rounded-xl overflow-hidden text-xs">
                {PAGE_SIZE_OPTIONS.map(s => (
                  <button key={s} onClick={() => setPageSize(s)}
                    className={cn("px-2.5 py-1.5 transition-colors",
                      pageSize === s ? "bg-indigo-500/20 text-indigo-400 font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-8 pr-8 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-full sm:w-52" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left bg-muted/30">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Last login</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u: User) => (
                <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{u.fullName}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== user?.id ? (
                      <select value={u.role} onChange={e => updateRole({ id: u.id, role: e.target.value })}
                        className="text-xs bg-background border border-border rounded-xl px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                        <option value="ADMIN">Admin</option>
                        <option value="FAMILY_ADMIN">Family admin</option>
                        <option value="MEMBER">Member</option>
                      </select>
                    ) : <RoleBadge role={u.role} />}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border",
                      u.active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20")}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== user?.id && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleActive(u.id)} disabled={toggling}
                          className={cn("text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50",
                            u.active
                              ? "text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
                              : "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10")}>
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => setResetConfirmId(u.id)} title="Send password reset"
                          className="p-1.5 rounded-lg border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && !isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {debouncedSearch ? `No users found for "${debouncedSearch}"` : "No users found"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={page} totalPages={totalPages} totalElements={totalElements} pageSize={pageSize} onPage={setPage} />
      </div>

      {resetConfirmId && (
        <ConfirmDialog open title="Send password reset?"
          description="A reset link will be emailed to the user. Their current password stays valid until they use the link."
          confirmLabel="Send reset email"
          onConfirm={() => { resetPassword(resetConfirmId); setResetConfirmId(null); }}
          onCancel={() => setResetConfirmId(null)} />
      )}
    </>
  );
}
