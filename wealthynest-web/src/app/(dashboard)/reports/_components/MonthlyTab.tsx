"use client";

import { useState } from "react";
import { FileSpreadsheet, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { escapeHtml, getCurrencySymbol } from "@/lib/utils";
import { expensesApi } from "@/features/expenses/api/expenses.api";
import { incomeApi } from "@/features/income/api/income.api";
import { MONTH_NAMES, getYears, downloadCsv, openPrintWindow } from "./reportHelpers";

export function MonthlyTab() {
  const years  = getYears();
  const now    = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy,  setBusy]  = useState<"csv" | "pdf" | null>(null);

  const label       = `${MONTH_NAMES[month - 1]} ${year}`;
  const csvName     = `WealthyNest-${year}-${String(month).padStart(2, "0")}-Monthly.csv`;
  const isFuture    = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
  // Last day of the selected month (handles Feb, 30-day months correctly)
  const lastDay     = new Date(year, month, 0).getDate();
  const mm          = String(month).padStart(2, "0");

  async function handleCsv() {
    setBusy("csv");
    try {
      await downloadCsv(`/reports/monthly?year=${year}&month=${month}`, csvName);
      toast.success("Download started.");
    } catch {
      toast.error("Could not generate report. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePdf() {
    setBusy("pdf");
    try {
      const [expRes, incomeEntries] = await Promise.all([
        expensesApi.getExpenses({ startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${lastDay}`, size: 500 }),
        incomeApi.getIncome(year, month),
      ]);
      const expenses = expRes.data ?? [];
      const totalExp = expenses.reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
      const totalInc = incomeEntries.reduce((s, e) => s + Number(e.amount), 0);
      const savings  = totalInc - totalExp;
      const currSymbol = getCurrencySymbol();
      const fmt = (v: number) => `${currSymbol}${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

      // Category breakdown
      const catMap: Record<string, number> = {};
      expenses.forEach((e: { categoryName?: string; amount: number }) => {
        const cat = e.categoryName ?? "Other";
        catMap[cat] = (catMap[cat] ?? 0) + Number(e.amount);
      });
      const catRows = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `<tr><td>${escapeHtml(cat)}</td><td style="text-align:right">${fmt(amt)}</td><td style="text-align:right;color:#999">${totalExp > 0 ? ((amt/totalExp)*100).toFixed(1) : 0}%</td></tr>`)
        .join("") || `<tr><td colspan="3" style="color:#999;text-align:center;padding:12px">No expenses this month</td></tr>`;

      // Income by source
      const incMap: Record<string, number> = {};
      incomeEntries.forEach(e => {
        const src = e.source.replace(/_/g, " ");
        incMap[src] = (incMap[src] ?? 0) + Number(e.amount);
      });
      const incRows = Object.entries(incMap)
        .map(([src, amt]) => `<tr><td>${escapeHtml(src)}</td><td style="text-align:right;color:#16a34a">${fmt(amt)}</td></tr>`)
        .join("") || `<tr><td colspan="2" style="color:#999;text-align:center;padding:12px">No income recorded</td></tr>`;

      const html = `
        <h1>${label}</h1>
        <p class="sub">Monthly Report</p>
        <div class="summary">
          <div class="card"><div class="card-label">Total Income</div><div class="card-value positive">${fmt(totalInc)}</div></div>
          <div class="card"><div class="card-label">Total Expenses</div><div class="card-value negative">${fmt(totalExp)}</div></div>
          <div class="card"><div class="card-label">Net Savings</div><div class="card-value ${savings >= 0 ? "positive" : "negative"}">${savings < 0 ? "−" : ""}${fmt(savings)}</div></div>
        </div>
        <div class="section-title">Expenses by Category (${expenses.length} transactions)</div>
        <table>
          <thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr></thead>
          <tbody>${catRows}</tbody>
          ${Object.keys(catMap).length > 0 ? `<tfoot><tr style="font-weight:700"><td>Total</td><td style="text-align:right">${fmt(totalExp)}</td><td></td></tr></tfoot>` : ""}
        </table>
        <div class="section-title">Income by Source</div>
        <table>
          <thead><tr><th>Source</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${incRows}</tbody>
          ${Object.keys(incMap).length > 0 ? `<tfoot><tr style="font-weight:700"><td>Total</td><td style="text-align:right;color:#16a34a">${fmt(totalInc)}</td></tr></tfoot>` : ""}
        </table>`;

      await openPrintWindow(`WealthyNest ${label}`, html);
    } catch {
      toast.error("Could not generate PDF. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Period</p>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-w-[100px]"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-w-[140px]"
            >
              {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
            </select>
          </div>
          {isFuture && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2">
              This month is in the future — the report will be empty.
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleCsv}
              disabled={!!busy}
              className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-muted/30 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left disabled:opacity-60"
            >
              <PremiumIcon icon={FileSpreadsheet} tone="emerald" size="sm" className={busy === "csv" ? "animate-pulse" : undefined} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  CSV {busy === "csv" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Income, expenses & category breakdown — opens in Excel or Sheets</p>
              </div>
            </button>
            <button
              onClick={handlePdf}
              disabled={!!busy}
              className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-muted/30 hover:border-red-500/40 hover:bg-red-500/5 transition-all text-left disabled:opacity-60"
            >
              <PremiumIcon icon={Printer} tone="red" size="sm" className={busy === "pdf" ? "animate-pulse" : undefined} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  PDF {busy === "pdf" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Print-ready summary — save from your browser&apos;s print dialog</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
