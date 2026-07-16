"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Users, Ticket, History, Clock, LayoutDashboard,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useAdminStats } from "@/features/admin/hooks/useAdmin";
import { useOpenTicketCount } from "@/features/support/hooks/useSupport";
import { OverviewTab } from "@/features/admin/components/OverviewTab";
import { UsersTab } from "@/features/admin/components/UsersTab";
import { TicketsTab } from "@/features/admin/components/TicketsTab";
import { AuditTab } from "@/features/admin/components/AuditTab";
import { JobsTab } from "@/features/admin/components/JobsTab";
import { cn } from "@/lib/utils";

type Tab = "overview" | "users" | "tickets" | "audit" | "jobs";

// Same per-type solid-fill template as Investments/Accounts/Debts/Transactions/Categories.
const TAB_ACTIVE_BG: Record<Tab, string> = {
  overview: "bg-indigo-600",
  users:    "bg-emerald-600",
  tickets:  "bg-violet-600",
  audit:    "bg-amber-600",
  jobs:     "bg-sky-600",
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
      <Header title="Admin" subtitle="System oversight, scheduled jobs, and platform health" />
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
                      ? cn(TAB_ACTIVE_BG[t.id], "text-white")
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
