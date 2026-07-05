"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Users, ShieldCheck, UserCheck, UserX, RefreshCw,
  ChevronLeft, ChevronRight, Play, Clock, CheckCircle2,
  XCircle, Loader2, Pencil, Check, Search, KeyRound, History, X,
  Filter, TrendingUp, UserPlus, Ticket, Send, ArrowLeft, MessageSquare,
  LayoutDashboard, Circle, AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  useAdminStats, useAdminUsers, useToggleUserActive, useUpdateUserRole,
  useAdminJobs, useTriggerJob, useUpdateJobSchedule, useResetUserPassword,
  useAdminAuditLogs, useUserGrowth,
} from "@/features/admin/hooks/useAdmin";
import {
  useAdminTickets, useAdminTicket, useAdminReply, useAdminUpdateStatus,
  useOpenTicketCount,
} from "@/features/support/hooks/useSupport";
import type { JobScheduleConfig, AuditLogEntry, UserGrowthPoint } from "@/features/admin/api/admin.api";
import type { TicketStatus, TicketPriority, Ticket as TicketType } from "@/features/support/types/support.types";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import type { User } from "@/features/auth/types/auth.types";

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = "overview" | "users" | "tickets" | "audit" | "jobs";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function PaginationBar({ page, totalPages, totalElements, pageSize, onPage }: {
  page: number; totalPages: number; totalElements: number; pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = page * pageSize + 1;
  const end   = Math.min((page + 1) * pageSize, totalElements);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground">{start}–{end} of {totalElements}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(0)} disabled={page === 0}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground text-xs font-medium px-2">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 0}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => onPage(totalPages - 1)} disabled={page >= totalPages - 1}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground text-xs font-medium px-2">»</button>
      </div>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

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

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value?: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tabular-nums leading-none mb-0.5">{value ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function GrowthTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label ? formatMonthLabel(label) : ""}</p>
      <p className="font-semibold text-foreground">{payload[0].value} new {payload[0].value === 1 ? "user" : "users"}</p>
    </div>
  );
}

