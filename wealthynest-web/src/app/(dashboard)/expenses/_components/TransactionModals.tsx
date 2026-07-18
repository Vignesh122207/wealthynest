"use client";

import {type ComponentProps} from "react";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {ExpenseForm} from "@/components/transactions/ExpenseForm";
import {IncomeForm, type IncomeFormValues, type IncomeSourceValue} from "@/components/transactions/IncomeForm";
import {TransferFormModal, type TransferFormValues} from "@/components/transactions/TransferFormModal";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {type ExpenseFormValues} from "@/features/expenses/schemas/expense.schema";
import type {Expense, SplitParticipant} from "@/features/expenses/types/expense.types";
import type {IncomeEntry} from "@/features/income/types/income.types";
import type {AccountTransfer, WalletAccount} from "@/features/accounts/types/account.types";
import type {Category} from "@/features/categories/types/category.types";

// All three add/edit modal groups (Expense/Income/Transfer) plus their three delete-confirm
// dialogs — split out of the Transactions page purely to cut its size; every prop here is a
// value or handler the page already computed, passed through unchanged.
interface TransactionModalsProps {
  sharedFormProps: {
    categoryOptions: ComponentProps<typeof ExpenseForm>["categoryOptions"];
    cashAccounts:    ComponentProps<typeof ExpenseForm>["cashAccounts"];
    bankAccounts:    ComponentProps<typeof ExpenseForm>["bankAccounts"];
    creditAccounts:  ComponentProps<typeof ExpenseForm>["creditAccounts"];
  };
  familyMembers: ComponentProps<typeof ExpenseForm>["familyMembers"];
  allAccounts: WalletAccount[];
  incomeCategories: Category[];

  // Delete confirms
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  deleteExpense: (id: string) => void;
  confirmIncomeId: string | null;
  setConfirmIncomeId: (id: string | null) => void;
  deleteIncome: (id: string) => void;
  confirmTransferId: string | null;
  setConfirmTransferId: (id: string | null) => void;
  deleteTransfer: (id: string) => void;

  // Expense add/edit
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  editExpense: Expense | null;
  setEditExpense: (e: Expense | null) => void;
  defaultExpenseCategoryId: string | undefined;
  handleCreate: (values: ExpenseFormValues, splitWith?: SplitParticipant[]) => void;
  handleUpdate: (values: ExpenseFormValues) => void;
  creating: boolean;
  updating: boolean;

  // Income add/edit
  showAddIncome: boolean;
  setShowAddIncome: (v: boolean) => void;
  editIncome: IncomeEntry | null;
  setEditIncome: (e: IncomeEntry | null) => void;
  defaultIncomeSource: IncomeSourceValue;
  incomeSourceUsage: Map<string, number>;
  handleAddIncome: (values: IncomeFormValues) => void;
  handleUpdateIncome: (values: IncomeFormValues) => void;
  addingIncome: boolean;
  updatingIncome: boolean;

  // Transfer add/edit
  showAddTransfer: boolean;
  setShowAddTransfer: (v: boolean) => void;
  editTransfer: AccountTransfer | null;
  setEditTransfer: (t: AccountTransfer | null) => void;
  handleAddTransfer: (values: TransferFormValues) => void;
  handleUpdateTransfer: (values: TransferFormValues) => void;
  transferring: boolean;
  updatingTransfer: boolean;
}

