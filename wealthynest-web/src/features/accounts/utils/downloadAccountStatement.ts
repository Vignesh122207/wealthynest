import {expensesApi} from "@/features/expenses/api/expenses.api";
import {accountsApi} from "../api/accounts.api";
import {toast} from "sonner";
import {getStoredCurrency} from "@/lib/utils";
import {addSectionTitle, addSummaryCards, addTable, createReportDoc, finalizePdf, pdfCurrencyPrefix, yieldToMain} from "@/lib/pdf/reportPdf";
import {fetchAllPages} from "@/lib/pagination";
import type {WalletAccount} from "../types/account.types";

/** "all" = every transaction on record for this account; a specific year scopes both the
 *  expenses fetch (server-side, via accountIds+startDate/endDate) and the transfers fetch
 *  (client-side — the transfers endpoint has no account/date filter, matching Reports' own
 *  Export tab), each paged through in full via fetchAllPages rather than capped at one page. */
export async function downloadAccountStatement(account: WalletAccount, year: number | "all" = "all") {
  try {
    const dateBounds = year === "all" ? {} : { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    const [expenses, allTransfers] = await Promise.all([
      fetchAllPages(page => expensesApi.getExpenses({ accountIds: [account.id], ...dateBounds, page, size: 500, sortDir: "desc" })),
      fetchAllPages(page => accountsApi.getTransfers(page, 500)),
    ]);
    const transfers = allTransfers.filter(t =>
      (t.fromAccountId === account.id || t.toAccountId === account.id) &&
      (year === "all" || t.transferDate.startsWith(String(year)))
    );

    const prefix = pdfCurrencyPrefix(getStoredCurrency());
    const fmt = (v: number) => `${v < 0 ? "-" : ""}${prefix}${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    const totalOut = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const periodLabel = year === "all" ? "All time" : String(year);

    const expRows = expenses.map(e => [e.expenseDate, e.categoryName ?? "—", e.description ?? "—", fmt(Number(e.amount))]);
    const txfrRows = transfers.map(t => {
      const isIn = t.toAccountId === account.id;
      return [t.transferDate, t.description ?? "—", `${isIn ? "+" : "-"}${fmt(Math.abs(Number(t.amount)))}`];
    });

    const subtitle = `${account.bankName ? account.bankName + " · " : ""}Statement · ${periodLabel}`;

    await yieldToMain();
    const { doc, y } = createReportDoc(account.name, subtitle);
    let cursor = addSummaryCards(doc, y, [
      { label: "Current Balance", value: fmt(Number(account.currentBalance)) },
      { label: "Total In", value: fmt(Number(account.totalMoneyIn)), tone: "positive" },
      { label: "Total Out", value: fmt(Number(account.totalMoneyOut)), tone: "negative" },
    ]);

    cursor = addSectionTitle(doc, cursor, `Expenses (${expenses.length})`);
    cursor = addTable(doc, cursor, ["Date", "Category", "Description", "Amount"],
      expRows.length > 0 ? expRows : [["No expenses for this period", "", "", ""]],
      {
        foot: expRows.length > 0 ? [["Total Spent", "", "", fmt(totalOut)]] : undefined,
        columnStyles: { 3: { halign: "right" } },
      }
    );

    cursor = addSectionTitle(doc, cursor, `Transfers (${transfers.length})`);
    addTable(doc, cursor, ["Date", "Description", "Amount"],
      txfrRows.length > 0 ? txfrRows : [["No transfers for this period", "", ""]],
      { columnStyles: { 2: { halign: "right" } } }
    );

    const filenameSafe = account.name.replace(/[^a-zA-Z0-9-_]+/g, "-");
    await finalizePdf(doc, `WealthyNest-${filenameSafe}-Statement.pdf`);
  } catch {
    toast.error("Failed to generate statement");
  }
}
