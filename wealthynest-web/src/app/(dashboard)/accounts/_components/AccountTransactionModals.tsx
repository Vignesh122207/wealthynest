"use client";

import { type ComponentProps } from "react";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { ExpenseForm } from "@/components/transactions/ExpenseForm";
import { IncomeForm, type IncomeFormValues, type IncomeSourceValue } from "@/components/transactions/IncomeForm";
import { TransferFormModal, type TransferFormValues } from "@/components/transactions/TransferFormModal";
import { ImportStatementModal } from "@/features/statementimport/components/ImportStatementModal";
import type { WalletAccount } from "@/features/accounts/types/account.types";
import type { Category } from "@/features/categories/types/category.types";
import type { ExpenseFormValues } from "@/features/expenses/schemas/expense.schema";

type ModalType = "none" | "create" | "addMoney" | "addExpense" | "transfer" | "edit" | "import";

interface AccountTransactionModalsProps {
  modal: ModalType;
  onClose: () => void;
  accounts: WalletAccount[];
  cashAccounts: WalletAccount[];
  bankAccounts: WalletAccount[];
  creditCards: WalletAccount[];
  incomeCategories: Category[];
  categoryOptions: ComponentProps<typeof ExpenseForm>["categoryOptions"];
  preAccount: WalletAccount | null;
  lockedExpenseAccount: WalletAccount | null;
  defaultIncomeSource: IncomeSourceValue;
  incomeSourceUsage: Map<string, number>;
  defaultExpenseCategoryId: string | undefined;
  payBillMode: boolean;
  handleAddIncome: (v: IncomeFormValues, recurring?: { dayOfMonth: number }) => void;
  handleAddExpense: (v: ExpenseFormValues) => void;
  handleAddTransfer: (v: TransferFormValues) => void;
  addingMoney: boolean;
  addingExpense: boolean;
  transferring: boolean;
}

// Add Income / Add Expense / Transfer / Import Statement — same shared components used on the
// Transactions page and Home (AccountPicker, CategoryPicker, BigAmountInput, built-in balance
// validation), instead of a second, plainer set of forms duplicated here. Pulled out of the
// Accounts page purely to cut its size.
export function AccountTransactionModals({
  modal, onClose, accounts, cashAccounts, bankAccounts, creditCards, incomeCategories, categoryOptions,
  preAccount, lockedExpenseAccount, defaultIncomeSource, incomeSourceUsage, defaultExpenseCategoryId,
  payBillMode, handleAddIncome, handleAddExpense, handleAddTransfer, addingMoney, addingExpense, transferring,
}: AccountTransactionModalsProps) {
  return (
    <>
      {modal === "addMoney" && (
        <TransactionModalOverlay onDismiss={onClose}>
          <IncomeForm onSubmit={handleAddIncome} onCancel={onClose} isPending={addingMoney}
            accounts={accounts} incomeCategories={incomeCategories}
            defaultValues={preAccount ? { accountId: preAccount.id } : undefined}
            defaultSource={defaultIncomeSource} sourceUsageCounts={incomeSourceUsage}
            showRecurringOption />
        </TransactionModalOverlay>
      )}

      {modal === "addExpense" && (
        <TransactionModalOverlay onDismiss={onClose}>
          <ExpenseForm title="Add Expense" categoryOptions={categoryOptions}
            cashAccounts={cashAccounts} bankAccounts={bankAccounts} creditAccounts={creditCards}
            lockedAccount={lockedExpenseAccount ?? undefined}
            defaultCategoryId={defaultExpenseCategoryId}
            onSubmit={handleAddExpense} onCancel={onClose} isPending={addingExpense} submitLabel="Add Expense" />
        </TransactionModalOverlay>
      )}

      {modal === "import" && (
        <ImportStatementModal onClose={onClose}
          bankAccounts={bankAccounts} cashAccounts={cashAccounts}
          initialAccountId={preAccount?.id} />
      )}

      {modal === "transfer" && (
        <TransactionModalOverlay onDismiss={onClose}>
          <TransferFormModal onSubmit={handleAddTransfer} onCancel={onClose} isPending={transferring}
            accounts={accounts}
            title={preAccount?.accountType === "CREDIT_CARD" ? "Pay Credit Card Bill" : "Transfer Between Accounts"}
            submitLabel={preAccount?.accountType === "CREDIT_CARD" ? "Pay Bill" : "Transfer"}
            defaultFromAccountId={payBillMode ? undefined : preAccount?.id}
            defaultToAccountId={payBillMode ? preAccount?.id : undefined} />
        </TransactionModalOverlay>
      )}
    </>
  );
}
