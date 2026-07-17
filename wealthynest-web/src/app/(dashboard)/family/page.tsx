"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  useFamily, useFamilyMembers, useCreateFamily, useJoinFamily,
  useRenameFamily, useLeaveFamily, useDeleteFamily, useRemoveMember,
  useTransferAdmin, useRevokeAdmin, useFamilyExpenses, useFamilyNetWorth, useFamilyMonthlyStats,
} from "@/features/family/hooks/useFamily";
import { AdminLeaveModal } from "@/features/family/components/AdminLeaveModal";
import { SplitsCard } from "@/features/expensesplits/components/SplitsCard";
import { MAX_MEMBERS, MEMBER_COLORS } from "@/features/family/constants";
import { useBudgets } from "@/features/budgets/hooks/useBudgets";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import type { FamilyMember } from "@/features/family/types/family.types";
import { DangerZone } from "./_components/DangerZone";
import { NoFamilyOnboarding } from "./_components/NoFamilyOnboarding";
import { FamilyOverviewStats } from "./_components/FamilyOverviewStats";
import { FamilyHeaderCard } from "./_components/FamilyHeaderCard";
import { MembersListCard } from "./_components/MembersListCard";
import { BudgetOverviewCard } from "./_components/BudgetOverviewCard";
import { MemberSpendingChart } from "./_components/MemberSpendingChart";
import { SharedActivityFeed } from "./_components/SharedActivityFeed";

type Mode =
  | "idle" | "create" | "join" | "rename"
  | "makeAdmin" | "revokeAdmin" | "confirmRemove"
  | "confirmLeave" | "adminLeave" | "confirmDelete";

const firstName = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean)[0] || name;

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const { fmt, fmtC } = useAmountFormatter();
  const now = new Date();

  const { user }                     = useAuthStore();
  const { data: family, isLoading, isError, refetch } = useFamily();
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
  // Deleting a family group removes every other member's shared connection in one click-through
  // — typing the group's name back is the same friction GitHub-style "type to confirm" uses for
  // any action whose blast radius goes beyond the person clicking it.
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

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
  const { mutate: removeMember  }                         = useRemoveMember(family?.id);
  const { mutate: transferAdmin, isPending: transferring} = useTransferAdmin(family?.id);
  const { mutate: revokeAdmin   }                         = useRevokeAdmin(family?.id);

  const hasFamily = !!user?.familyId;
  const isAdmin   = user?.role === "FAMILY_ADMIN" || user?.role === "ADMIN";
  const isFull    = members.length >= MAX_MEMBERS;
  const nonAdminMembers = members.filter(m => m.role !== "FAMILY_ADMIN" && m.role !== "ADMIN" && m.id !== user?.id);

  const reset = () => { setMode("idle"); setTargetMember(null); setDeleteConfirmText(""); };

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

  return (
    <div className="flex flex-col flex-1">
      <Header title="Family" subtitle="Manage shared accounts and members in your family circle" />
      <PageWrapper>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>

        ) : isError ? (
          // Distinct from "no family yet" below — hasFamily (from the auth store) can be true
          // while `family` itself is still undefined here, and falling through to the "create
          // or join a family" onboarding hero for an existing member whose request just failed
          // would read as if their group had vanished.
          <QueryErrorState onRetry={() => refetch()} description="Couldn't load your family. Check your connection and try again." />

        ) : hasFamily && family ? (
          /* ── Family Dashboard ─────────────────────────── */
          <div className="space-y-4">

            <FamilyOverviewStats family={family} membersCount={members.length} familyNetWorth={familyNetWorth}
              isFull={isFull} copied={copied} copyCode={copyCode} monthlyStats={monthlyStats} fmt={fmt} />

            {/* Main 2-col layout on desktop */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">

              {/* ── Left column ─────────────────────────────── */}
              <div className="lg:col-span-2 space-y-4">
                <FamilyHeaderCard family={family} mode={mode} isAdmin={isAdmin}
                  renameName={renameName} setRenameName={setRenameName} handleRename={handleRename} renaming={renaming}
                  onEnterRename={() => { setRenameName(family.name); setMode("rename"); }} onReset={reset} />

                <MembersListCard members={members} currentUserId={user?.id} isAdmin={isAdmin} isFull={isFull}
                  onMakeAdmin={m => { setTargetMember(m); setMode("makeAdmin"); }}
                  onRevokeAdmin={m => { setTargetMember(m); setMode("revokeAdmin"); }}
                  onRemove={m => { setTargetMember(m); setMode("confirmRemove"); }} />

                {budgets.length > 0 && (
                  <BudgetOverviewCard budgets={budgets} monthLabel={now.toLocaleString("en-IN", { month: "long" })} fmtC={fmtC} />
                )}
              </div>{/* end left col */}

              {/* ── Right column ────────────────────────────── */}
              <div className="lg:col-span-3 space-y-4">
                <MemberSpendingChart
                  memberSpending={memberSpending} chart={chart} chartMonthLabel={chartMonthLabel}
                  navigateChart={navigateChart} isCurrentChartMonth={isCurrentChartMonth}
                  drillMemberId={drillMemberId} setDrillMemberId={setDrillMemberId} drillMember={drillMember}
                  drillExpensesCount={drillExpenses.length} drillByCategory={drillByCategory} drillTotal={drillTotal}
                  memberColorMap={memberColorMap} fmt={fmt} fmtC={fmtC} />

                {recentFamilyExpenses.length > 0 && (
                  <SharedActivityFeed
                    recentFamilyExpenses={recentFamilyExpenses} totalMonthExpenses={monthExpenses.length}
                    memberMap={memberMap} memberColorMap={memberColorMap} chartMonthLabel={chartMonthLabel} fmt={fmt} />
                )}

                <SplitsCard />

              </div>{/* end right col */}
            </div>{/* end grid */}

            {/* Danger zone — always at the bottom on all screen sizes */}
            <DangerZone
              mode={mode} familyName={family.name} membersCount={members.length} isAdmin={isAdmin}
              leaving={leaving} deleting={deleting}
              deleteConfirmText={deleteConfirmText} setDeleteConfirmText={setDeleteConfirmText}
              onLeave={handleLeave} onDelete={handleDelete}
              onEnterConfirmLeave={() => setMode("confirmLeave")}
              onEnterAdminLeave={() => setMode("adminLeave")}
              onEnterConfirmDelete={() => setMode("confirmDelete")}
              onReset={reset} />

          </div>

        ) : (
          <NoFamilyOnboarding
            mode={mode} setMode={setMode}
            familyName={familyName} setFamilyName={setFamilyName}
            inviteCode={inviteCode} setInviteCode={setInviteCode}
            handleCreate={handleCreate} handleJoin={handleJoin}
            creating={creating} joining={joining} reset={reset} />
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
