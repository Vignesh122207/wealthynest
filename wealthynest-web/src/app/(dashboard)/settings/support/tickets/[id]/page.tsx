"use client";

import {use, useState} from "react";
import {ArrowLeft, Loader2, Send, ShieldCheck} from "lucide-react";
import Link from "next/link";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {useAddReply, useTicket} from "@/features/support/hooks/useSupport";
import type {TicketPriority, TicketStatus} from "@/features/support/types/support.types";
import {cn} from "@/lib/utils";

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  OPEN:        { label: "Open",        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  IN_PROGRESS: { label: "In Progress", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  RESOLVED:    { label: "Resolved",    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  CLOSED:      { label: "Closed",      color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20" },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; bar: string }> = {
  LOW:    { label: "Low",    color: "text-slate-600 dark:text-slate-400",        bar: "bg-slate-400" },
  MEDIUM: { label: "Medium", color: "text-amber-600 dark:text-amber-400",        bar: "bg-amber-400" },
  HIGH:   { label: "High",   color: "text-orange-600 dark:text-orange-400",      bar: "bg-orange-500" },
  URGENT: { label: "Urgent", color: "text-red-600 dark:text-red-400",            bar: "bg-red-500" },
};

const CATEGORY_LABEL: Record<string, string> = {
  BUG_REPORT: "🐛 Bug Report", FEATURE_REQUEST: "✨ Feature Request",
  ACCOUNT_ISSUE: "👤 Account Issue", DATA_SYNC_ISSUE: "🔄 Data / Sync",
  GENERAL_QUESTION: "❓ General Question",
};

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: ticket, isLoading } = useTicket(id);
  const { mutate: addReply, isPending } = useAddReply(id);
  const [message, setMessage] = useState("");

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    addReply({ message: message.trim() }, { onSuccess: () => setMessage("") });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Ticket" subtitle="Support ticket details and conversation" />
        <PageWrapper>
          <div className="max-w-lg md:max-w-2xl mx-auto space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />)}
          </div>
        </PageWrapper>
      </div>
    );
  }

  if (!ticket) return null;

  const statusCfg   = STATUS_CONFIG[ticket.status];
  const priorityCfg = PRIORITY_CONFIG[ticket.priority];
  const isClosed    = ticket.status === "CLOSED" || ticket.status === "RESOLVED";

  return (
    <div className="flex flex-col flex-1">
      <Header title="Ticket" subtitle="Support ticket details and conversation" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-2xl mx-auto space-y-5">

          <Link href="/settings/support/tickets"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            My Tickets
          </Link>

          {/* Ticket header */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className={cn("h-1 w-full", priorityCfg.bar)} />
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3 justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">{CATEGORY_LABEL[ticket.category]}</p>
                  <p className="text-base font-semibold text-foreground leading-snug">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {new Date(ticket.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    {" · "}Priority: <span className={cn("font-medium", priorityCfg.color)}>{priorityCfg.label}</span>
                  </p>
                </div>
                <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0", statusCfg.color)}>
                  {statusCfg.label}
                </span>
              </div>
              <div className="pt-3 border-t border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </div>
            </div>
          </div>

          {/* Thread */}
          {(ticket.replies?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Replies</p>
              {ticket.replies!.map(r => (
                <div key={r.id}
                  className={cn(
                    "rounded-2xl px-4 py-3.5 space-y-1.5",
                    r.adminReply
                      ? "bg-blue-500/8 border border-blue-500/20"
                      : "bg-card border border-border"
                  )}>
                  <div className="flex items-center gap-2">
                    {r.adminReply
                      ? <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full bg-muted shrink-0" />
                    }
                    <p className={cn("text-xs font-semibold", r.adminReply ? "text-blue-600 dark:text-blue-400" : "text-foreground")}>
                      {r.adminReply ? "WealthyNest Support" : "You"}
                    </p>
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(r.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap pl-5">{r.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply box */}
          {isClosed ? (
            <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-2xl py-5 border border-border">
              This ticket is {ticket.status.toLowerCase()}.{" "}
              <Link href="/settings/support/tickets/new" className="text-blue-600 dark:text-blue-400 hover:underline">
                Open a new ticket
              </Link>{" "}
              if you need further help.
            </div>
          ) : (
            <form onSubmit={handleReply} className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Add a reply</p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your reply..."
                className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
              />
              <button type="submit" disabled={isPending || !message.trim()}
                className="flex items-center gap-2 bg-gradient-to-br from-blue-700 to-blue-600 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send reply
              </button>
            </form>
          )}

        </div>
      </PageWrapper>
    </div>
  );
}
