"use client";

import { ArrowLeft, Plus, Ticket, ChevronRight, MessageSquare, Clock } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { useMyTickets } from "@/features/support/hooks/useSupport";
import type { TicketStatus, TicketPriority } from "@/features/support/types/support.types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  OPEN:        { label: "Open",        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  IN_PROGRESS: { label: "In Progress", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  RESOLVED:    { label: "Resolved",    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  CLOSED:      { label: "Closed",      color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20" },
};

const PRIORITY_BAR: Record<TicketPriority, string> = {
  LOW: "bg-slate-400", MEDIUM: "bg-amber-400", HIGH: "bg-orange-500", URGENT: "bg-red-500",
};

const CATEGORY_EMOJI: Record<string, string> = {
  BUG_REPORT: "🐛", FEATURE_REQUEST: "✨", ACCOUNT_ISSUE: "👤",
  DATA_SYNC_ISSUE: "🔄", GENERAL_QUESTION: "❓",
};

export default function MyTicketsPage() {
  const { data, isLoading, isError, refetch } = useMyTickets(0);
  const tickets = data?.data ?? [];

  return (
    <div className="flex flex-col flex-1">
      <Header title="My Tickets" subtitle="Track the status of your support requests" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-4xl mx-auto space-y-5">

          <div className="flex items-center justify-between">
            <Link href="/settings"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Settings
            </Link>
            <Link href="/settings/support/tickets/new"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl transition-colors">
              <Plus className="w-3.5 h-3.5" />
              New ticket
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="bg-card border border-border rounded-2xl">
              <QueryErrorState onRetry={() => refetch()} description="Couldn't load your tickets. Check your connection and try again." />
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl">
              <EmptyState
                icon={Ticket}
                title="No tickets yet"
                description="Open a ticket whenever you hit an issue or have a question."
                action={
                  <Link href="/settings/support/tickets/new"
                    className="inline-flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Create your first ticket
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-2">
              {tickets.map(t => {
                const cfg = STATUS_CONFIG[t.status];
                return (
                  <Link key={t.id} href={`/settings/support/tickets/${t.id}`}
                    className="flex items-stretch bg-card border border-border rounded-2xl overflow-hidden hover:bg-muted/30 transition-colors group">
                    {/* Priority bar */}
                    <div className={cn("w-1 shrink-0", PRIORITY_BAR[t.priority])} />
                    <div className="flex-1 min-w-0 px-4 py-3.5">
                      <div className="flex items-start gap-2 justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg shrink-0">{CATEGORY_EMOJI[t.category] ?? "❓"}</span>
                          <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", cfg.color)}>
                          {cfg.label}
                        </span>
                        {t.replyCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MessageSquare className="w-3 h-3" /> {t.replyCount}
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(t.updatedAt ?? t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

        </div>
      </PageWrapper>
    </div>
  );
}
