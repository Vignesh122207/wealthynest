"use client";

import { useState, useMemo } from "react";
import {
  Users, Plus, LogIn, Copy, Check, Crown,
  Shield, ShieldOff, Loader2, Pencil, Trash2, LogOut, X, Info,
  UserMinus, BarChart2, AlertTriangle, ChevronRight, ChevronLeft,
  TrendingUp, Target, ArrowDownLeft, ArrowUpRight, PiggyBank, Trophy,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  useFamily, useFamilyMembers, useCreateFamily, useJoinFamily,
  useRenameFamily, useLeaveFamily, useDeleteFamily, useRemoveMember,
  useTransferAdmin, useRevokeAdmin, useFamilyExpenses, useFamilyNetWorth, useFamilyMonthlyStats,
} from "@/features/family/hooks/useFamily";
import { useBudgets } from "@/features/budgets/hooks/useBudgets";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useChartTheme } from "@/hooks/useChartTheme";
import { cn, formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { FamilyMember } from "@/features/family/types/family.types";

const MAX_MEMBERS   = 6;
const MEMBER_COLORS = ["#6366f1","#22c55e","#f59e0b","#06b6d4","#8b5cf6","#ec4899"];

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";
const firstName = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean)[0] || name;

type Mode =
  | "idle" | "create" | "join" | "rename"
  | "makeAdmin" | "revokeAdmin" | "confirmRemove"
  | "confirmLeave" | "adminLeave" | "confirmDelete";

// ─── Slot indicator ───────────────────────────────────────────────────────────

