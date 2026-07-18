import {expensesApi} from "@/features/expenses/api/expenses.api";
import {apiClient} from "@/lib/axios";
import {toast} from "sonner";
import {getCurrencySymbol} from "@/lib/utils";
import type {WalletAccount} from "../types/account.types";

export async function downloadAccountStatement(account: WalletAccount) {
  try {
    const pmMap: Record<string, string> = {
      CASH_WALLET: "CASH", BANK_ACCOUNT: "BANK_ACCOUNT",
      CREDIT_CARD: "CREDIT_CARD", EMERGENCY_FUND: "BANK_ACCOUNT",
    };
    const expectedPm = pmMap[account.accountType] ?? "";
    const [expRes, transfers] = await Promise.all([
      expensesApi.getExpenses({ size: 500, sortDir: "desc" }),
      apiClient.get<{ data: { data: { id: string; transferDate: string; amount: number; description?: string; fromAccountId: string; toAccountId?: string }[] } }>("/accounts/transfers?size=200"),
    ]);
    const allExpenses = expRes.data ?? [];
    const expenses = allExpenses.filter((e: { accountId?: string; paymentMethod?: string }) =>
      e.accountId === account.id ||
      (!e.accountId && e.paymentMethod === expectedPm)
    );
    const txfrs     = (transfers.data?.data?.data ?? []).filter((t: { fromAccountId: string; toAccountId?: string }) =>
      t.fromAccountId === account.id || t.toAccountId === account.id);
    const currSymbol = getCurrencySymbol();
    const fmt = (v: number) => `${currSymbol}${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    const totalOut = expenses.reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);

    const expRows = expenses.length > 0
      ? expenses.map((e: { expenseDate: string; categoryName?: string; description?: string; amount: number }) =>
        `<tr><td>${e.expenseDate}</td><td>${e.categoryName ?? "—"}</td><td>${e.description ?? "—"}</td><td style="color:#dc2626;text-align:right">${fmt(Number(e.amount))}</td></tr>`
      ).join("")
      : `<tr><td colspan="4" style="color:#999;text-align:center;padding:12px">No expenses for this account</td></tr>`;

    const txfrRows = txfrs.length > 0
      ? txfrs.map((t: { transferDate: string; amount: number; description?: string; fromAccountId: string; toAccountId?: string }) => {
          const isIn = t.toAccountId === account.id;
          return `<tr><td>${t.transferDate}</td><td>${t.description ?? "—"}</td><td style="color:${isIn ? "#16a34a" : "#dc2626"};text-align:right">${isIn ? "+" : "−"}${fmt(Number(t.amount))}</td></tr>`;
        }).join("")
      : `<tr><td colspan="3" style="color:#999;text-align:center;padding:12px">No transfers</td></tr>`;

    const th = (label: string, right = false) =>
      `<th style="padding:7px 10px;text-align:${right ? "right" : "left"};border-bottom:2px solid #e0e0e0">${label}</th>`;

    const generatedOn = new Date().toLocaleDateString("en-IN", { dateStyle: "long" });
    const html = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;margin-bottom:20px;border-bottom:2px solid #4f46e5">
        <div style="font-size:15px;font-weight:800;color:#4f46e5;letter-spacing:-.02em">WealthyNest</div>
        <div style="font-size:11px;color:#999">Account Statement</div>
      </div>
      <h1 style="font-size:18px;font-weight:700;margin-bottom:4px">${account.name} — Statement</h1>
      <p style="color:#666;font-size:12px;margin-bottom:20px">${account.bankName ? account.bankName + " · " : ""}Generated ${generatedOn}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#888;margin-bottom:4px">Current Balance</div>
          <div style="font-size:16px;font-weight:700">${fmt(Number(account.currentBalance))}</div>
        </div>
        <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#888;margin-bottom:4px">Total In</div>
          <div style="font-size:16px;font-weight:700;color:#16a34a">${fmt(Number(account.totalMoneyIn))}</div>
        </div>
        <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#888;margin-bottom:4px">Total Out</div>
          <div style="font-size:16px;font-weight:700;color:#dc2626">${fmt(Number(account.totalMoneyOut))}</div>
        </div>
      </div>
      <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#444;margin-bottom:8px">Expenses (${expenses.length})</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
        <thead><tr style="background:#f5f5f5">${th("Date")}${th("Category")}${th("Description")}${th("Amount", true)}</tr></thead>
        <tbody>${expRows}</tbody>
        ${expenses.length > 0 ? `<tfoot><tr style="font-weight:700"><td colspan="3" style="padding:7px 10px">Total Spent</td><td style="padding:7px 10px;text-align:right;color:#dc2626">${fmt(totalOut)}</td></tr></tfoot>` : ""}
      </table>
      <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#444;margin-bottom:8px">Transfers (${txfrs.length})</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
        <thead><tr style="background:#f5f5f5">${th("Date")}${th("Description")}${th("Amount", true)}</tr></thead>
        <tbody>${txfrRows}</tbody>
      </table>
      <div style="border-top:1px solid #eee;padding-top:10px;margin-top:8px;font-size:10px;color:#aaa;text-align:center">
        Generated by WealthyNest on ${generatedOn} · This is a system-generated statement for personal record-keeping.
      </div>`;

    const win = window.open("", "_blank", "width=860,height=650");
    if (!win) { toast.error("Allow pop-ups to generate statement."); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>WealthyNest — ${account.name} Statement</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;color:#111;padding:28px 36px}@media print{button{display:none}}</style></head><body>${html}<br/><button onclick="window.print()" style="padding:8px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">Save as PDF</button></body></html>`);
    win.document.close();
  } catch { toast.error("Failed to generate statement"); }
}
