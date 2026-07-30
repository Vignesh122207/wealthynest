"use client";

import {useState} from "react";
import {FileSpreadsheet, FileText, Loader2} from "lucide-react";
import {toast} from "sonner";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {getStoredCurrency} from "@/lib/utils";
import {expensesApi} from "@/features/expenses/api/expenses.api";
import {incomeApi} from "@/features/income/api/income.api";
import {downloadCsv, getYears, MONTH_NAMES} from "@/lib/printReport";
import {fetchAllPages} from "@/lib/pagination";

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
      // Dynamic import — jsPDF + jspdf-autotable (lib/pdf/reportPdf.ts) are genuinely heavy and
      // have no reason to sit in every /reports visitor's initial bundle just because the PDF
      // button might get clicked; CSV export (handleCsv above) doesn't need either of them at all.
      const { addSectionTitle, addSummaryCards, addTable, createReportDoc, finalizePdf, pdfCurrencyPrefix, yieldToMain } =
        await import("@/lib/pdf/reportPdf");
      const [expenses, incomeEntries] = await Promise.all([
        fetchAllPages(page => expensesApi.getExpenses({ startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${lastDay}`, page, size: 500 })),
        incomeApi.getIncome(year, month),
      ]);
      const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const totalInc = incomeEntries.reduce((s, e) => s + Number(e.amount), 0);
      const savings  = totalInc - totalExp;
      const prefix = pdfCurrencyPrefix(getStoredCurrency());
      const fmt = (v: number) => `${v < 0 ? "-" : ""}${prefix}${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

      // Category breakdown
      const catMap: Record<string, number> = {};
      expenses.forEach(e => {
        const cat = e.categoryName ?? "Other";
        catMap[cat] = (catMap[cat] ?? 0) + Number(e.amount);
      });
      const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      const catRows = catEntries.map(([cat, amt]) => [
        cat, fmt(amt), totalExp > 0 ? `${((amt / totalExp) * 100).toFixed(1)}%` : "0%",
      ]);

      // Income by source
      const incMap: Record<string, number> = {};
      incomeEntries.forEach(e => {
        const src = e.source.replace(/_/g, " ");
        incMap[src] = (incMap[src] ?? 0) + Number(e.amount);
      });
      const incRows = Object.entries(incMap).map(([src, amt]) => [src, fmt(amt)]);

      await yieldToMain();
      const { doc, y } = createReportDoc(label, "Monthly Report");
      let cursor = addSummaryCards(doc, y, [
        { label: "Total Income", value: fmt(totalInc), tone: "positive" },
        { label: "Total Expenses", value: fmt(totalExp), tone: "negative" },
        { label: "Net Savings", value: fmt(savings), tone: savings >= 0 ? "positive" : "negative" },
      ]);

      cursor = addSectionTitle(doc, cursor, `Expenses by Category (${expenses.length} transactions)`);
      cursor = addTable(doc, cursor, ["Category", "Amount", "Share"],
        catRows.length > 0 ? catRows : [["No expenses this month", "", ""]],
        {
          foot: catRows.length > 0 ? [["Total", fmt(totalExp), ""]] : undefined,
          columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
        }
      );

      cursor = addSectionTitle(doc, cursor, "Income by Source");
      addTable(doc, cursor, ["Source", "Amount"],
        incRows.length > 0 ? incRows : [["No income recorded", ""]],
        {
          foot: incRows.length > 0 ? [["Total", fmt(totalInc)]] : undefined,
          columnStyles: { 1: { halign: "right" } },
        }
      );

      await finalizePdf(doc, `WealthyNest-${year}-${mm}-Monthly.pdf`);
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
              data-testid="monthly-report-year-select"
              aria-label="Report year"
              className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-w-[100px]"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              data-testid="monthly-report-month-select"
              aria-label="Report month"
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
              data-testid="monthly-report-csv-button"
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
              data-testid="monthly-report-pdf-button"
              className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-muted/30 hover:border-red-500/40 hover:bg-red-500/5 transition-all text-left disabled:opacity-60"
            >
              <PremiumIcon icon={FileText} tone="red" size="sm" className={busy === "pdf" ? "animate-pulse" : undefined} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  PDF {busy === "pdf" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Branded summary report, downloads instantly</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
