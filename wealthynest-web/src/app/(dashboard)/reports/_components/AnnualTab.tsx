"use client";

import {useState} from "react";
import {FileSpreadsheet, Loader2, Printer} from "lucide-react";
import {toast} from "sonner";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {getCurrencySymbol} from "@/lib/utils";
import {expensesApi} from "@/features/expenses/api/expenses.api";
import {incomeApi} from "@/features/income/api/income.api";
import {downloadCsv, getYears, MONTH_NAMES, openPrintWindow} from "@/lib/printReport";

export function AnnualTab() {
  const years   = getYears();
  const [year,  setYear] = useState(years[0]);
  const [busy,  setBusy] = useState<"csv" | "pdf" | null>(null);

  const currentYear = new Date().getFullYear();
  const csvName = `WealthyNest-${year}-Annual.csv`;

  async function handleCsv() {
    setBusy("csv");
    try {
      await downloadCsv(`/reports/annual?year=${year}`, csvName);
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
        expensesApi.getExpenses({ startDate: `${year}-01-01`, endDate: `${year}-12-31`, size: 1000 }),
        incomeApi.getIncome(year),
      ]);
      const expenses = expRes.data ?? [];
      const totalExp = expenses.reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
      const totalInc = incomeEntries.reduce((s, e) => s + Number(e.amount), 0);
      const savings  = totalInc - totalExp;
      const currSymbol = getCurrencySymbol();
      const fmt = (v: number) => `${currSymbol}${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

      const expByMonth: Record<number, number> = {};
      expenses.forEach((e: { expenseDate: string; amount: number }) => {
        const m = new Date(e.expenseDate).getMonth() + 1;
        expByMonth[m] = (expByMonth[m] ?? 0) + Number(e.amount);
      });
      const incByMonth: Record<number, number> = {};
      incomeEntries.forEach(e => {
        incByMonth[e.periodMonth] = (incByMonth[e.periodMonth] ?? 0) + Number(e.amount);
      });

      const rows = Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
        const inc = incByMonth[m] ?? 0;
        const exp = expByMonth[m] ?? 0;
        const net = inc - exp;
        return `<tr>
          <td>${MONTH_NAMES[m - 1]}</td>
          <td style="text-align:right;color:#16a34a">${inc > 0 ? fmt(inc) : "—"}</td>
          <td style="text-align:right;color:#dc2626">${exp > 0 ? fmt(exp) : "—"}</td>
          <td style="text-align:right;color:${net >= 0 ? "#16a34a" : "#dc2626"}">${inc > 0 || exp > 0 ? (net < 0 ? "−" : "") + fmt(net) : "—"}</td>
        </tr>`;
      }).join("");

      const html = `
        <h1>${year} Annual Report</h1>
        <p class="sub">Full-year summary</p>
        <div class="summary">
          <div class="card"><div class="card-label">Total Income</div><div class="card-value positive">${fmt(totalInc)}</div></div>
          <div class="card"><div class="card-label">Total Expenses</div><div class="card-value negative">${fmt(totalExp)}</div></div>
          <div class="card"><div class="card-label">Net Savings</div><div class="card-value ${savings >= 0 ? "positive" : "negative"}">${savings < 0 ? "−" : ""}${fmt(savings)}</div></div>
        </div>
        <div class="section-title">Month-by-Month Summary</div>
        <table>
          <thead><tr><th>Month</th><th style="text-align:right">Income (${currSymbol})</th><th style="text-align:right">Expenses (${currSymbol})</th><th style="text-align:right">Net Savings (${currSymbol})</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="font-weight:700;border-top:2px solid #e0e0e0">
            <td>Total</td>
            <td style="text-align:right;color:#16a34a">${fmt(totalInc)}</td>
            <td style="text-align:right;color:#dc2626">${fmt(totalExp)}</td>
            <td style="text-align:right;color:${savings >= 0 ? "#16a34a" : "#dc2626"}">${savings < 0 ? "−" : ""}${fmt(savings)}</td>
          </tr></tfoot>
        </table>`;

      await openPrintWindow(`WealthyNest ${year} Annual`, html);
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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year</p>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            data-testid="annual-report-year-select"
            className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-w-[100px]"
          >
            {years.map(y => (
              <option key={y} value={y}>
                {y}{y === currentYear ? " (current year)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleCsv}
              disabled={!!busy}
              data-testid="annual-report-csv-button"
              className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-muted/30 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left disabled:opacity-60"
            >
              <PremiumIcon icon={FileSpreadsheet} tone="emerald" size="sm" className={busy === "csv" ? "animate-pulse" : undefined} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  CSV {busy === "csv" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Month-by-month summary + full transaction list</p>
              </div>
            </button>
            <button
              onClick={handlePdf}
              disabled={!!busy}
              data-testid="annual-report-pdf-button"
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