function SlotBar({ count }: { count: number }) {
  const isFull = count >= MAX_MEMBERS;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: MAX_MEMBERS }).map((_, i) => (
          <div key={i} className={cn(
            "w-3.5 h-3.5 rounded-full border-2 transition-all",
            i < count
              ? isFull ? "bg-amber-400 border-amber-400" : "bg-indigo-500 border-indigo-500"
              : "bg-transparent border-border"
          )} />
        ))}
      </div>
      <span className={cn("text-xs font-semibold tabular-nums", isFull ? "text-amber-500" : "text-muted-foreground")}>
        {count} / {MAX_MEMBERS}{isFull && " · Full"}
      </span>
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member, isSelf, isCurrentUserAdmin, color, onMakeAdmin, onRevokeAdmin, onRemove,
}: {
  member: FamilyMember; isSelf: boolean; isCurrentUserAdmin: boolean; color: string;
  onMakeAdmin: (m: FamilyMember) => void; onRevokeAdmin: (m: FamilyMember) => void; onRemove: (m: FamilyMember) => void;
}) {
  const memberIsAdmin   = member.role === "FAMILY_ADMIN" || member.role === "ADMIN";
  const canRevokeAdmin  = memberIsAdmin && member.role !== "ADMIN"; // can't revoke app-level ADMIN
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: color + "26" }}>
        <span className="text-xs font-bold" style={{ color }}>{initials(member.fullName)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground truncate">{member.fullName}</p>
          {isSelf && <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">You</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      {memberIsAdmin ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-500 shrink-0">
          <Crown className="w-3 h-3" /> Admin
        </span>
      ) : (
        <span className="text-[11px] font-medium px-2 py-1 rounded-lg bg-muted text-muted-foreground shrink-0">Member</span>
      )}
      {isCurrentUserAdmin && !isSelf && (
        <div className="flex items-center gap-1 shrink-0">
          {!memberIsAdmin && (
            <button onClick={() => onMakeAdmin(member)} title="Make admin"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all">
              <Crown className="w-3.5 h-3.5" />
            </button>
          )}
          {canRevokeAdmin && (
            <button onClick={() => onRevokeAdmin(member)} title="Revoke admin"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-all">
              <ShieldOff className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onRemove(member)} title="Remove from family"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
            <UserMinus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Admin-leave modal ────────────────────────────────────────────────────────

function AdminLeaveModal({
  open, familyName, nonAdminMembers, memberColorMap, targetMember, setTargetMember,
  onConfirm, onCancel, transferring, leaving,
}: {
  open: boolean; familyName: string; nonAdminMembers: FamilyMember[];
  memberColorMap: Map<string, string>; targetMember: FamilyMember | null;
  setTargetMember: (m: FamilyMember | null) => void;
  onConfirm: () => void; onCancel: () => void;
  transferring: boolean; leaving: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Transfer admin before leaving</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Select a member to become the new admin, then you will leave{" "}
              <span className="font-medium text-foreground">{familyName}</span>.
            </p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {nonAdminMembers.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted/60 rounded-xl px-3 py-2.5">
            No other members to transfer to. Remove all members first, or delete the group.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
            {nonAdminMembers.map((m, i) => (
              <button key={m.id}
                onClick={() => setTargetMember(targetMember?.id === m.id ? null : m)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                  targetMember?.id === m.id
                    ? "bg-indigo-500/10 border-indigo-500/40"
                    : "bg-muted/40 border-border hover:border-indigo-500/30"
                )}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: (memberColorMap.get(m.id) ?? MEMBER_COLORS[i]) + "26" }}>
                  <span className="text-[10px] font-bold" style={{ color: memberColorMap.get(m.id) ?? MEMBER_COLORS[i] }}>
                    {initials(m.fullName)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                {targetMember?.id === m.id && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onConfirm} disabled={!targetMember || transferring || leaving}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-60">
            {(transferring || leaving) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Transfer & Leave
          </button>
          <button onClick={onCancel}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const now = new Date();

  const { user }                     = useAuthStore();
  const { data: family, isLoading }  = useFamily();
  const { data: members = [] }       = useFamilyMembers(family?.id);
  const chart                        = useChartTheme();
  const { data: familyNetWorth = 0 } = useFamilyNetWorth(family?.id);
  const { data: monthlyStats }       = useFamilyMonthlyStats(family?.id, now.getFullYear(), now.getMonth() + 1);
  const [mode, setMode]             = useState<Mode>("idle");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [renameName, setRenameName] = useState("");
  const [copied, setCopied]         = useState(false);
  const [targetMember, setTargetMember] = useState<FamilyMember | null>(null);
  const [drillMemberId, setDrillMemberId] = useState<string | null>(null);

  const [chartYear,  setChartYear]  = useState(now.getFullYear());
  const [chartMonth, setChartMonth] = useState(now.getMonth() + 1);
  const chartMonthLabel = new Date(chartYear, chartMonth - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const isCurrentChartMonth = chartYear === now.getFullYear() && chartMonth === now.getMonth() + 1;

  const navigateChart = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentChartMonth) return;
    let m = chartMonth + dir, y = chartYear;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setChartMonth(m); setChartYear(y); setDrillMemberId(null);
  };

  const mm = String(chartMonth).padStart(2, "0");
  const firstOfMonth = `${chartYear}-${mm}-01`;
  const lastDay      = new Date(chartYear, chartMonth, 0).getDate();
  const lastOfMonth  = `${chartYear}-${mm}-${String(lastDay).padStart(2, "0")}`;

  const { data: monthExpenses = [] } = useFamilyExpenses(family?.id, firstOfMonth, lastOfMonth);

  const { data: budgets = [] } = useBudgets(now.getFullYear(), now.getMonth() + 1);

  const memberColorMap = useMemo(
    () => new Map(members.map((m, i) => [m.id, MEMBER_COLORS[i % MEMBER_COLORS.length]])),
    [members]
  );

  const memberSpending = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses) map.set(e.userId, (map.get(e.userId) ?? 0) + e.amount);
    return members
      .map((m, i) => ({ id: m.id, name: firstName(m.fullName), amount: map.get(m.id) ?? 0, color: MEMBER_COLORS[i % MEMBER_COLORS.length], fullName: m.fullName }))
      .filter(m => m.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses, members]);

  const totalMonthSpend = memberSpending.reduce((s, m) => s + m.amount, 0);

  const drillExpenses = useMemo(
    () => drillMemberId ? monthExpenses.filter(e => e.userId === drillMemberId) : [],
    [monthExpenses, drillMemberId]
  );
  const drillByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of drillExpenses) { const cat = e.categoryName ?? "Other"; map.set(cat, (map.get(cat) ?? 0) + e.amount); }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [drillExpenses]);
  const drillMember = members.find(m => m.id === drillMemberId);
  const drillTotal  = drillExpenses.reduce((s, e) => s + e.amount, 0);

  const recentFamilyExpenses = useMemo(
    () => [...monthExpenses].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)).slice(0, 15),
    [monthExpenses]
  );
  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m.fullName])), [members]);

  const { mutate: createFamily,  isPending: creating   } = useCreateFamily();
  const { mutate: joinFamily,    isPending: joining    } = useJoinFamily();
  const { mutate: renameFamily,  isPending: renaming   } = useRenameFamily();
  const { mutate: leaveFamily,   isPending: leaving    } = useLeaveFamily();
  const { mutate: deleteFamily,  isPending: deleting   } = useDeleteFamily();
  const { mutate: removeMember,  isPending: removing   } = useRemoveMember(family?.id);
  const { mutate: transferAdmin, isPending: transferring} = useTransferAdmin(family?.id);
  const { mutate: revokeAdmin,   isPending: revoking    } = useRevokeAdmin(family?.id);

  const hasFamily = !!user?.familyId;
  const isAdmin   = user?.role === "FAMILY_ADMIN" || user?.role === "ADMIN";
  const isFull    = members.length >= MAX_MEMBERS;
  const nonAdminMembers = members.filter(m => m.role !== "FAMILY_ADMIN" && m.role !== "ADMIN" && m.id !== user?.id);

  const reset = () => { setMode("idle"); setTargetMember(null); };

  const handleCreate = () => {
    if (!familyName.trim()) return;
    createFamily(familyName.trim(), { onSuccess: () => { reset(); setFamilyName(""); } });
  };
  const handleJoin = () => {
    if (!inviteCode.trim()) return;
    joinFamily(inviteCode.trim().toUpperCase(), { onSuccess: () => { reset(); setInviteCode(""); } });
  };
  const handleRename = () => {
    if (!renameName.trim() || !family) return;
    renameFamily({ id: family.id, name: renameName.trim() }, { onSuccess: () => { reset(); setRenameName(""); } });
  };
  const handleMakeAdmin = () => {
    if (!targetMember || !family) return;
    transferAdmin(targetMember.id, { onSuccess: () => reset() });
  };
  const handleRevokeAdmin = () => {
    if (!targetMember) return;
    revokeAdmin(targetMember.id, { onSuccess: () => reset() });
  };
  const handleRemove = () => {
    if (!targetMember) return;
    removeMember(targetMember.id, { onSuccess: () => reset() });
  };
  const handleLeave = () => {
    leaveFamily(undefined, { onSuccess: () => reset() });
  };
  const handleTransferAndLeave = () => {
    if (!targetMember || !family) return;
    transferAdmin(targetMember.id, { onSuccess: () => leaveFamily(undefined, { onSuccess: () => reset() }) });
  };
  const handleDelete = () => {
    if (!family) return;
    deleteFamily(family.id, { onSuccess: () => reset() });
  };

  const copyCode = () => {
    if (!family?.inviteCode) return;
    navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Danger-zone section (always rendered at the very bottom) ─────────────────
  const DangerZone = () => {
    if (mode === "confirmLeave") {
      return (
        <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium text-foreground">
            Leave <span className="font-semibold">{family?.name}</span>? Your personal data stays in your account.
          </p>
          <div className="flex gap-2">
            <button onClick={handleLeave} disabled={leaving}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-60">
              {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              Yes, leave
            </button>
            <button onClick={reset} className="h-9 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
          </div>
        </div>
      );
    }

    if (mode === "confirmDelete") {
      return (
        <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium text-foreground">
            Delete <span className="font-semibold">{family?.name}</span>? All {members.length} members will be removed.
            Everyone's individual data stays in their own accounts.
          </p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-60">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Yes, delete group
            </button>
            <button onClick={reset} className="h-9 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
          </div>
        </div>
      );
    }

    // idle — show buttons
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-red-500/70 uppercase tracking-widest px-0.5">Danger Zone</p>
        <div className="bg-card border border-red-500/20 rounded-2xl p-4 flex flex-wrap gap-2">
          {isAdmin ? (
            <>
              <button
                onClick={() => members.length <= 1 ? setMode("confirmLeave") : setMode("adminLeave")}
                className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-red-600 dark:text-red-500 bg-red-500/8 border border-red-500/30 hover:bg-red-500/15 transition-all">
                <LogOut className="w-3.5 h-3.5" /> Leave Group
              </button>
              <button onClick={() => setMode("confirmDelete")}
                className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-red-600 dark:text-red-500 bg-red-500/8 border border-red-500/30 hover:bg-red-500/15 transition-all">
                <Trash2 className="w-3.5 h-3.5" /> Delete Group
              </button>
            </>
          ) : (
            <button onClick={() => setMode("confirmLeave")} disabled={leaving}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-red-600 dark:text-red-500 bg-red-500/8 border border-red-500/30 hover:bg-red-500/15 transition-all disabled:opacity-60">
              <LogOut className="w-3.5 h-3.5" /> Leave Group
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1">
      <Header title="Family" />
      <PageWrapper>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>

        ) : hasFamily && family ? (
          /* ── Family Dashboard ─────────────────────────── */
          <div className="max-w-6xl space-y-4">

            {/* ── Top stats ── */}
            {/* Row 1: Net Worth hero + Invite code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Net Worth — hero card */}
              <div className="sm:col-span-2 bg-gradient-to-br from-indigo-600/10 to-violet-600/8 border border-indigo-500/20 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo-400/80 uppercase tracking-wider mb-0.5">Family Net Worth</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{formatCurrency(familyNetWorth)}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">{members.length} member{members.length !== 1 ? "s" : ""} combined</p>
                </div>
              </div>

              {/* Invite code */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Invite Code</span>
                  <SlotBar count={members.length} />
                </div>
                {isFull ? (
                  <p className="text-xs text-amber-500">Group full — remove a member to allow new joins</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold tracking-widest text-indigo-400">{family.inviteCode}</span>
                    <button onClick={copyCode}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 transition-all">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: This Month stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Income */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Income</span>
                </div>
                <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400 tabular-nums leading-none">
                  {monthlyStats ? formatCurrency(monthlyStats.totalIncome) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">This month</p>
              </div>

              {/* Expense */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center">
                    <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Expense</span>
                </div>
                <p className="text-lg font-bold text-red-500 dark:text-red-400 tabular-nums leading-none">
                  {monthlyStats ? formatCurrency(monthlyStats.totalExpense) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">This month</p>
              </div>

              {/* Savings */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center",
                    monthlyStats && monthlyStats.savings < 0 ? "bg-amber-500/15" : "bg-sky-500/15")}>
                    <PiggyBank className={cn("w-3.5 h-3.5",
                      monthlyStats && monthlyStats.savings < 0 ? "text-amber-500" : "text-sky-500")} />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Savings</span>
                </div>
                <p className={cn("text-lg font-bold tabular-nums leading-none",
                  monthlyStats && monthlyStats.savings < 0
                    ? "text-amber-500"
                    : "text-sky-500 dark:text-sky-400")}>
                  {monthlyStats ? formatCurrency(monthlyStats.savings) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">This month</p>
              </div>

              {/* Highest Spender */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Top Spender</span>
                </div>
                {monthlyStats?.highestSpenderName ? (
                  <>
                    <p className="text-sm font-bold text-foreground truncate leading-none">
                      {firstName(monthlyStats.highestSpenderName)}
                    </p>
                    <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 tabular-nums mt-1">
                      {formatCurrency(monthlyStats.highestSpenderAmount!)}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold text-muted-foreground/40 leading-none">—</p>
                )}
              </div>
            </div>

            {/* Main 2-col layout on desktop */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">

              {/* ── Left column ─────────────────────────────── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Family header card */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600/15 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {mode === "rename" ? (
                        <div className="flex items-center gap-2">
                          <input value={renameName} onChange={e => setRenameName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") reset(); }}
                            className="h-8 px-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-indigo-500 w-36"
                            autoFocus />
                          <button onClick={handleRename} disabled={!renameName.trim() || renaming}
                            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-60 transition-all flex items-center gap-1.5">
                            {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                          </button>
                          <button onClick={reset} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-foreground truncate">{family.name}</h2>
                          {isAdmin && (
                            <button onClick={() => { setRenameName(family.name); setMode("rename"); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      <div className={cn("flex items-center gap-1.5 mt-0.5 text-xs font-semibold", isAdmin ? "text-amber-500" : "text-indigo-400")}>
                        {isAdmin && <Crown className="w-3 h-3" />}
                        {isAdmin ? "You are the admin" : "Member"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Members list */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Members</h3>
                    {isFull && (
                      <span className="text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Full</span>
                    )}
                  </div>
                  <div className="divide-y divide-border">
                    {members.map((m, i) => (
                      <MemberRow key={m.id} member={m} isSelf={m.id === user?.id}
                        isCurrentUserAdmin={isAdmin} color={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                        onMakeAdmin={m => { setTargetMember(m); setMode("makeAdmin"); }}
                        onRevokeAdmin={m => { setTargetMember(m); setMode("revokeAdmin"); }}
                        onRemove={m => { setTargetMember(m); setMode("confirmRemove"); }}
                      />
                    ))}
                  </div>
                </div>

                {/* Budget Overview */}
                {budgets.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-violet-400" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Budget Overview — {now.toLocaleString("en-IN", { month: "long" })}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {budgets.slice(0, 6).map(b => {
                        const pct = Math.min(b.percentUsed, 100);
                        return (
                          <div key={b.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground">{b.categoryName ?? "Budget"}</span>
                              <span className={cn("text-xs font-semibold tabular-nums", b.overBudget ? "text-red-400" : "text-muted-foreground")}>
                                {formatCurrencyCompact(b.spent)} / {formatCurrencyCompact(b.amount)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all",
                                  b.overBudget ? "bg-red-500" : pct >= b.alertThreshold ? "bg-amber-500" : "bg-indigo-500")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {budgets.length > 6 && <p className="text-xs text-muted-foreground text-right">+{budgets.length - 6} more</p>}
                    </div>
                    {budgets.some(b => b.overBudget) && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {budgets.filter(b => b.overBudget).length} budget{budgets.filter(b => b.overBudget).length > 1 ? "s" : ""} over limit
                      </div>
                    )}
                  </div>
                )}

              </div>{/* end left col */}

              {/* ── Right column ────────────────────────────── */}
              <div className="lg:col-span-3 space-y-4">

                {/* Per-member spending chart */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-sm font-semibold text-foreground">Member Spending</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => navigateChart(-1)}
                        className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-all">
                        <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <span className="text-xs text-muted-foreground min-w-[7.5rem] text-center">{chartMonthLabel}</span>
                      <button onClick={() => navigateChart(1)} disabled={isCurrentChartMonth}
                        className={cn("w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
                          isCurrentChartMonth ? "bg-muted/40 border-border/40 opacity-30 cursor-not-allowed" : "bg-muted hover:bg-muted/80 border-border")}>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {memberSpending.length > 0 ? "Click a bar to see breakdown" : "No expenses recorded"}
                  </p>

                  {memberSpending.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={Math.max(120, memberSpending.length * 44)}>
                        <BarChart data={memberSpending} layout="vertical" barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} horizontal={false} />
                          <XAxis type="number" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                            tickFormatter={v => formatCurrencyCompact(v)} />
                          <YAxis type="category" dataKey="name" tick={{ fill: chart.axisColor, fontSize: 12 }}
                            axisLine={false} tickLine={false} width={72} />
                          <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                            cursor={chart.cursorStyle}
                            formatter={(v: number, _: string, props: any) => [formatCurrency(v), props.payload?.fullName ?? "Spending"]} />
                          <Bar dataKey="amount" radius={[0, 6, 6, 0]} style={{ cursor: "pointer" }}
                            onClick={(data: any) => setDrillMemberId(prev => prev === data.id ? null : data.id)}>
                            {memberSpending.map((m, i) => (
                              <Cell key={i} fill={m.color} opacity={drillMemberId && drillMemberId !== m.id ? 0.35 : 1} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                        {memberSpending.map((m, i) => (
                          <button key={i} onClick={() => setDrillMemberId(prev => prev === m.id ? null : m.id)}
                            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                            <span className="text-xs text-muted-foreground">{m.fullName}</span>
                            <span className="text-xs font-semibold text-foreground tabular-nums">{formatCurrencyCompact(m.amount)}</span>
                          </button>
                        ))}
                      </div>

                      {/* Drilldown panel */}
                      {drillMemberId && drillMember && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                                style={{ background: (memberColorMap.get(drillMemberId) ?? "#6366f1") + "26" }}>
                                <span className="text-[9px] font-bold" style={{ color: memberColorMap.get(drillMemberId) ?? "#6366f1" }}>
                                  {initials(drillMember.fullName)}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-foreground">{drillMember.fullName}</p>
                              <span className="text-xs text-muted-foreground">· {drillExpenses.length} expense{drillExpenses.length !== 1 ? "s" : ""}</span>
                            </div>
                            <button onClick={() => setDrillMemberId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {drillByCategory.map(([cat, amt]) => (
                              <div key={cat} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-1.5 rounded-full shrink-0" style={{
                                    width: `${Math.round((amt / drillTotal) * 80)}px`,
                                    background: memberColorMap.get(drillMemberId) ?? "#6366f1", opacity: 0.6,
                                  }} />
                                  <span className="text-xs text-foreground truncate">{cat}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-muted-foreground/60">{((amt / drillTotal) * 100).toFixed(0)}%</span>
                                  <span className="text-xs font-semibold tabular-nums text-red-400">−{formatCurrencyCompact(amt)}</span>
                                </div>
                              </div>
                            ))}
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                              <span className="text-xs font-semibold text-muted-foreground">Total</span>
                              <span className="text-xs font-bold tabular-nums text-red-400">−{formatCurrency(drillTotal)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-muted-foreground">No expenses recorded for {chartMonthLabel}</p>
                    </div>
                  )}
                </div>

                {/* Shared activity feed */}
                {recentFamilyExpenses.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Shared Activity</h3>
                      <span className="text-xs text-muted-foreground">{chartMonthLabel}</span>
                    </div>
                    <div className="space-y-2.5">
                      {recentFamilyExpenses.map(e => {
                        const who    = memberMap.get(e.userId);
                        const color  = memberColorMap.get(e.userId) ?? "#6366f1";
                        const dayStr = new Date(e.expenseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                        return (
                          <div key={e.id} className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: color + "26" }}>
                              <span className="text-[9px] font-bold" style={{ color }}>{who ? initials(who) : "?"}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{e.description || e.categoryName || "Expense"}</p>
                              <p className="text-[10px] text-muted-foreground/60">
                                {who ? firstName(who) : "Member"} · {dayStr}
                                {e.categoryName && e.description && <span className="ml-1 text-muted-foreground/40">· {e.categoryName}</span>}
                              </p>
                            </div>
                            <p className="text-xs font-semibold text-red-500 dark:text-red-400 tabular-nums shrink-0">−{formatCurrency(e.amount)}</p>
                          </div>
                        );
                      })}
                      {monthExpenses.length > 15 && (
                        <div className="pt-1 text-center">
                          <span className="text-xs text-muted-foreground/60">+{monthExpenses.length - 15} more this month</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>{/* end right col */}
            </div>{/* end grid */}

            {/* Danger zone — always at the bottom on all screen sizes */}
            <DangerZone />

          </div>

        ) : (
          /* ── No Family ─────────────────────────────────── */
          <div className="max-w-lg space-y-4">
            <div className="flex gap-2.5 p-3.5 bg-muted/60 border border-border rounded-xl">
              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                A family group connects up to 6 members — shared expense tracking, budgets, and net worth.
                Create a group and share the invite code, or enter a code to join an existing group.
              </p>
            </div>

            {mode === "idle" && (
              <>
                <div className="text-center pt-2 pb-1">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/15 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-7 h-7 text-indigo-400" />
                  </div>
                  <h2 className="text-base font-bold text-foreground mb-1">No family group yet</h2>
                  <p className="text-sm text-muted-foreground">Create a new group or join one with an invite code.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button onClick={() => setMode("create")}
                    className="flex flex-col items-center gap-3 p-6 bg-card border border-border hover:border-indigo-500/40 hover:bg-indigo-600/5 rounded-2xl transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/15 group-hover:bg-indigo-600/25 flex items-center justify-center transition-all">
                      <Plus className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground mb-1">Create a Family</p>
                      <p className="text-xs text-muted-foreground">Start a new group and invite up to 5 others</p>
                    </div>
                  </button>
                  <button onClick={() => setMode("join")}
                    className="flex flex-col items-center gap-3 p-6 bg-card border border-border hover:border-emerald-500/40 hover:bg-emerald-600/5 rounded-2xl transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/15 group-hover:bg-emerald-600/25 flex items-center justify-center transition-all">
                      <LogIn className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground mb-1">Join a Family</p>
                      <p className="text-xs text-muted-foreground">Enter an invite code to join a group</p>
                    </div>
                  </button>
                </div>
              </>
            )}

            {mode === "create" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/15 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Create a Family</h3>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Family Name</label>
                  <input value={familyName} onChange={e => setFamilyName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreate()}
                    placeholder="e.g. The Kumars, Smith Family"
                    className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 transition-colors"
                    autoFocus />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleCreate} disabled={!familyName.trim() || creating}
                    className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : "Create Family"}
                  </button>
                  <button onClick={() => { reset(); setFamilyName(""); }}
                    className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mode === "join" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/15 flex items-center justify-center">
                    <LogIn className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Join a Family</h3>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Invite Code</label>
                  <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && handleJoin()}
                    placeholder="e.g. AB12CD34" maxLength={8}
                    className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-sm font-mono text-foreground placeholder-muted-foreground tracking-widest focus:outline-none focus:border-emerald-500 transition-colors uppercase"
                    autoFocus />
                  <p className="text-xs text-muted-foreground">Ask your family admin for the 8-character invite code.</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleJoin} disabled={inviteCode.length < 4 || joining}
                    className="flex-1 h-10 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                    {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : "Join Family"}
                  </button>
                  <button onClick={() => { reset(); setInviteCode(""); }}
                    className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </PageWrapper>

      {/* ── Confirmation modals ───────────────────────────────────────────── */}
      <ConfirmDialog
        open={mode === "makeAdmin" && !!targetMember}
        title={`Make ${targetMember?.fullName ?? ""} an admin?`}
        description="They will be able to manage the family. You keep your admin access too."
        confirmLabel="Make Admin"
        onConfirm={handleMakeAdmin}
        onCancel={reset}
      />
      <ConfirmDialog
        open={mode === "revokeAdmin" && !!targetMember}
        title={`Revoke admin from ${targetMember?.fullName ?? ""}?`}
        description="They will become a regular member and lose admin privileges."
        confirmLabel="Revoke Admin"
        danger
        onConfirm={handleRevokeAdmin}
        onCancel={reset}
      />
      <ConfirmDialog
        open={mode === "confirmRemove" && !!targetMember}
        title={`Remove ${targetMember?.fullName ?? ""}?`}
        description="They will be removed from the family group. Their personal data stays in their own account."
        confirmLabel="Remove"
        danger
        onConfirm={handleRemove}
        onCancel={reset}
      />
      <AdminLeaveModal
        open={mode === "adminLeave"}
        familyName={family?.name ?? ""}
        nonAdminMembers={nonAdminMembers}
        memberColorMap={memberColorMap}
        targetMember={targetMember}
        setTargetMember={m => setTargetMember(m)}
        onConfirm={handleTransferAndLeave}
        onCancel={reset}
        transferring={transferring}
        leaving={leaving}
      />
    </div>
  );
}