export function TransactionModals({
  sharedFormProps, familyMembers, allAccounts, incomeCategories,
  confirmId, setConfirmId, deleteExpense,
  confirmIncomeId, setConfirmIncomeId, deleteIncome,
  confirmTransferId, setConfirmTransferId, deleteTransfer,
  showCreate, setShowCreate, editExpense, setEditExpense, defaultExpenseCategoryId,
  handleCreate, handleUpdate, creating, updating,
  showAddIncome, setShowAddIncome, editIncome, setEditIncome, defaultIncomeSource, incomeSourceUsage,
  handleAddIncome, handleUpdateIncome, addingIncome, updatingIncome,
  showAddTransfer, setShowAddTransfer, editTransfer, setEditTransfer,
  handleAddTransfer, handleUpdateTransfer, transferring, updatingTransfer,
}: TransactionModalsProps) {
  return (
    <>
      {confirmId && (
        <ConfirmDialog open title="Delete Expense"
          description="This expense will be permanently deleted and cannot be undone."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteExpense(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {confirmIncomeId && (
        <ConfirmDialog open title="Delete Income Entry"
          description="This income entry will be permanently deleted."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteIncome(confirmIncomeId); setConfirmIncomeId(null); }}
          onCancel={() => setConfirmIncomeId(null)} />
      )}
      {confirmTransferId && (
        <ConfirmDialog open title="Delete Transfer"
          description="This transfer record will be permanently deleted."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteTransfer(confirmTransferId); setConfirmTransferId(null); }}
          onCancel={() => setConfirmTransferId(null)} />
      )}

      {(showCreate || editExpense) && (
        <TransactionModalOverlay onDismiss={() => { setShowCreate(false); setEditExpense(null); }}>
          {showCreate && (
            <ExpenseForm title="New Expense" defaultCategoryId={defaultExpenseCategoryId} {...sharedFormProps}
              familyMembers={familyMembers}
              onSubmit={handleCreate} onCancel={() => setShowCreate(false)}
              isPending={creating} submitLabel="Add Expense" />
          )}
          {editExpense && (
            <ExpenseForm
              title={`Edit — ${editExpense.description || editExpense.categoryName || "Expense"}`}
              defaultValues={{ categoryId: editExpense.categoryId, accountId: editExpense.accountId ?? "",
                amount: editExpense.amount, description: editExpense.description ?? "", expenseDate: editExpense.expenseDate }}
              {...sharedFormProps}
              onSubmit={handleUpdate} onCancel={() => setEditExpense(null)}
              onDelete={() => { const id = editExpense.id; setEditExpense(null); setConfirmId(id); }}
              isPending={updating} submitLabel="Save Changes" />
          )}
        </TransactionModalOverlay>
      )}

      {(showAddIncome || editIncome) && (
        <TransactionModalOverlay onDismiss={() => { setShowAddIncome(false); setEditIncome(null); }}>
          {showAddIncome && (
            <IncomeForm onSubmit={handleAddIncome} onCancel={() => setShowAddIncome(false)}
              defaultSource={defaultIncomeSource} sourceUsageCounts={incomeSourceUsage}
              isPending={addingIncome} accounts={allAccounts} incomeCategories={incomeCategories} />
          )}
          {editIncome && (
            <IncomeForm
              defaultValues={{ source: editIncome.source as IncomeSourceValue, amount: editIncome.amount,
                incomeDate: editIncome.incomeDate, accountId: editIncome.accountId ?? "",
                description: editIncome.description ?? "" }}
              onSubmit={handleUpdateIncome} onCancel={() => setEditIncome(null)}
              onDelete={() => { const id = editIncome.id; setEditIncome(null); setConfirmIncomeId(id); }}
              sourceUsageCounts={incomeSourceUsage}
              isPending={updatingIncome} accounts={allAccounts} incomeCategories={incomeCategories} isEdit />
          )}
        </TransactionModalOverlay>
      )}

      {(showAddTransfer || editTransfer) && (
        <TransactionModalOverlay onDismiss={() => { setShowAddTransfer(false); setEditTransfer(null); }}>
          {showAddTransfer && (
            <TransferFormModal onSubmit={handleAddTransfer} onCancel={() => setShowAddTransfer(false)}
              isPending={transferring} accounts={allAccounts} />
          )}
          {editTransfer && (
            <TransferFormModal
              editTransferRef={editTransfer}
              onSubmit={handleUpdateTransfer} onCancel={() => setEditTransfer(null)}
              onDelete={() => { const id = editTransfer.id; setEditTransfer(null); setConfirmTransferId(id); }}
              isPending={updatingTransfer} accounts={allAccounts} isEdit />
          )}
        </TransactionModalOverlay>
      )}
    </>
  );
}
