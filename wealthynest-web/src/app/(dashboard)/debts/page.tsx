"use client";

import {useMemo, useState} from "react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {ArrowDownLeft, ArrowUpRight, Handshake, Wallet} from "lucide-react";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useTabParam} from "@/hooks/useTabParam";
import {
    useCreateDebt,
    useDebts,
    useDeleteDebt,
    useDeleteDebtPayment,
    useRecordDebtPayment,
    useUpdateDebt,
} from "@/features/debts/hooks/useDebts";
import {groupDebtsByContact} from "@/features/debts/utils/groupByContact";
import type {DebtPayment, DebtRecord, DebtType} from "@/features/debts/types/debt.types";
import {useAccounts} from "@/features/accounts/hooks/useAccounts";
import {DebtFormModal} from "./_components/DebtFormModal";
import {PaymentModal} from "./_components/PaymentModal";
import {ContactLedgerCard} from "./_components/ContactLedgerCard";
import {SettledDebtsSection} from "./_components/SettledDebtsSection";
import {Summary} from "./_components/Summary";

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS_LIST = ["ALL", "LENT", "BORROWED"] as const;
type Tab = (typeof TABS_LIST)[number];

// Matches this page's own FAB action colors ("I Lent"=emerald, "I Borrowed"=rose) — same
// per-type template as Investments/Accounts/Transactions.
const TAB_COLOR: Record<Tab, string> = {
  ALL:      "#475569",
  LENT:     "#059669",
  BORROWED: "#e11d48",
};
type Modal = null
  | { mode: "create"; defaultType: DebtType; prefillContact?: { contactName: string; contactPhone?: string } }
  | { mode: "edit";   debt: DebtRecord };