function UserGrowthChart() {
  const { data = [], isLoading } = useUserGrowth();
  if (isLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if ((data as UserGrowthPoint[]).length === 0) return <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No growth data yet</div>;
  const chartData = (data as UserGrowthPoint[]).map(d => ({ month: d.month, count: Number(d.count) }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<GrowthTooltip />} />
        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#growthGrad)"
          dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function OverviewTab({ stats, openTickets, onNavigate }: {
  stats?: Record<string, number>;
  openTickets?: { count: number };
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total users"   value={stats?.totalUsers}        icon={Users}      color="bg-indigo-600/15 text-indigo-500" />
        <StatCard label="Active"         value={stats?.activeUsers}       icon={UserCheck}  color="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Inactive"       value={stats?.inactiveUsers}     icon={UserX}      color="bg-red-500/15 text-red-500" />
        <StatCard label="Admins"         value={stats?.adminUsers}        icon={ShieldCheck} color="bg-amber-500/15 text-amber-500" />
        <StatCard label="New this month" value={stats?.newUsersThisMonth} icon={UserPlus}   color="bg-violet-500/15 text-violet-500" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-foreground">User Growth</h2>
          <span className="text-xs text-muted-foreground">— last 12 months</span>
        </div>
        <div className="px-2 py-4"><UserGrowthChart /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => onNavigate("users")}
          className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors text-left group">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Manage Users</p>
            <p className="text-xs text-muted-foreground">{stats?.totalUsers ?? 0} registered users</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        </button>

        <button onClick={() => onNavigate("tickets")}
          className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors text-left group">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0 relative">
            <Ticket className="w-5 h-5 text-violet-500" />
            {(openTickets?.count ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {openTickets!.count}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Support Tickets</p>
            <p className="text-xs text-muted-foreground">
              {(openTickets?.count ?? 0) > 0 ? `${openTickets!.count} open ticket${openTickets!.count > 1 ? "s" : ""}` : "No open tickets"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        </button>
      </div>
    </div>
  );
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
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
  const { mutate: resetPassword, isPending: resetting } = useResetUserPassword();

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
                        className="text-xs bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Send password reset?</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  A reset link will be emailed to the user. Their current password stays valid until they use the link.
                </p>
              </div>
              <button onClick={() => setResetConfirmId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setResetConfirmId(null)}
                className="text-sm px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={() => { resetPassword(resetConfirmId); setResetConfirmId(null); }}
                disabled={resetting}
                className="flex items-center gap-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-60">
                {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Send reset email
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tickets tab ──────────────────────────────────────────────────────────────

const TICKET_STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const TICKET_STATUS_CONFIG: Record<TicketStatus, {
  label: string;
  badge: string;
  activePill: string;
  icon: React.ElementType;
  dot: string;
}> = {
  OPEN:        {
    label: "Open",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    activePill: "bg-blue-500 text-white border-blue-500 shadow-sm",
    icon: Circle,
    dot: "bg-blue-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    activePill: "bg-amber-500 text-white border-amber-500 shadow-sm",
    icon: Clock,
    dot: "bg-amber-500",
  },
  RESOLVED:    {
    label: "Resolved",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    activePill: "bg-emerald-500 text-white border-emerald-500 shadow-sm",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
  },
  CLOSED:      {
    label: "Closed",
    badge: "bg-slate-500/10 text-slate-500 border border-slate-500/20",
    activePill: "bg-slate-500 text-white border-slate-500 shadow-sm",
    icon: XCircle,
    dot: "bg-slate-400",
  },
};

const TICKET_PRIORITY_CONFIG: Record<TicketPriority, {
  label: string;
  bar: string;
  dot: string;
  badge: string;
  activePill: string;
}> = {
  LOW:    {
    label: "Low",
    bar: "bg-slate-400",
    dot: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20",
    activePill: "bg-slate-500 text-white border-slate-500 shadow-sm",
  },
  MEDIUM: {
    label: "Medium",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    activePill: "bg-amber-500 text-white border-amber-500 shadow-sm",
  },
  HIGH:   {
    label: "High",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
    activePill: "bg-orange-500 text-white border-orange-500 shadow-sm",
  },
  URGENT: {
    label: "Urgent",
    bar: "bg-red-500",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
    activePill: "bg-red-500 text-white border-red-500 shadow-sm",
  },
};

const TICKET_CATEGORY_CONFIG: Record<string, { emoji: string; label: string }> = {
  BUG_REPORT:       { emoji: "🐛", label: "Bug Report" },
  FEATURE_REQUEST:  { emoji: "✨", label: "Feature Request" },
  ACCOUNT_ISSUE:    { emoji: "👤", label: "Account Issue" },
  DATA_SYNC_ISSUE:  { emoji: "🔄", label: "Data / Sync" },
  GENERAL_QUESTION: { emoji: "❓", label: "General Question" },
};

function userInitial(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { data: ticket, isLoading } = useAdminTicket(ticketId);
  const { mutate: sendReply, isPending: sending }        = useAdminReply(ticketId);
  const { mutate: updateStatus, isPending: updating }    = useAdminUpdateStatus(ticketId);
  const [reply, setReply] = useState("");

  if (isLoading || !ticket) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />)}</div>;
  }

  const pri = TICKET_PRIORITY_CONFIG[ticket.priority];
  const sts = TICKET_STATUS_CONFIG[ticket.status];
  const cat = TICKET_CATEGORY_CONFIG[ticket.category];
  const StatusIcon = sts.icon;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> All Tickets
      </button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className={cn("h-1.5 w-full", pri.bar)} />
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 justify-between">
            <div className="flex-1 min-w-0 space-y-2">
              {/* Category */}
              <div className="flex items-center gap-2">
                <span className="text-base">{cat?.emoji}</span>
                <span className="text-xs font-medium text-muted-foreground">{cat?.label}</span>
              </div>
              {/* Subject */}
              <p className="text-base font-semibold text-foreground leading-snug">{ticket.subject}</p>
              {/* User info */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-indigo-500">{userInitial(ticket.userName)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{ticket.userName ?? "Unknown"}</span>
                  {ticket.userEmail && <span className="opacity-60"> · {ticket.userEmail}</span>}
                </p>
              </div>
              <p className="text-xs text-muted-foreground/60">
                {new Date(ticket.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            {/* Status badge */}
            <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0", sts.badge)}>
              <StatusIcon className="w-3 h-3" />
              {sts.label}
            </span>
          </div>

          <div className="pt-4 border-t border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {ticket.description}
          </div>
        </div>
      </div>

      {/* Manage section — visual button pickers */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Manage</p>

        {/* Status picker */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Status</p>
          <div className="flex flex-wrap gap-2">
            {TICKET_STATUS_OPTIONS.map(s => {
              const cfg = TICKET_STATUS_CONFIG[s];
              const Icon = cfg.icon;
              const isActive = ticket.status === s;
              return (
                <button key={s}
                  onClick={() => !isActive && updateStatus({ status: s })}
                  disabled={updating}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                    isActive
                      ? cfg.activePill
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/80"
                  )}>
                  {updating && isActive
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Icon className="w-3 h-3" />
                  }
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority picker */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Priority</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TICKET_PRIORITY_CONFIG) as TicketPriority[]).map(p => {
              const cfg = TICKET_PRIORITY_CONFIG[p];
              const isActive = ticket.priority === p;
              return (
                <button key={p}
                  onClick={() => !isActive && updateStatus({ priority: p })}
                  disabled={updating}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                    isActive
                      ? cfg.activePill
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/80"
                  )}>
                  <div className={cn("w-2 h-2 rounded-full shrink-0", isActive ? "bg-white/80" : cfg.dot)} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Thread */}
      {(ticket.replies?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
            Thread · {ticket.replies!.length} {ticket.replies!.length === 1 ? "message" : "messages"}
          </p>
          {ticket.replies!.map(r => (
            <div key={r.id} className={cn(
              "rounded-2xl border overflow-hidden",
              r.adminReply ? "border-indigo-500/20" : "border-border"
            )}>
              {/* Bubble header */}
              <div className={cn(
                "flex items-center gap-2.5 px-4 py-2.5",
                r.adminReply ? "bg-indigo-500/8" : "bg-muted/40"
              )}>
                {r.adminReply ? (
                  <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground">{userInitial(r.authorName)}</span>
                  </div>
                )}
                <p className={cn("text-xs font-semibold flex-1", r.adminReply ? "text-indigo-600 dark:text-indigo-400" : "text-foreground")}>
                  {r.adminReply ? `${r.authorName} · Support` : r.authorName}
                </p>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(r.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {/* Message body */}
              <div className={cn("px-4 py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap",
                r.adminReply ? "bg-indigo-500/4" : "bg-card")}>
                {r.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply */}
      {ticket.status !== "CLOSED" ? (
        <form onSubmit={e => { e.preventDefault(); if (reply.trim()) sendReply({ message: reply.trim() }, { onSuccess: () => setReply("") }); }}
          className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3 h-3 text-white" />
            </div>
            <p className="text-xs font-semibold text-foreground">Reply as Support</p>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={4}
              placeholder="Write your reply to the user…"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{reply.length > 0 ? `${reply.length} chars` : ""}</span>
              <button type="submit" disabled={sending || !reply.trim()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Reply
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-2xl py-5 border border-border">
          <XCircle className="w-4 h-4 text-slate-400" />
          This ticket is closed — no further replies can be sent.
        </div>
      )}
    </div>
  );
}

// ─── Ticket card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, onClick }: { ticket: TicketType; onClick: () => void }) {
  const pri = TICKET_PRIORITY_CONFIG[ticket.priority];
  const sts = TICKET_STATUS_CONFIG[ticket.status];
  const cat = TICKET_CATEGORY_CONFIG[ticket.category];
  const StatusIcon = sts.icon;

  return (
    <button onClick={onClick}
      className="w-full flex items-stretch bg-card border border-border rounded-2xl overflow-hidden hover:border-indigo-500/30 hover:shadow-sm transition-all group text-left">
      {/* Priority bar */}
      <div className={cn("w-1.5 shrink-0", pri.bar)} />

      {/* Content */}
      <div className="flex-1 min-w-0 px-4 py-3.5 space-y-2.5">
        {/* Row 1: subject + chevron */}
        <div className="flex items-start gap-3 justify-between">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-muted-foreground">{userInitial(ticket.userName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate leading-snug">{ticket.subject}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {ticket.userName ?? "Unknown"}
                {ticket.userEmail && <span className="opacity-60"> · {ticket.userEmail}</span>}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-indigo-500 transition-colors shrink-0 mt-1" />
        </div>

        {/* Row 2: meta badges */}
        <div className="flex items-center gap-2 flex-wrap pl-10">
          {/* Category */}
          <span className="text-base shrink-0">{cat?.emoji}</span>

          {/* Status badge */}
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", sts.badge)}>
            <StatusIcon className="w-2.5 h-2.5" />
            {sts.label}
          </span>

          {/* Priority badge */}
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border", pri.badge)}>
            <div className={cn("w-1.5 h-1.5 rounded-full", pri.dot)} />
            {pri.label}
          </span>

          {/* Reply count */}
          {ticket.replyCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="w-3 h-3" /> {ticket.replyCount}
            </span>
          )}

          {/* Date */}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Tickets tab ──────────────────────────────────────────────────────────────

function TicketsTab() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(0);
  const [selectedId, setSelectedId]     = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 350);
  const { data, isLoading } = useAdminTickets(statusFilter, page, 15);
  const tickets       = data?.data ?? [];
  const totalPages    = data?.meta?.totalPages    ?? 1;
  const totalElements = data?.meta?.totalElements ?? 0;

  const filtered = debouncedSearch
    ? tickets.filter(t =>
        t.subject.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.userName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.userEmail?.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : tickets;

  function handleStatusChange(s: string) { setStatusFilter(s); setPage(0); }
  function handleSearchChange(v: string) { setSearch(v); setPage(0); }

  if (selectedId) return <TicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search by subject, name, or email…"
            className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          {search && (
            <button onClick={() => handleSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["", ...TICKET_STATUS_OPTIONS].map(s => {
            const isActive = statusFilter === s;
            const cfg = s ? TICKET_STATUS_CONFIG[s as TicketStatus] : null;
            const Icon = cfg?.icon;
            return (
              <button key={s} onClick={() => handleStatusChange(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
                  isActive
                    ? s === ""
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                      : cfg!.activePill
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                {Icon && <Icon className="w-3 h-3" />}
                {s === "" ? "All" : cfg!.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            {totalElements > 0 && <span className="text-xs text-muted-foreground">{totalElements} total</span>}
            {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Ticket list */}
      {!isLoading && filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Ticket className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No tickets found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {statusFilter || debouncedSearch ? "Try adjusting your filters" : "No support tickets yet"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t: TicketType) => (
            <TicketCard key={t.id} ticket={t} onClick={() => setSelectedId(t.id)} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="bg-card border border-border rounded-2xl">
          <PaginationBar page={page} totalPages={totalPages} totalElements={totalElements} pageSize={15} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

// ─── Audit tab ────────────────────────────────────────────────────────────────

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

function AuditTab() {
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

// ─── Jobs tab ─────────────────────────────────────────────────────────────────

function JobStatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">Never run</span>;
  const map: Record<string, { cls: string; Icon: React.ElementType; label: string }> = {
    SUCCESS: { cls: "text-emerald-500", Icon: CheckCircle2, label: "Success" },
    FAILED:  { cls: "text-red-500",     Icon: XCircle,      label: "Failed" },
    RUNNING: { cls: "text-amber-500",   Icon: Loader2,      label: "Running" },
  };
  const s = map[status] ?? map.FAILED;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", s.cls)}>
      <s.Icon className={cn("w-3.5 h-3.5", status === "RUNNING" && "animate-spin")} />
      {s.label}
    </span>
  );
}

function CronEditor({ job, onSave }: { job: JobScheduleConfig; onSave: (cron: string) => void }) {
  const parts   = job.cronExpression.split(" ");
  const initH   = parts[2] ?? "20";
  const initM   = parts[1] ?? "0";
  const isRange = initH.includes("-") || initH.includes("/") || initM.includes("/");
  const [open, setOpen] = useState(false);
  const [h, setH]       = useState(isRange ? "" : initH.padStart(2, "0"));
  const [m, setM]       = useState(isRange ? "" : initM.padStart(2, "0"));
  const [raw, setRaw]   = useState(job.cronExpression);
  const [mode, setMode] = useState<"simple" | "raw">(isRange ? "raw" : "simple");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Clock className="w-3.5 h-3.5" />{job.cronExpression}<Pencil className="w-3 h-3 opacity-60" />
      </button>
    );
  }

  function buildCron() {
    if (mode === "raw") return raw.trim();
    parts[1] = String(parseInt(m, 10));
    parts[2] = String(parseInt(h, 10));
    return parts.join(" ");
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 text-xs border border-border rounded-md overflow-hidden">
        <button onClick={() => setMode("simple")} className={cn("px-2 py-1 transition-colors", mode === "simple" ? "bg-indigo-500/20 text-indigo-400" : "hover:bg-muted text-muted-foreground")}>Time</button>
        <button onClick={() => setMode("raw")} className={cn("px-2 py-1 transition-colors", mode === "raw" ? "bg-indigo-500/20 text-indigo-400" : "hover:bg-muted text-muted-foreground")}>Cron</button>
      </div>
      {mode === "simple" ? (
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={23} value={h} onChange={e => setH(e.target.value.padStart(2, "0"))}
            className="w-12 text-xs text-center bg-background border border-border rounded-lg px-1 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <span className="text-muted-foreground text-xs">:</span>
          <input type="number" min={0} max={59} value={m} onChange={e => setM(e.target.value.padStart(2, "0"))}
            className="w-12 text-xs text-center bg-background border border-border rounded-lg px-1 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <span className="text-[10px] text-muted-foreground">IST</span>
        </div>
      ) : (
        <input value={raw} onChange={e => setRaw(e.target.value)}
          className="w-44 text-xs bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono" />
      )}
      <button onClick={() => { onSave(buildCron()); setOpen(false); }}
        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors">
        <Check className="w-3.5 h-3.5" /> Save
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
    </div>
  );
}

function JobsTab() {
  const { data: jobs = [], isLoading }                                        = useAdminJobs();
  const { mutate: trigger, isPending: triggering, variables: triggeringJob }  = useTriggerJob();
  const { mutate: updateSchedule }                                            = useUpdateJobSchedule();

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Scheduled Jobs</h2>
        {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="divide-y divide-border">
        {jobs.map((job: JobScheduleConfig) => (
          <div key={job.jobName} className="px-4 py-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{job.displayName}</p>
                <CronEditor job={job} onSave={cron => updateSchedule({ jobName: job.jobName, cron })} />
              </div>
              <button onClick={() => trigger(job.jobName)} disabled={triggering && triggeringJob === job.jobName}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600/15 text-indigo-500 hover:bg-indigo-600/25 border border-indigo-500/20 transition-colors disabled:opacity-50 shrink-0">
                {triggering && triggeringJob === job.jobName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run now
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <JobStatusBadge status={job.lastRunStatus} />
              {job.lastRunAt && <span>{new Date(job.lastRunAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
              {job.lastRunMessage && <span className="text-red-400 truncate max-w-[200px]" title={job.lastRunMessage}>{job.lastRunMessage}</span>}
            </div>
          </div>
        ))}
        {jobs.length === 0 && !isLoading && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No jobs configured</p>}
      </div>
    </div>
  );
}

// ─── Admin Page ──────────────────────────────────────────────────────────────

const TAB_ACTIVE_STYLES: Record<Tab, string> = {
  overview: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  users:    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  tickets:  "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  audit:    "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  jobs:     "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
};

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users",    label: "Users",    icon: Users },
  { id: "tickets",  label: "Tickets",  icon: Ticket },
  { id: "audit",    label: "Audit Log", icon: History },
  { id: "jobs",     label: "Jobs",     icon: Clock },
];

export default function AdminPage() {
  const { user }   = useAuthStore();
  const router     = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: stats }      = useAdminStats();
  const { data: openTickets } = useOpenTicketCount();

  useEffect(() => {
    if (user && user.role !== "ADMIN") router.replace("/dashboard");
  }, [user, router]);

  if (!user || user.role !== "ADMIN") return null;

  return (
    <div className="flex flex-col flex-1">
      <Header title="Admin" />
      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-24 lg:pb-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* Tab bar */}
          <div className="flex items-center gap-1 bg-muted/60 rounded-2xl p-1 overflow-x-auto">
            {TABS.map(t => {
              const isActive = tab === t.id;
              const showBadge = t.id === "tickets" && (openTickets?.count ?? 0) > 0;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center relative",
                    isActive
                      ? cn("shadow-sm border", TAB_ACTIVE_STYLES[t.id])
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}>
                  <t.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {showBadge && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {openTickets!.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {tab === "overview" && <OverviewTab stats={stats} openTickets={openTickets} onNavigate={setTab} />}
          {tab === "users"    && <UsersTab />}
          {tab === "tickets"  && <TicketsTab />}
          {tab === "audit"    && <AuditTab />}
          {tab === "jobs"     && <JobsTab />}

        </div>
      </main>
    </div>
  );
}
