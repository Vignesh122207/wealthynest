import {ChevronRight, Loader2, ShieldCheck, Ticket, TrendingUp, UserCheck, UserPlus, Users, UserX} from "lucide-react";
import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,} from "recharts";
import {StatCard} from "@/components/shared/StatCard";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {useUserGrowth} from "@/features/admin/hooks/useAdmin";
import type {UserGrowthPoint} from "@/features/admin/api/admin.api";

type Tab = "overview" | "users" | "tickets" | "audit" | "jobs";

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

export function OverviewTab({ stats, openTickets, onNavigate }: {
  stats?: Record<string, number>;
  openTickets?: { count: number };
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Total users"    value={String(stats?.totalUsers        ?? "—")} icon={Users}       tone="indigo" />
        <StatCard title="Active"         value={String(stats?.activeUsers       ?? "—")} icon={UserCheck}   tone="emerald" />
        <StatCard title="Inactive"       value={String(stats?.inactiveUsers     ?? "—")} icon={UserX}       tone="red" />
        <StatCard title="Admins"         value={String(stats?.adminUsers        ?? "—")} icon={ShieldCheck} tone="orange" />
        <StatCard title="New this month" value={String(stats?.newUsersThisMonth ?? "—")} icon={UserPlus}    tone="violet" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <PremiumIcon icon={TrendingUp} tone="indigo" size="xs" />
          <h2 className="text-sm font-semibold text-foreground">User Growth</h2>
          <span className="text-xs text-muted-foreground">— last 12 months</span>
        </div>
        <div className="px-2 py-4"><UserGrowthChart /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => onNavigate("users")}
          className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors text-left group">
          <PremiumIcon icon={Users} tone="indigo" size="md" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Manage Users</p>
            <p className="text-xs text-muted-foreground">{stats?.totalUsers ?? 0} registered users</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        </button>

        <button onClick={() => onNavigate("tickets")}
          className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors text-left group">
          <PremiumIcon icon={Ticket} tone="violet" size="md" className="shrink-0"
            badge={(openTickets?.count ?? 0) > 0 ? openTickets!.count : undefined} />
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
