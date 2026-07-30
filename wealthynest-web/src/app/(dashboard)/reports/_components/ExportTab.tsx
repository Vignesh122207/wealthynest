"use client";

import {useState} from "react";
import {ArrowLeftRight, Coins, Database, Download, Landmark, LineChart, Loader2, Receipt, Wallet} from "lucide-react";
import {toast} from "sonner";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {expensesApi} from "@/features/expenses/api/expenses.api";
import {accountsApi} from "@/features/accounts/api/accounts.api";
import {investmentsApi} from "@/features/investments/api/investments.api";
import {incomeApi} from "@/features/income/api/income.api";
import type {IncomeEntry} from "@/features/income/types/income.types";
import {getYears, triggerLocalCsv} from "@/lib/printReport";
import {fetchAllPages} from "@/lib/pagination";

export function ExportTab() {
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
        const expenses = await fetchAllPages(page =>
          expensesApi.getExpenses({ startDate: `${year}-01-01`, endDate: `${year}-12-31`, page, size: 500 })
        );
        triggerCsv(`expenses-${year}.csv`,
          ["Date", "Category", "Amount", "Description", "Payment Method", "Recurring"],
          expenses.map(e => [
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
        // The transfers endpoint has no date filter — page through everything, then filter by year client-side
        const allTransfers = await fetchAllPages(page => accountsApi.getTransfers(page, 500));
        const transfers = allTransfers.filter(t => t.transferDate.startsWith(String(year)));
        triggerCsv(`transfers-${year}.csv`,
          ["Date", "From Account", "To Account", "Amount", "Description"],
          transfers.map(t => [
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
    { key: "expenses",          label: "Expenses",          icon: Receipt,        desc: `All expense transactions for ${year} — date, category, amount, payment method` },
    { key: "income",            label: "Income",            icon: Wallet,         desc: `Salary, freelance, rental and other income for ${year}` },
    { key: "transfers",         label: "Transfers",         icon: ArrowLeftRight, desc: `Account-to-account transfers for ${year} — from, to, amount` },
    { key: "accounts",          label: "Accounts",          icon: Landmark,       desc: "All accounts — type, bank, balances, total in/out" },
    { key: "investments",       label: "Investments",       icon: LineChart,      desc: "Portfolio snapshot — type, name, invested amount, current value, gain/loss" },
    { key: "investment-income", label: "Investment Income", icon: Coins,          desc: "Dividends, coupons, and FD maturity payouts — date, amount, source" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <PremiumIcon icon={Database} tone="indigo" size="sm" />
            <h2 className="text-sm font-semibold text-foreground">Raw Data Export</h2>
          </div>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-muted border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Download your raw data as CSV files for use in spreadsheets or external tools.</p>

        <div className="space-y-2">
          {EXPORTS.map(({ key, label, icon, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <PremiumIcon icon={icon} tone="gray" size="xs" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
              <button
                onClick={() => handleExport(key)}
                disabled={!!loading[key]}
                data-testid={`export-csv-${key}`}
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
