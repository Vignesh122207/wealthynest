import {escapeCsvField, getCurrencySymbol} from "@/lib/utils";
import {INCOME_SOURCES} from "@/lib/constants";
import type {Expense} from "@/features/expenses/types/expense.types";
import type {IncomeEntry} from "@/features/income/types/income.types";
import type {AccountTransfer} from "@/features/accounts/types/account.types";

// Shared by every CSV export below — was previously copy-pasted blob/anchor/click/cleanup
// boilerplate in four places.
function triggerCsvDownload(filename: string, header: string[], rows: string[][]) {
  const csv  = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function exportCsv(
  expenses: Expense[],
  label: string,
  accountNameMap: Record<string, string>,
  accountTypeMap: Record<string, string>,
) {
  const header = ["Date", "Description", "Category", `Amount (${getCurrencySymbol()})`, "Account", "Payment Method"];
  const rows = expenses.map(e => {
    let paymentMethod = e.paymentMethod ?? "";
    if (!paymentMethod && e.accountId) {
      const type = accountTypeMap[e.accountId];
      if      (type === "CASH_WALLET")   paymentMethod = "Cash";
      else if (type === "CREDIT_CARD")   paymentMethod = "Credit Card";
      else if (type === "BANK_ACCOUNT")  paymentMethod = "Bank Account";
    }
    return [
      e.expenseDate,
      escapeCsvField(e.description ?? ""),
      escapeCsvField(e.categoryName ?? ""),
      e.amount.toFixed(2),
      escapeCsvField(accountNameMap[e.accountId ?? ""] ?? ""),
      paymentMethod,
    ];
  });
  triggerCsvDownload(`expenses-${label}.csv`, header, rows);
}

export function exportIncomeCsv(entries: IncomeEntry[], label: string, accountNames: Record<string, string>) {
  const INCOME_SOURCE_LABELS: Record<string, string> = {
    SALARY: "Salary", FREELANCE: "Freelance", BUSINESS: "Business",
    RENTAL: "Rental Income", INTEREST: "Interest", DIVIDEND: "Dividend",
    GIFT: "Gift", BONUS: "Bonus", OTHER: "Other",
  };
  const header = ["Date", "Source", `Amount (${getCurrencySymbol()})`, "Description", "Account"];
  const rows = entries.map(e => [
    e.incomeDate,
    INCOME_SOURCE_LABELS[e.source] ?? e.source.replace(/_/g, " "),
    e.amount.toFixed(2),
    escapeCsvField(e.description ?? ""),
    escapeCsvField(accountNames[e.accountId ?? ""] ?? ""),
  ]);
  triggerCsvDownload(`income-${label}.csv`, header, rows);
}

export function exportTransfersCsv(transfers: AccountTransfer[], label: string) {
  const header = ["Date", "From Account", "To Account", `Amount (${getCurrencySymbol()})`, "Description"];
  const rows = transfers.map(t => [
    t.transferDate, escapeCsvField(t.fromAccountName), escapeCsvField(t.toAccountName),
    t.amount.toFixed(2),
    escapeCsvField(t.description ?? ""),
  ]);
  triggerCsvDownload(`transfers-${label}.csv`, header, rows);
}

/** Combined export for the "All" tab — every kind, in one file, so nothing gets silently dropped. */
export function exportAllCsv(
  rows: { kind: "expense" | "income" | "transfer"; date: string; data: Expense | IncomeEntry | AccountTransfer }[],
  label: string,
  accountNameMap: Record<string, string>,
) {
  const header = ["Date", "Type", "Description", "Category", `Amount (${getCurrencySymbol()})`, "Account"];
  const csvRows = rows.map(r => {
    if (r.kind === "expense") {
      const e = r.data as Expense;
      return [e.expenseDate, "Expense", escapeCsvField(e.description ?? ""), escapeCsvField(e.categoryName ?? ""),
        (-e.amount).toFixed(2), escapeCsvField(accountNameMap[e.accountId ?? ""] ?? "")];
    }
    if (r.kind === "income") {
      const i = r.data as IncomeEntry;
      return [i.incomeDate, "Income", escapeCsvField(i.description ?? ""),
        escapeCsvField(INCOME_SOURCES.find(s => s.value === i.source)?.label ?? i.source),
        i.amount.toFixed(2), escapeCsvField(accountNameMap[i.accountId ?? ""] ?? "")];
    }
    const t = r.data as AccountTransfer;
    return [t.transferDate, "Transfer", escapeCsvField(t.description ?? ""),
      "", t.amount.toFixed(2), escapeCsvField(`${t.fromAccountName} → ${t.toAccountName}`)];
  });
  triggerCsvDownload(`transactions-${label}.csv`, header, csvRows);
}
