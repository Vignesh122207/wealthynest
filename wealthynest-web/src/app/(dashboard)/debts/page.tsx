"use client";

import {useState} from "react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {ArrowDownLeft, ArrowUpRight, Handshake, Wallet} from "lucide-react";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {
    useCreateDebt,
    useDebts,
    useDeleteDebt,
    useRecordDebtPayment,
    useUpdateDebt,
} from "@/features/debts/hooks/useDebts";
import type {DebtRecord, DebtType} from "@/features/debts/types/debt.types";
import {useAccounts} from "@/features/accounts/hooks/useAccounts";
import {DebtFormModal} from "./_components/DebtFormModal";
import {PaymentModal} from "./_components/PaymentModal";
import {DebtCard} from "./_components/DebtCard";
import {Summary} from "./_components/Summary";

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "ALL" | "LENT" | "BORROWED";

// Matches this page's own FAB action colors ("I Lent"=emerald, "I Borrowed"=rose) — same
// per-type template as Investments/Accounts/Transactions.
const TAB_COLOR: Record<Tab, string> = {
  ALL:      "#475569",
  LENT:     "#059669",
  BORROWED: "#e11d48",
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

  const tabs: TabBarItem<Tab>[] = [
    { key: "ALL",      label: "All",      icon: Wallet,        color: TAB_COLOR.ALL },
    { key: "LENT",     label: "Lent",     icon: ArrowUpRight,  color: TAB_COLOR.LENT,     count: debts.filter(d => d.type === "LENT").length },
    { key: "BORROWED", label: "Borrowed", icon: ArrowDownLeft, color: TAB_COLOR.BORROWED, count: debts.filter(d => d.type === "BORROWED").length },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Debt Tracker" subtitle="Track money you've lent or borrowed, and keep tabs on payoff progress" />
      <PageWrapper>

        {debts.length > 0 && <Summary debts={debts} />}

        {/* Tabs — shared TabBar template, same as Investments/Accounts/Transactions. */}
        <TabBar items={tabs} value={tab} onChange={setTab} testIdPrefix="debt-tab" />

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
                  className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-gradient-to-br from-emerald-700 to-emerald-600 shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-0.5 text-white transition-all">
                  <ArrowUpRight className="w-4 h-4" /> I Lent
                </button>
                <button onClick={() => setModal({ mode: "create", defaultType: "BORROWED" })}
                  className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-gradient-to-br from-rose-600 to-rose-500 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-0.5 text-white transition-all">
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
        { icon: ArrowUpRight,   label: "I Lent",     color: "emerald", testId: "fab-add-debt-lent",     onClick: () => setModal({ mode: "create", defaultType: "LENT" }) },
        { icon: ArrowDownLeft,  label: "I Borrowed",  color: "rose",    testId: "fab-add-debt-borrowed", onClick: () => setModal({ mode: "create", defaultType: "BORROWED" }) },
      ]} />
    </div>
  );
}
