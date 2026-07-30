"use client";

import {useState} from "react";
import {
    ArrowLeft,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Circle,
    Clock,
    Loader2,
    MessageSquare,
    RefreshCw,
    Search,
    Send,
    ShieldCheck,
    Ticket,
    X,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {
    useAdminReply,
    useAdminTicket,
    useAdminTickets,
    useAdminUpdateStatus,
} from "@/features/support/hooks/useSupport";
import {useDebounce} from "@/hooks/useDebounce";
import type {Ticket as TicketType, TicketPriority, TicketStatus} from "@/features/support/types/support.types";
import {cn} from "@/lib/utils";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const STATUS_CONFIG: Record<TicketStatus, {
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
    badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20",
    activePill: "bg-slate-500 text-white border-slate-500 shadow-sm",
    icon: XCircle,
    dot: "bg-slate-400",
  },
};

const PRIORITY_CONFIG: Record<TicketPriority, {
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

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string }> = {
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
  const { data: ticket, isLoading }                          = useAdminTicket(ticketId);
  const { mutate: sendReply, isPending: sendingReply }       = useAdminReply(ticketId);
  const { mutate: updateStatus, isPending: updatingStatus }  = useAdminUpdateStatus(ticketId);
  const [reply, setReply] = useState("");

  if (isLoading || !ticket) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  const cat = CATEGORY_CONFIG[ticket.category];
  const pri = PRIORITY_CONFIG[ticket.priority];
  const sts = STATUS_CONFIG[ticket.status];
  const StatusIcon = sts.icon;

  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> All Tickets
      </button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className={cn("h-1.5 w-full", pri.bar)} />
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 justify-between">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{cat?.emoji}</span>
                <span className="text-xs font-medium text-muted-foreground">{cat?.label}</span>
              </div>
              <p className="text-base font-semibold text-foreground leading-snug">{ticket.subject}</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-indigo-500">{userInitial(ticket.userName)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{ticket.userName ?? "Unknown"}</span>
                  {ticket.userEmail && <span> · {ticket.userEmail}</span>}
                </p>
              </div>
              <p className="text-xs text-muted-foreground/80">
                {new Date(ticket.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
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

      {/* Manage — visual button pickers */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Manage</p>

        {/* Status picker */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(s => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              const isActive = ticket.status === s;
              return (
                <button key={s}
                  onClick={() => !isActive && updateStatus({ status: s })}
                  disabled={updatingStatus}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                    isActive
                      ? cfg.activePill
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                  {updatingStatus && isActive
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
            {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map(p => {
              const cfg = PRIORITY_CONFIG[p];
              const isActive = ticket.priority === p;
              return (
                <button key={p}
                  onClick={() => !isActive && updateStatus({ priority: p })}
                  disabled={updatingStatus}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                    isActive
                      ? cfg.activePill
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
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
              <button type="submit" disabled={sendingReply || !reply.trim()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Reply
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-2xl py-5 border border-border">
          <XCircle className="w-4 h-4 text-muted-foreground" />
          This ticket is closed — no further replies can be sent.
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
  const StatusIcon = sts.icon;

  return (
    <button onClick={onClick}
      className="w-full flex items-stretch bg-card border border-border rounded-2xl overflow-hidden hover:border-indigo-500/30 hover:shadow-sm transition-all group text-left">
      <div className={cn("w-1.5 shrink-0", pri.bar)} />
      <div className="flex-1 min-w-0 px-4 py-3.5 space-y-2.5">
        {/* Row 1 */}
        <div className="flex items-start gap-3 justify-between">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-muted-foreground">{userInitial(ticket.userName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate leading-snug">{ticket.subject}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {ticket.userName ?? "Unknown"}
                {ticket.userEmail && <span> · {ticket.userEmail}</span>}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-indigo-500 transition-colors shrink-0 mt-1" />
        </div>

        {/* Row 2 — badges */}
        <div className="flex items-center gap-2 flex-wrap pl-10">
          <span className="text-base shrink-0">{cat?.emoji}</span>

          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", sts.badge)}>
            <StatusIcon className="w-2.5 h-2.5" />
            {sts.label}
          </span>

          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border", pri.badge)}>
            <div className={cn("w-1.5 h-1.5 rounded-full", pri.dot)} />
            {pri.label}
          </span>

          {ticket.replyCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="w-3 h-3" /> {ticket.replyCount}
            </span>
          )}

          <span className="ml-auto text-[11px] text-muted-foreground">
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
      <Header title="Support Tickets" subtitle="Review and respond to user support requests" />
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
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
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

                {/* Status pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["", ...STATUS_OPTIONS].map(s => {
                    const isActive = statusFilter === s;
                    const cfg = s ? STATUS_CONFIG[s as TicketStatus] : null;
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
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />}
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
