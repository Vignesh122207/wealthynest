"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { ArrowUpRight, ArrowDownLeft, Handshake, Wallet, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import {
  useDebts, useCreateDebt, useUpdateDebt,
  useRecordDebtPayment, useDeleteDebt,
} from "@/features/debts/hooks/useDebts";
import type { DebtRecord, DebtType } from "@/features/debts/types/debt.types";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import { DebtFormModal } from "./_components/DebtFormModal";
import { PaymentModal } from "./_components/PaymentModal";
import { DebtCard } from "./_components/DebtCard";
import { Summary } from "./_components/Summary";

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "ALL" | "LENT" | "BORROWED";

// Matches this page's own FAB action colors ("I Lent"=emerald, "I Borrowed"=rose) — same
// per-type solid-fill template as Investments/Accounts/Transactions.
const TAB_ACTIVE_BG: Record<Tab, string> = {
  ALL:      "bg-slate-600",
  LENT:     "bg-emerald-600",
  BORROWED: "bg-rose-600",
};
type Modal = null
  | { mode: "create"; defaultType: DebtType }
  | { mode: "edit";   debt: DebtRecord };

export default function DebtsPage() {
  const { fmt } = useAmountFormatter();
  const [tab,       setTab]       = useState<Tab>("ALL");
  const [modal,     setModal]     = useState<Modal>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const { data: debts = [], isLoading, isError, refetch } = useDebts();
  const { data: accountsData }            = useAccounts();
  const accounts = (accountsData ?? []).filter(a => !a.archived && a.accountType !== "CREDIT_CARD");

  const { mutate: createDebt, isPending: creating } = useCreateDebt();
  const { mutate: updateDebt, isPending: updating } = useUpdateDebt();
  const { mutate: recordPay,  isPending: paying    } = useRecordDebtPayment();
  const { mutate: deleteDebt, isPending: deleting }  = useDeleteDebt();

  const filtered = tab === "ALL" ? debts : debts.filter(d => d.type === tab);
  const payDebt  = debts.find(d => d.id === paymentId);
  const delDebt  = debts.find(d => d.id === deleteId);

  const tabs: { id: Tab; label: string; icon: LucideIcon; count: number }[] = [
    { id: "ALL",      label: "All",      icon: Wallet,        count: debts.length },
    { id: "LENT",     label: "Lent",     icon: ArrowUpRight,  count: debts.filter(d => d.type === "LENT").length },
    { id: "BORROWED", label: "Borrowed", icon: ArrowDownLeft, count: debts.filter(d => d.type === "BORROWED").length },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Debt Tracker" subtitle="Track money you've lent or borrowed, and keep tabs on payoff progress" />
      <PageWrapper>

        {debts.length > 0 && <Summary debts={debts} />}

        {/* Tabs — same template as the Investments page's tab bar. */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 overflow-x-auto max-w-full" style={{ scrollbarWidth: "none" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  tab === t.id ? cn(TAB_ACTIVE_BG[t.id], "text-white") : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.id !== "ALL" && t.count > 0 && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold",
                    tab === t.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-card border border-border rounded-2xl animate-pulse" />)}
          </div>
        ) : isError ? (
          <QueryErrorState onRetry={() => refetch()} description="Couldn't load your debts. Check your connection and try again." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No debts here"
            description={
              tab === "LENT" ? "You haven't lent any money yet." :
              tab === "BORROWED" ? "You haven't borrowed any money yet." :
              "Track money lent to others or borrowed from someone."
            }
            action={
              <div className="flex gap-2">
                <button onClick={() => setModal({ mode: "create", defaultType: "LENT" })}
                  className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
                  <ArrowUpRight className="w-4 h-4" /> I Lent
                </button>
                <button onClick={() => setModal({ mode: "create", defaultType: "BORROWED" })}
                  className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all">
                  <ArrowDownLeft className="w-4 h-4" /> I Borrowed
                </button>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(debt => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onEdit={() => setModal({ mode: "edit", debt })}
                onPayment={() => setPaymentId(debt.id)}
              />
            ))}
          </div>
        )}
      </PageWrapper>

      {/* Debt form modal */}
      {modal !== null && (
        <DebtFormModal
          initial={modal.mode === "edit" ? modal.debt : undefined}
          defaultType={modal.mode === "create" ? modal.defaultType : undefined}
          accounts={accounts}
          saving={modal.mode === "edit" ? updating : creating}
          onClose={() => setModal(null)}
          onDelete={modal.mode === "edit" ? () => { setDeleteId(modal.debt.id); setModal(null); } : undefined}
          onSave={v => {
            if (modal.mode === "edit") {
              updateDebt({
                id: modal.debt.id,
                payload: {
                  contactName: v.contactName, contactPhone: v.contactPhone || undefined,
                  amount: Number(v.amount), description: v.description || undefined,
                  debtDate: v.debtDate, dueDate: v.dueDate || undefined,
                },
              }, { onSuccess: () => setModal(null) });
            } else {
              createDebt({
                type: v.type!, contactName: v.contactName, contactPhone: v.contactPhone || undefined,
                amount: Number(v.amount), description: v.description || undefined,
                debtDate: v.debtDate, dueDate: v.dueDate || undefined, accountId: v.accountId,
              }, { onSuccess: () => setModal(null) });
            }
          }}
        />
      )}

      {/* Payment / Received modal */}
      {payDebt && (
        <PaymentModal
          debt={payDebt}
          saving={paying}
          onClose={() => setPaymentId(null)}
          onSave={(amt, note) =>
            recordPay({ id: payDebt.id, payload: { amount: amt, note } },
              { onSuccess: () => setPaymentId(null) })
          }
        />
      )}

      {/* Delete confirm */}
      {delDebt && (
        <ConfirmDialog
          open
          title="Delete debt record?"
          description={
            <>
              {delDebt.type === "LENT" ? "Lent" : "Borrowed"} {fmt(delDebt.amount)} {delDebt.type === "LENT" ? "to" : "from"}{" "}
              <strong className="text-foreground">{delDebt.contactName}</strong>.
              {delDebt.accountName && (
                <span className="block text-muted-foreground/80 mt-1">
                  Account balance will be fully reversed, including any payments recorded.
                </span>
              )}
            </>
          }
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={() => deleteDebt(delDebt.id, { onSuccess: () => setDeleteId(null) })}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: ArrowUpRight,   label: "I Lent",     color: "emerald", onClick: () => setModal({ mode: "create", defaultType: "LENT" }) },
        { icon: ArrowDownLeft,  label: "I Borrowed",  color: "rose",    onClick: () => setModal({ mode: "create", defaultType: "BORROWED" }) },
      ]} />
    </div>
  );
}
