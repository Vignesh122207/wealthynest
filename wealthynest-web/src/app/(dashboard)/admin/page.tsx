"use client";

import {useRouter} from "next/navigation";
import {useEffect} from "react";
import dynamic from "next/dynamic";
import {Clock, History, LayoutDashboard, Loader2, Ticket, Users,} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useAdminStats} from "@/features/admin/hooks/useAdmin";
import {useOpenTicketCount} from "@/features/support/hooks/useSupport";
import {UsersTab} from "@/features/admin/components/UsersTab";
import {TicketsTab} from "@/features/admin/components/TicketsTab";
import {AuditTab} from "@/features/admin/components/AuditTab";
import {JobsTab} from "@/features/admin/components/JobsTab";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import {useTabParam} from "@/hooks/useTabParam";

// Lazy-loaded (kept SSR'd — paints on first load, not after a click): pulls in recharts, same
// fix as home/page.tsx's chart widgets (see that file's own comment for the measured cause/effect).
const OverviewTab = dynamic(() => import("@/features/admin/components/OverviewTab").then(m => m.OverviewTab));

const TAB_IDS = ["overview", "users", "tickets", "audit", "jobs"] as const;
type Tab = (typeof TAB_IDS)[number];

// Same per-type template as Investments/Accounts/Debts/Transactions/Categories.
const TAB_COLOR: Record<Tab, string> = {
  overview: "#4f46e5",
  users:    "#059669",
  tickets:  "#7c3aed",
  audit:    "#d97706",
  jobs:     "#0284c7",
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
  const [tab, setTab] = useTabParam<Tab>(TAB_IDS, "overview");

  const { data: stats }      = useAdminStats();
  const { data: openTickets } = useOpenTicketCount();

  useEffect(() => {
    if (user && user.role !== "ADMIN") router.replace("/home");
  }, [user, router]);

  // `user` is already hydrated from the persisted auth store by the time this route is
  // reachable (DashboardLayout gates on that first) — this only covers the single frame
  // before the redirect above commits for a non-admin, so a spinner reads as "loading",
  // not a blank flash of an empty page.
  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Admin" subtitle="System oversight, scheduled jobs, and platform health" />
      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-24 lg:pb-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* Tab bar — shared TabBar template. */}
          <TabBar
            items={TABS.map((t): TabBarItem<Tab> => ({
              key: t.id, label: t.label, icon: t.icon as TabBarItem<Tab>["icon"], color: TAB_COLOR[t.id],
              count: t.id === "tickets" ? openTickets?.count : undefined,
            }))}
            value={tab}
            onChange={setTab}
            testIdPrefix="admin-tab"
          />

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
