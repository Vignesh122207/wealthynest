"use client";

import { useState } from "react";
import {
  FileText, Download, FileSpreadsheet, Printer,
  BarChart2, CalendarDays, Database, Loader2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiClient } from "@/lib/axios";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { expensesApi } from "@/features/expenses/api/expenses.api";
import { accountsApi } from "@/features/accounts/api/accounts.api";
import { investmentsApi } from "@/features/investments/api/investments.api";
import { incomeApi } from "@/features/income/api/income.api";
import type { IncomeEntry } from "@/features/income/types/income.types";

// ─── constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TABS = [
  { id: "monthly", label: "Monthly",     icon: CalendarDays },
  { id: "annual",  label: "Annual",      icon: BarChart2    },
  { id: "export",  label: "Export Data", icon: Database     },
] as const;
type Tab = typeof TABS[number]["id"];

function getYears() {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function downloadCsv(url: string, filename: string) {
  const res  = await apiClient.get(url, { responseType: "blob" });
  const href = URL.createObjectURL(new Blob([res.data]));
  const a    = document.createElement("a");
  a.href = href; a.download = filename; a.click();
  // Defer revoke so browser has time to initiate the download
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

function triggerLocalCsv(filename: string, header: string[], rows: string[][]) {
  const esc = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"` : v;
  const csv  = [header.join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
  const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a    = document.createElement("a");
  a.href = href; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

async function openPrintWindow(title: string, htmlBody: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { toast.error("Allow pop-ups to save as PDF."); return; }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;font-size:13px;color:#111;padding:32px 40px}
    h1{font-size:20px;font-weight:700;margin-bottom:4px}
    .sub{color:#666;font-size:12px;margin-bottom:28px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    th{background:#f5f5f5;text-align:left;padding:8px 10px;font-size:12px;font-weight:600;border-bottom:2px solid #e0e0e0}
    td{padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:12px}
    tr:last-child td{border-bottom:none}
    .section-title{font-size:13px;font-weight:700;margin:20px 0 8px;color:#444;text-transform:uppercase;letter-spacing:.05em}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
    .card{background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px 16px}
    .card-label{font-size:11px;color:#888;margin-bottom:4px}
    .card-value{font-size:16px;font-weight:700}
    .positive{color:#16a34a} .negative{color:#dc2626}
    tfoot td{padding:9px 10px;font-size:13px}
    @media print{body{padding:16px 20px}button{display:none}}
  </style>
</head>
<body>
  ${htmlBody}
  <br/><br/>
  <button onclick="window.print()" style="padding:10px 24px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">
    Save as PDF
  </button>
</body>
</html>`);
  win.document.close();
}

// ─── Monthly tab ──────────────────────────────────────────────────────────────

function MonthlyTab() {
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
      const fmt = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

      // Category breakdown
      const catMap: Record<string, number> = {};
      expenses.forEach((e: { categoryName?: string; amount: number }) => {
        const cat = e.categoryName ?? "Other";
        catMap[cat] = (catMap[cat] ?? 0) + Number(e.amount);
      });
      const catRows = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `<tr><td>${cat}</td><td style="text-align:right">${fmt(amt)}</td><td style="text-align:right;color:#999">${totalExp > 0 ? ((amt/totalExp)*100).toFixed(1) : 0}%</td></tr>`)
        .join("") || `<tr><td colspan="3" style="color:#999;text-align:center;padding:12px">No expenses this month</td></tr>`;

      // Income by source
      const incMap: Record<string, number> = {};
      incomeEntries.forEach(e => {
        const src = e.source.replace(/_/g, " ");
        incMap[src] = (incMap[src] ?? 0) + Number(e.amount);
      });
      const incRows = Object.entries(incMap)
        .map(([src, amt]) => `<tr><td>${src}</td><td style="text-align:right;color:#16a34a">${fmt(amt)}</td></tr>`)
        .join("") || `<tr><td colspan="2" style="color:#999;text-align:center;padding:12px">No income recorded</td></tr>`;

      const html = `
        <h1>WealthyNest — ${label}</h1>
        <p class="sub">Monthly Report · Generated ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
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
      {/* Selectors */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-xs text-muted-foreground">Select a year and month to download your monthly financial report.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-w-[100px]"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-w-[140px]"
          >
            {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
          </select>
        </div>

        {isFuture && (
          <p className="text-xs text-amber-500 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2">
            This month is in the future — the report will be empty.
          </p>
        )}

        <div className="pt-1 flex items-start gap-3 flex-wrap">
          <button
            onClick={handleCsv}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-60 border border-emerald-500/20"
          >
            {busy === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Download CSV
          </button>
          <div>
            <button
              onClick={handlePdf}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all disabled:opacity-60 border border-indigo-500/20"
            >
              {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Save as PDF
            </button>
            <p className="text-xs text-muted-foreground/70 mt-1.5">
              Opens a print preview — use your browser&apos;s &ldquo;Save as PDF&rdquo; option to download.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          CSV includes income + expenses with category breakdown. PDF opens a print-ready summary — use your browser&apos;s Print dialog to save.
        </p>
      </div>
    </div>
  );
}

// ─── Annual tab ───────────────────────────────────────────────────────────────

function AnnualTab() {
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
      const fmt = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

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
        <h1>WealthyNest — ${year} Annual Report</h1>
        <p class="sub">Generated ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
        <div class="summary">
          <div class="card"><div class="card-label">Total Income</div><div class="card-value positive">${fmt(totalInc)}</div></div>
          <div class="card"><div class="card-label">Total Expenses</div><div class="card-value negative">${fmt(totalExp)}</div></div>
          <div class="card"><div class="card-label">Net Savings</div><div class="card-value ${savings >= 0 ? "positive" : "negative"}">${savings < 0 ? "−" : ""}${fmt(savings)}</div></div>
        </div>
        <div class="section-title">Month-by-Month Summary</div>
        <table>
          <thead><tr><th>Month</th><th style="text-align:right">Income (₹)</th><th style="text-align:right">Expenses (₹)</th><th style="text-align:right">Net Savings (₹)</th></tr></thead>
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
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-xs text-muted-foreground">Select a year to download your annual financial summary.</p>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-w-[100px]"
        >
          {years.map(y => (
            <option key={y} value={y}>
              {y}{y === currentYear ? " (current year)" : ""}
            </option>
          ))}
        </select>

        <div className="pt-1 flex items-start gap-3 flex-wrap">
          <button
            onClick={handleCsv}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-60 border border-emerald-500/20"
          >
            {busy === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Download CSV
          </button>
          <div>
            <button
              onClick={handlePdf}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all disabled:opacity-60 border border-indigo-500/20"
            >
              {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Save as PDF
            </button>
            <p className="text-xs text-muted-foreground/70 mt-1.5">
              Opens a print preview — use your browser&apos;s &ldquo;Save as PDF&rdquo; option to download.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Annual CSV includes month-by-month summary + full transaction list. PDF opens in a print-ready tab.
        </p>
      </div>
    </div>
  );
}

// ─── Export Data tab (moved from Settings) ────────────────────────────────────

function ExportTab() {
  const years  = getYears();
  const [year, setYear]   = useState(years[0]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  function setL(key: string, v: boolean) { setLoading(p => ({ ...p, [key]: v })); }

  function triggerCsv(filename: string, header: string[], rows: string[][]) {
    triggerLocalCsv(filename, header, rows);
  }

  async function handleExport(type: string) {
    setL(type, true);
    try {
      if (type === "expenses") {
        const res = await expensesApi.getExpenses({ startDate: `${year}-01-01`, endDate: `${year}-12-31`, size: 1000 });
        triggerCsv(`expenses-${year}.csv`,
          ["Date", "Category", "Amount", "Description", "Payment Method", "Recurring"],
          (res.data ?? []).map((e: { expenseDate: string; categoryName?: string; amount: number; description?: string; paymentMethod?: string; recurring?: boolean }) => [
            e.expenseDate, e.categoryName ?? "", e.amount.toString(),
            e.description ?? "", e.paymentMethod ?? "", e.recurring ? "Yes" : "No",
          ])
        );
      } else if (type === "accounts") {
        const accounts = await accountsApi.getAccounts();
        triggerCsv(`accounts-${year}.csv`,
          ["Name", "Type", "Bank", "Account Number", "Opening Balance", "Current Balance", "Total In", "Total Out"],
          accounts.map((a: { name: string; accountType: string; bankName?: string; accountNumber?: string; openingBalance: number; currentBalance: number; totalMoneyIn: number; totalMoneyOut: number }) => [
            a.name, a.accountType.replace(/_/g, " "), a.bankName ?? "", a.accountNumber ?? "",
            a.openingBalance.toString(), a.currentBalance.toString(),
            a.totalMoneyIn.toString(), a.totalMoneyOut.toString(),
          ])
        );
      } else if (type === "investments") {
        const investments = await investmentsApi.getInvestments();
        triggerCsv(`investments-${year}.csv`,
          ["Type", "Name", "Symbol", "Units", "Avg Buy Price", "Invested Amount", "Current Value", "Gain/Loss", "Gain/Loss %", "Purchase Date", "Maturity Date"],
          investments.map((inv: { investmentType: string; companyName?: string; symbol?: string; units?: number; avgBuyPrice?: number; investedAmount: number; currentValue: number; gainLoss: number; gainLossPct: number; purchaseDate?: string; maturityDate?: string }) => [
            inv.investmentType, inv.companyName ?? "", inv.symbol ?? "",
            inv.units?.toString() ?? "", inv.avgBuyPrice?.toString() ?? "",
            inv.investedAmount.toString(), inv.currentValue.toString(),
            inv.gainLoss.toString(), inv.gainLossPct.toFixed(2),
            inv.purchaseDate ?? "", inv.maturityDate ?? "",
          ])
        );
      } else if (type === "investment-income") {
        const history = await investmentsApi.getIncomeHistory();
        triggerCsv(`investment-income-${year}.csv`,
          ["Date", "Type", "Investment", "Symbol", "Amount", "Per Share", "Units", "Account"],
          (history.records ?? []).map((r: { eventDate: string; incomeType: string; investmentName: string; symbol?: string; amount: number; perShare?: number; units?: number; accountName?: string }) => [
            r.eventDate, r.incomeType.replace(/_/g, " "), r.investmentName,
            r.symbol ?? "", r.amount.toString(), r.perShare?.toString() ?? "",
            r.units?.toString() ?? "", r.accountName ?? "",
          ])
        );
      } else if (type === "income") {
        const entries: IncomeEntry[] = await incomeApi.getIncome(year);
        const INCOME_SOURCE_LABELS: Record<string, string> = {
          SALARY: "Salary", FREELANCE: "Freelance", BUSINESS: "Business",
          RENTAL: "Rental Income", INTEREST: "Interest", DIVIDEND: "Dividend",
          GIFT: "Gift", BONUS: "Bonus", OTHER: "Other",
        };
        triggerCsv(`income-${year}.csv`,
          ["Date", "Source", "Amount", "Description", "Payment Mode"],
          entries
            .filter(e => e.periodYear === year)
            .map(e => [
              e.incomeDate,
              INCOME_SOURCE_LABELS[e.source] ?? e.source.replace(/_/g, " "),
              e.amount.toString(),
              e.description ?? "",
              e.paymentMode === "CASH" ? "Cash" : "Bank Account",
            ])
        );
      } else if (type === "transfers") {
        // Fetch with large page size and filter client-side by year
        const res = await accountsApi.getTransfers(0, 1000);
        const transfers = (res.data ?? []).filter((t: { transferDate: string }) =>
          t.transferDate.startsWith(String(year))
        );
        triggerCsv(`transfers-${year}.csv`,
          ["Date", "From Account", "To Account", "Amount", "Description"],
          transfers.map((t: { transferDate: string; fromAccountName: string; toAccountName: string; amount: number; description?: string }) => [
            t.transferDate, t.fromAccountName, t.toAccountName,
            t.amount.toString(), t.description ?? "",
          ])
        );
      }
      toast.success("Download started.");
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setL(type, false);
    }
  }

  const EXPORTS = [
    { key: "expenses",          label: "Expenses",          desc: `All expense transactions for ${year} — date, category, amount, payment method` },
    { key: "income",            label: "Income",            desc: `Salary, freelance, rental and other income for ${year}` },
    { key: "transfers",         label: "Transfers",         desc: `Account-to-account transfers for ${year} — from, to, amount` },
    { key: "accounts",          label: "Accounts",          desc: "All accounts — type, bank, balances, total in/out" },
    { key: "investments",       label: "Investments",       desc: "Portfolio snapshot — type, name, invested amount, current value, gain/loss" },
    { key: "investment-income", label: "Investment Income", desc: "Dividends, coupons, and FD maturity payouts — date, amount, source" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Raw Data Export</h2>
          </div>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-muted border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Download your raw data as CSV files for use in spreadsheets or external tools.</p>

        <div className="space-y-3">
          {EXPORTS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => handleExport(key)}
                disabled={!!loading[key]}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:border-indigo-500/60 hover:bg-indigo-500/5 px-3 py-1.5 rounded-xl transition-all disabled:opacity-60 shrink-0"
              >
                {loading[key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                CSV
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("monthly");

  return (
    <>
      <Header title="Reports" />
      <PageWrapper>
        <div className="max-w-5xl space-y-6">

          {/* Intro */}
          <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Financial Reports & Exports</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Download monthly or annual reports as CSV or PDF. Export raw data for spreadsheets, tax filing, or CA consultations.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-2xl p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all",
                  tab === id
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content — kept mounted so selections are preserved on tab switch */}
          <div style={{ display: tab === "monthly" ? "block" : "none" }}><MonthlyTab /></div>
          <div style={{ display: tab === "annual"  ? "block" : "none" }}><AnnualTab  /></div>
          <div style={{ display: tab === "export"  ? "block" : "none" }}><ExportTab  /></div>

        </div>
      </PageWrapper>
    </>
  );
}
