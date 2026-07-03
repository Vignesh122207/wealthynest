"use client";

import { useState } from "react";
import {
  Loader2, Send, ShieldCheck, ChevronRight, ArrowLeft,
  Search, MessageSquare, Clock, RefreshCw, ChevronLeft, X,
  AlertTriangle, Ticket,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  useAdminTickets, useAdminTicket,
  useAdminReply, useAdminUpdateStatus,
} from "@/features/support/hooks/useSupport";
import { useDebounce } from "@/hooks/useDebounce";
import type { TicketStatus, TicketPriority, Ticket as TicketType } from "@/features/support/types/support.types";
import { cn } from "@/lib/utils";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  OPEN:        { label: "Open",        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  IN_PROGRESS: { label: "In Progress", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  RESOLVED:    { label: "Resolved",    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  CLOSED:      { label: "Closed",      color: "bg-slate-500/10 text-slate-500 border border-slate-500/20" },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; bar: string; text: string }> = {
  LOW:    { label: "Low",    bar: "bg-slate-400",   text: "text-slate-500" },
  MEDIUM: { label: "Medium", bar: "bg-amber-400",   text: "text-amber-600 dark:text-amber-400" },
  HIGH:   { label: "High",   bar: "bg-orange-500",  text: "text-orange-600 dark:text-orange-400" },
  URGENT: { label: "Urgent", bar: "bg-red-500",     text: "text-red-600 dark:text-red-400" },
};

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string }> = {
  BUG_REPORT:       { emoji: "🐛", label: "Bug Report" },
  FEATURE_REQUEST:  { emoji: "✨", label: "Feature Request" },
  ACCOUNT_ISSUE:    { emoji: "👤", label: "Account Issue" },
  DATA_SYNC_ISSUE:  { emoji: "🔄", label: "Data / Sync" },
  GENERAL_QUESTION: { emoji: "❓", label: "General Question" },
};

// ─── Pagination bar ───────────────────────────────────────────────────────────

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
        <button onClick={() => onPage(page - 1)} disabled={page === 0}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// ─── Ticket Detail ────────────────────────────────────────────────────────────

function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { data: ticket, isLoading } = useAdminTicket(ticketId);
  const { mutate: sendReply, isPending: sendingReply }   = useAdminReply(ticketId);
  const { mutate: updateStatus, isPending: updatingStatus } = useAdminUpdateStatus(ticketId);
  const [reply, setReply] = useState("");

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    sendReply({ message: reply.trim() }, { onSuccess: () => setReply("") });
  }

  if (isLoading || !ticket) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  const cat = CATEGORY_CONFIG[ticket.category];
  const pri = PRIORITY_CONFIG[ticket.priority];

  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> All Tickets
      </button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className={cn("h-1 w-full", pri.bar)} />
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3 justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{cat?.emoji}</span>
                <span className="text-xs text-muted-foreground">{cat?.label}</span>
              </div>
              <p className="text-base font-semibold text-foreground leading-snug">{ticket.subject}</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                From: <span className="font-medium text-foreground">{ticket.userName ?? "Unknown"}</span>
                {ticket.userEmail && <span className="opacity-60"> · {ticket.userEmail}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(ticket.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0", STATUS_CONFIG[ticket.status].color)}>
              {STATUS_CONFIG[ticket.status].label}
            </span>
          </div>

          <div className="pt-3 border-t border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {ticket.description}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Manage</p>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <select value={ticket.status}
              onChange={e => updateStatus({ status: e.target.value as TicketStatus })}
              disabled={updatingStatus}
              className="bg-background border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Priority</label>
            <select value={ticket.priority}
              onChange={e => updateStatus({ priority: e.target.value as TicketPriority })}
              disabled={updatingStatus}
              className="bg-background border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
              {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map(p => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
          </div>
          {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground self-end mb-2" />}
        </div>
      </div>

      {/* Thread */}
      {(ticket.replies?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Thread</p>
          {ticket.replies!.map(r => (
            <div key={r.id}
              className={cn(
                "rounded-2xl px-4 py-3.5 space-y-1.5",
                r.adminReply
                  ? "bg-indigo-500/8 border border-indigo-500/20"
                  : "bg-card border border-border"
              )}>
              <div className="flex items-center gap-2">
                {r.adminReply
                  ? <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  : <div className="w-3.5 h-3.5 rounded-full bg-muted-foreground/20 shrink-0" />
                }
                <p className={cn("text-xs font-semibold", r.adminReply ? "text-indigo-600 dark:text-indigo-400" : "text-foreground")}>
                  {r.adminReply ? `${r.authorName} (Support)` : r.authorName}
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

      {/* Reply */}
      {ticket.status !== "CLOSED" ? (
        <form onSubmit={handleReply} className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Reply as Support</p>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={4}
            placeholder="Type your reply to the user..."
            className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
          />
          <button type="submit" disabled={sendingReply || !reply.trim()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Reply
          </button>
        </form>
      ) : (
        <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-2xl py-4 border border-border">
          This ticket is closed.
        </div>
      )}
    </div>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, onClick }: { ticket: TicketType; onClick: () => void }) {
  const cat = CATEGORY_CONFIG[ticket.category];
  const pri = PRIORITY_CONFIG[ticket.priority];
  const sts = STATUS_CONFIG[ticket.status];

  return (
    <button onClick={onClick}
      className="w-full flex items-stretch bg-card border border-border rounded-2xl overflow-hidden hover:bg-muted/30 transition-colors group text-left">
      {/* Priority bar */}
      <div className={cn("w-1 shrink-0", pri.bar)} />
      {/* Content */}
      <div className="flex-1 min-w-0 px-4 py-3.5">
        <div className="flex items-start gap-2 justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-snug">{ticket.subject}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {ticket.userName ?? "Unknown"}
              {ticket.userEmail && <span className="opacity-60"> · {ticket.userEmail}</span>}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-lg shrink-0">{cat?.emoji}</span>
          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", sts.color)}>
            {sts.label}
          </span>
          <span className={cn("text-[11px] font-medium", pri.text)}>{pri.label}</span>
          {ticket.replyCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="w-3 h-3" /> {ticket.replyCount}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function AdminTicketsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(0);
  const [selectedId, setSelectedId]     = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  const { data, isLoading } = useAdminTickets(statusFilter, page, PAGE_SIZE);
  const tickets       = data?.data ?? [];
  const totalPages    = data?.meta?.totalPages    ?? 1;
  const totalElements = data?.meta?.totalElements ?? 0;

  const filtered = debouncedSearch
    ? tickets.filter(t =>
        t.subject.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.userName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.userEmail?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : tickets;

  function handleStatusChange(s: string) { setStatusFilter(s); setPage(0); }
  function handleSearchChange(v: string) { setSearch(v); setPage(0); }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Support Tickets" />
      <PageWrapper>
        <div className="max-w-4xl space-y-5">

          {selectedId ? (
            <TicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <>
              {/* Top nav */}
              <div className="flex items-center justify-between gap-3">
                <Link href="/admin"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Admin
                </Link>
                {totalElements > 0 && (
                  <p className="text-xs text-muted-foreground">{totalElements} total tickets</p>
                )}
              </div>

              {/* Filters */}
              <div className="bg-card border border-border rounded-2xl p-3 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Search by subject, name, or email…"
                    className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  {search && (
                    <button onClick={() => handleSearchChange("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status tabs */}
                <div className="flex items-center gap-1 flex-wrap">
                  {["", ...STATUS_OPTIONS].map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                        statusFilter === s
                          ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
                      )}>
                      {s === "" ? "All" : STATUS_CONFIG[s as TicketStatus].label}
                    </button>
                  ))}
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />}
                </div>
              </div>

              {/* Ticket list */}
              {!isLoading && filtered.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
                  <Ticket className="w-10 h-10 text-muted-foreground/30" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">No tickets found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {statusFilter || debouncedSearch
                        ? "Try adjusting your filters"
                        : "No support tickets have been submitted yet"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(t => (
                    <TicketCard key={t.id} ticket={t} onClick={() => setSelectedId(t.id)} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-card border border-border rounded-2xl">
                  <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    totalElements={totalElements}
                    pageSize={PAGE_SIZE}
                    onPage={setPage}
                  />
                </div>
              )}
            </>
          )}

        </div>
      </PageWrapper>
    </div>
  );
}