export default function DebtsPage() {
  const { fmt } = useAmountFormatter();
  const [tab,       setTab]       = useTabParam<Tab>(TABS_LIST, "ALL");
  const [modal,     setModal]     = useState<Modal>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<{ debt: DebtRecord; payment: DebtPayment } | null>(null);

  const { data: debts = [], isLoading, isError, refetch } = useDebts();
  const { data: accountsData }            = useAccounts();
  const accounts = (accountsData ?? []).filter(a => a.status !== "ARCHIVED" && a.accountType !== "CREDIT_CARD");

  const { mutate: createDebt, isPending: creating }         = useCreateDebt();
  const { mutate: updateDebt, isPending: updating }         = useUpdateDebt();
  const { mutate: recordPay,  isPending: paying    }        = useRecordDebtPayment();
  const { mutate: deleteDebt, isPending: deleting }         = useDeleteDebt();
  const { mutate: deleteDebtPayment, isPending: deletingPayment } = useDeleteDebtPayment();

  const filtered = tab === "ALL" ? debts : debts.filter(d => d.type === tab);
  // Repeat transactions with the same person land on one ledger card (see groupByContact.ts)
  // instead of N disconnected ones — grouped from the tab-filtered list, so a LENT/BORROWED tab
  // still hides a contact entirely when none of their records match.
  const contactGroups = useMemo(() => groupDebtsByContact(filtered), [filtered]);
  // A contact with nothing active left doesn't get their own ledger card — see
  // SettledDebtsSection.tsx for where their history goes instead.
  const activeGroups  = useMemo(() => contactGroups.filter(g => g.records.length > 0), [contactGroups]);
  // `filtered` is already in the API's newest-created-first order, so no extra sort is needed here.
  const settledDebts  = useMemo(() => filtered.filter(d => d.status === "SETTLED"), [filtered]);
  // Suggestions come from the FULL debt list (not tab-filtered) so the autocomplete works the
  // same regardless of which tab you're adding a transaction from.
  const contactSuggestions = useMemo(() => groupDebtsByContact(debts).map(g => g.contactName), [debts]);
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

        {debts.length > 0 && <Summary debts={debts} onSelectTab={setTab} />}

        {/* Tabs — shared TabBar template, same as Investments/Accounts/Transactions. */}
        <TabBar items={tabs} value={tab} onChange={setTab} testIdPrefix="debt-tab" />

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-card border border-border rounded-2xl animate-pulse" />)}
          </div>
        ) : isError ? (
          <QueryErrorState onRetry={() => refetch()} description="Couldn't load your debts. Check your connection and try again." />
        ) : activeGroups.length === 0 && settledDebts.length === 0 ? (
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
                {tab !== "BORROWED" && (
                  <button onClick={() => setModal({ mode: "create", defaultType: "LENT" })}
                    className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-gradient-to-br from-emerald-700 to-emerald-600 shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-0.5 text-white transition-all">
                    <ArrowUpRight className="w-4 h-4" /> I Lent
                  </button>
                )}
                {tab !== "LENT" && (
                  <button onClick={() => setModal({ mode: "create", defaultType: "BORROWED" })}
                    className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-gradient-to-br from-rose-600 to-rose-500 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-0.5 text-white transition-all">
                    <ArrowDownLeft className="w-4 h-4" /> I Borrowed
                  </button>
                )}
              </div>
            }
          />
        ) : (
          <div className="space-y-5">
            {activeGroups.map(group => (
              <ContactLedgerCard
                key={group.key}
                group={group}
                onEdit={debt => setModal({ mode: "edit", debt })}
                onPayment={debt => setPaymentId(debt.id)}
                onDeletePayment={(debt, payment) => setDeletePaymentTarget({ debt, payment })}
                onAddTransaction={(contactName, contactPhone) =>
                  setModal({ mode: "create", defaultType: "LENT", prefillContact: { contactName, contactPhone } })}
              />
            ))}
            <SettledDebtsSection
              settledDebts={settledDebts}
              onEdit={debt => setModal({ mode: "edit", debt })}
              onPayment={debt => setPaymentId(debt.id)}
              onDeletePayment={(debt, payment) => setDeletePaymentTarget({ debt, payment })}
            />
          </div>
        )}
      </PageWrapper>

      {/* Debt form modal */}
      {modal !== null && (
        <DebtFormModal
          initial={modal.mode === "edit" ? modal.debt : undefined}
          defaultType={modal.mode === "create" ? modal.defaultType : undefined}
          prefillContact={modal.mode === "create" ? modal.prefillContact : undefined}
          contactSuggestions={contactSuggestions}
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
          onSave={(amt, note, paidAt) =>
            recordPay({ id: payDebt.id, payload: { amount: amt, note, paidAt } },
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

      {/* Remove-payment confirm */}
      {deletePaymentTarget && (
        <ConfirmDialog
          open
          title="Remove this payment?"
          description={
            <>
              Removing this {fmt(deletePaymentTarget.payment.amount)} payment
              {deletePaymentTarget.debt.type === "LENT" ? " received from " : " paid to "}
              <strong className="text-foreground">{deletePaymentTarget.debt.contactName}</strong> puts it back on the balance still owed.
              {deletePaymentTarget.debt.accountName && (
                <span className="block text-muted-foreground/80 mt-1">
                  Account balance will be reversed for this payment.
                </span>
              )}
            </>
          }
          confirmLabel="Remove"
          danger
          loading={deletingPayment}
          onConfirm={() => deleteDebtPayment(
            { id: deletePaymentTarget.debt.id, paymentId: deletePaymentTarget.payment.id },
            { onSuccess: () => setDeletePaymentTarget(null) })}
          onCancel={() => setDeletePaymentTarget(null)}
        />
      )}

      {/* ── Floating Action Button — only offers the type matching the active tab ── */}
      <FloatingActionButton actions={[
        { icon: ArrowUpRight,   label: "I Lent",     color: "emerald", testId: "fab-add-debt-lent",     onClick: () => setModal({ mode: "create", defaultType: "LENT" }),     hidden: tab === "BORROWED" },
        { icon: ArrowDownLeft,  label: "I Borrowed",  color: "rose",    testId: "fab-add-debt-borrowed", onClick: () => setModal({ mode: "create", defaultType: "BORROWED" }), hidden: tab === "LENT" },
      ]} />
    </div>
  );
}
