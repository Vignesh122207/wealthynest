import {expensesApi} from "@/features/expenses/api/expenses.api";
import {apiClient} from "@/lib/axios";
import {toast} from "sonner";
import {escapeHtml, getCurrencySymbol} from "@/lib/utils";
import {openPrintWindow} from "@/lib/printReport";
import type {WalletAccount} from "../types/account.types";

/** "all" = every transaction on record for this account; a specific year scopes both the
 *  expenses fetch (server-side, via accountIds+startDate/endDate) and the transfers fetch
 *  (client-side — the transfers endpoint has no date filter, matching Reports' own Export tab). */
export async function downloadAccountStatement(account: WalletAccount, year: number | "all" = "all") {
  try {
    const dateBounds = year === "all" ? {} : { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    const [expRes, transfersRes] = await Promise.all([
      expensesApi.getExpenses({ accountIds: [account.id], ...dateBounds, size: 500, sortDir: "desc" }),
      apiClient.get<{ data: { data: { id: string; transferDate: string; amount: number; description?: string; fromAccountId: string; toAccountId?: string }[] } }>("/accounts/transfers?size=500"),
    ]);
    const expenses = expRes.data ?? [];
    const transfers = (transfersRes.data?.data?.data ?? []).filter(t =>
      (t.fromAccountId === account.id || t.toAccountId === account.id) &&
      (year === "all" || t.transferDate.startsWith(String(year)))
    );

    const currSymbol = getCurrencySymbol();
    const fmt = (v: number) => `${currSymbol}${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    const totalOut = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const periodLabel = year === "all" ? "All time" : String(year);

    const expRows = expenses.length > 0
      ? expenses.map(e =>
          `<tr><td>${e.expenseDate}</td><td>${escapeHtml(e.categoryName ?? "—")}</td><td>${escapeHtml(e.description ?? "—")}</td><td style="color:#dc2626;text-align:right">${fmt(Number(e.amount))}</td></tr>`
        ).join("")
      : `<tr><td colspan="4" style="color:#999;text-align:center;padding:12px">No expenses for this period</td></tr>`;

    const txfrRows = transfers.length > 0
      ? transfers.map(t => {
          const isIn = t.toAccountId === account.id;
          return `<tr><td>${t.transferDate}</td><td>${escapeHtml(t.description ?? "—")}</td><td style="color:${isIn ? "#16a34a" : "#dc2626"};text-align:right">${isIn ? "+" : "−"}${fmt(Number(t.amount))}</td></tr>`;
        }).join("")
      : `<tr><td colspan="3" style="color:#999;text-align:center;padding:12px">No transfers for this period</td></tr>`;

    const html = `
      <h1>${escapeHtml(account.name)}</h1>
      <p class="sub">${account.bankName ? escapeHtml(account.bankName) + " · " : ""}Statement · ${periodLabel}</p>
      <div class="summary">
        <div class="card"><div class="card-label">Current Balance</div><div class="card-value">${fmt(Number(account.currentBalance))}</div></div>
        <div class="card"><div class="card-label">Total In</div><div class="card-value positive">${fmt(Number(account.totalMoneyIn))}</div></div>
        <div class="card"><div class="card-label">Total Out</div><div class="card-value negative">${fmt(Number(account.totalMoneyOut))}</div></div>
      </div>
      <div class="section-title">Expenses (${expenses.length})</div>
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${expRows}</tbody>
        ${expenses.length > 0 ? `<tfoot><tr style="font-weight:700"><td colspan="3">Total Spent</td><td style="text-align:right;color:#dc2626">${fmt(totalOut)}</td></tr></tfoot>` : ""}
      </table>
      <div class="section-title">Transfers (${transfers.length})</div>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${txfrRows}</tbody>
      </table>`;

    await openPrintWindow(`WealthyNest — ${account.name} Statement`, html);
  } catch {
    toast.error("Failed to generate statement");
  }
}
