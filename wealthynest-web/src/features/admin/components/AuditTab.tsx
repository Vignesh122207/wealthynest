import { useState } from "react";
import { RefreshCw, History, Filter, Search, X } from "lucide-react";
import { PaginationBar, PAGE_SIZE_OPTIONS } from "./PaginationBar";
import { useAdminAuditLogs } from "@/features/admin/hooks/useAdmin";
import type { AuditLogEntry } from "@/features/admin/api/admin.api";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

const ACTION_FILTER_OPTIONS = [
  { value: "",                    label: "All actions" },
  { value: "USER_ACTIVATED",      label: "User activated" },
  { value: "USER_DEACTIVATED",    label: "User deactivated" },
  { value: "USER_ROLE_CHANGED",   label: "Role changed" },
  { value: "USER_PASSWORD_RESET", label: "Password reset" },
  { value: "LOGIN",               label: "Login" },
  { value: "CREATE",              label: "Create" },
  { value: "UPDATE",              label: "Update" },
  { value: "DELETE",              label: "Delete" },
];

const ACTION_COLOR: Record<string, string> = {
  DEACTIVATED:  "text-red-500 bg-red-500/10",
  ACTIVATED:    "text-emerald-500 bg-emerald-500/10",
  ROLE_CHANGED: "text-indigo-500 bg-indigo-500/10",
  RESET:        "text-amber-500 bg-amber-500/10",
  CREATE:       "text-emerald-500 bg-emerald-500/10",
  UPDATE:       "text-indigo-500 bg-indigo-500/10",
  DELETE:       "text-red-500 bg-red-500/10",
  LOGIN:        "text-amber-500 bg-amber-500/10",
};

function getActionColor(action: string) {
  const key = Object.keys(ACTION_COLOR).find(k => action.includes(k)) ?? "";
  return ACTION_COLOR[key] ?? "text-muted-foreground bg-muted";
}
function formatAction(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function formatEntityType(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function AuditTab() {
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState("");
  const [emailFilter, setEmailFilter]   = useState("");
  const debouncedEmail = useDebounce(emailFilter, 400);

  const { data, isLoading } = useAdminAuditLogs(page, pageSize, undefined, actionFilter || undefined);
  const logs          = data?.data ?? [];
  const totalPages    = data?.meta?.totalPages    ?? 1;
  const totalElements = data?.meta?.totalElements ?? 0;

  const filtered = debouncedEmail
    ? logs.filter(l => l.userEmail?.toLowerCase().includes(debouncedEmail.toLowerCase()))
    : logs;

  function handleActionChange(v: string) { setActionFilter(v); setPage(0); }
  function handleEmailChange(v: string)  { setEmailFilter(v);  setPage(0); }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 shrink-0">
          <History className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Audit Log</h2>
          {totalElements > 0 && <span className="text-xs text-muted-foreground">({totalElements})</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden sm:inline">Show</span>
            <div className="flex border border-border rounded-xl overflow-hidden text-xs">
              {PAGE_SIZE_OPTIONS.map(s => (
                <button key={s} onClick={() => { setPageSize(s); setPage(0); }}
                  className={cn("px-2.5 py-1.5 transition-colors",
                    pageSize === s ? "bg-indigo-500/20 text-indigo-400 font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="relative flex items-center">
            <Filter className="absolute left-2.5 w-3 h-3 text-muted-foreground pointer-events-none" />
            <select value={actionFilter} onChange={e => handleActionChange(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 appearance-none cursor-pointer">
              {ACTION_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input value={emailFilter} onChange={e => handleEmailChange(e.target.value)}
              placeholder="Filter by email…"
              className="pl-7 pr-7 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-40" />
            {emailFilter && (
              <button onClick={() => handleEmailChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {actionFilter || emailFilter ? "No events match the current filters." : "No audit events recorded yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left bg-muted/30">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Time</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Performed by</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Entity</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((log: AuditLogEntry) => (
                <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground">{log.userEmail ?? <span className="text-muted-foreground">system</span>}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", getActionColor(log.action))}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {(() => {
                      const affected = (log.newValue?.email as string | undefined) ?? (log.oldValue?.email as string | undefined);
                      return affected ? (
                        <span className="text-foreground">{affected}</span>
                      ) : log.entityType ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="text-foreground font-medium">{formatEntityType(log.entityType)}</span>
                          {log.entityId && <span className="font-mono text-[10px] opacity-50">{log.entityId.toString().slice(0, 8)}…</span>}
                        </span>
                      ) : "—";
                    })()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar page={page} totalPages={totalPages} totalElements={totalElements} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}
