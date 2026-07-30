"use client";

import {useMemo, useState} from "react";
import {Info, TrendingDown, TrendingUp} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {StockLogo} from "@/components/icons/StockLogo";
import {FundLogo} from "@/components/icons/FundLogo";
import {BankLogo} from "@/components/icons/BankLogo";
import {INVESTMENT_TYPE_META} from "@/lib/investmentTypeMeta";
import {cn, formatCurrency, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useXirr} from "@/features/investments/hooks/useInvestments";
import {StockTransactionModal} from "./StockTransactionModal";
import {StockTransactionHistoryPanel} from "./StockTransactionHistoryPanel";
import {InvestmentIncomePanel} from "./InvestmentIncomePanel";
import {SipSection} from "./SipSection";
import {fmtNum} from "../utils/formatNum";
import type {PickerAccountList} from "../constants";
import type {IncomeHistoryRecord, Investment} from "@/features/investments/types/investment.types";

// Annualized return (accounts for the timing of every buy/sell), shown only for Stock and Mutual
// Fund cards — the two types with variable, multi-dated cashflows where the plain gain % above
// can be misleading (a 3-year holding and a 2-month holding can show similar gain % while their
// true annualized pace is wildly different). FD/Bond already show coupon/accrued/maturity figures
// that tell that story better; Gold has no dated buy ledger, so its XIRR would just be its CAGR.
function XirrBadge({ investmentId }: { investmentId: string }) {
  const { data: xirr } = useXirr(investmentId);
  if (xirr == null) return null;
  return (
    <span
      title="Annualized return (XIRR) — accounts for the timing of every buy/sell, not just current value vs. invested"
      className={cn("text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full whitespace-nowrap",
        xirr >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
      {xirr >= 0 ? "+" : ""}{xirr.toFixed(1)}% XIRR
    </span>
  );
}

export function InvestmentCard({ inv, onEdit, dividendRecords, bankAccounts, investmentAccounts }: {
  inv: Investment; onEdit: () => void;
  dividendRecords?: IncomeHistoryRecord[];
  bankAccounts?: PickerAccountList; investmentAccounts?: PickerAccountList;
}) {
  const { fmt } = useAmountFormatter();
  const gain  = inv.gainLoss ?? (inv.currentValue - inv.investedAmount);
  const pct   = inv.gainLossPct ?? (inv.investedAmount > 0 ? ((inv.currentValue - inv.investedAmount) / inv.investedAmount) * 100 : 0);
  const typeMeta = INVESTMENT_TYPE_META[inv.investmentType];
  const isPos = gain >= 0;

  const daysToMaturity = useMemo(() => {
    if (!inv.maturityDate) return null;
    return Math.ceil((new Date(inv.maturityDate).getTime() - Date.now()) / 86400000);
  }, [inv.maturityDate]);

  const couponPerPeriod = useMemo(() => {
    if (inv.investmentType !== "BOND" || !inv.couponRate) return null;
    const n = inv.couponFrequency === "MONTHLY" ? 12 : inv.couponFrequency === "QUARTERLY" ? 4 :
              inv.couponFrequency === "HALF_YEARLY" ? 2 : 1;
    // Coupon rate applies to face value (avgBuyPrice × units), not the secondary market price
    const faceValueTotal = (inv.avgBuyPrice ?? 0) * (inv.units ?? 1);
    if (faceValueTotal <= 0) return null;
    return (faceValueTotal * inv.couponRate / 100) / n;
  }, [inv]);

  const displayName = inv.companyName ?? inv.symbol ?? inv.bankName ?? inv.investmentType;
  const [stockTxnModal, setStockTxnModal] = useState<"BUY" | "SELL" | null>(null);

  return (
    <>
    {stockTxnModal && (
      <StockTransactionModal inv={inv} type={stockTxnModal} onClose={() => setStockTxnModal(null)}
        bankAccounts={bankAccounts ?? []} investmentAccounts={investmentAccounts ?? []} />
    )}
    <div data-testid="investment-card" onClick={onEdit}
      className="relative bg-card border border-border rounded-2xl p-4 hover:border-indigo-500/40 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
      {/* Real, separately-focusable control for the same action the card's plain onClick above
          already does — a role="button" here would nest the Buy/Sell controls below inside
          another interactive widget (axe's nested-interactive rule), so the card itself stays a
          non-widget div and this sr-only-until-focused button is the keyboard/screen-reader path
          to Edit instead (see AccountCard.tsx's identical fix). */}
      <button type="button" onClick={onEdit}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-medium">
        Edit {displayName}
      </button>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {inv.investmentType === "STOCK" ? (
            <StockLogo symbol={inv.symbol} fallbackIcon={typeMeta.icon} fallbackHex={typeMeta.hex} size="md" className="shrink-0" />
          ) : inv.investmentType === "MUTUAL_FUND" ? (
            <FundLogo companyName={inv.companyName} fallbackIcon={typeMeta.icon} fallbackHex={typeMeta.hex} size="md" className="shrink-0" />
          ) : (inv.investmentType === "BOND" || inv.investmentType === "FD") ? (
            <BankLogo name={inv.bankName} fallbackIcon={typeMeta.icon} fallbackHex={typeMeta.hex} size="md" className="shrink-0" />
          ) : (
            <PremiumIcon icon={typeMeta.icon} hex={typeMeta.hex} size="md" className="shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              {daysToMaturity !== null && daysToMaturity < 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  Matured
                </span>
              )}
              {daysToMaturity !== null && daysToMaturity >= 0 && daysToMaturity <= 30 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                  {daysToMaturity === 0 ? "Matures today!" : `Matures in ${daysToMaturity}d`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {inv.symbol && <span className="text-xs text-muted-foreground/80">{inv.symbol} · {inv.exchange ?? "NSE"}</span>}
              {inv.purchaseDate && <span className="text-xs text-muted-foreground/80">Since {formatDate(inv.purchaseDate)}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-muted/50 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Invested</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{fmt(inv.investedAmount)}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Current Value</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{fmt(inv.currentValue)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
        <div className={cn("flex items-center gap-1 text-xs font-semibold tabular-nums whitespace-nowrap",
          isPos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPos ? "+" : ""}{fmt(gain)}
          <span className="text-xs font-normal">({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)</span>
        </div>

        {(inv.investmentType === "STOCK" || inv.investmentType === "MUTUAL_FUND") && (
          <XirrBadge investmentId={inv.id} />
        )}

        {inv.investmentType === "STOCK" && inv.units && (
          <span className="text-xs text-muted-foreground/80 tabular-nums whitespace-nowrap">
            {fmtNum(Number(inv.units))} shares × {formatCurrency(inv.livePrice ?? inv.currentPrice ?? 0)}
            {inv.dayChangePct != null && (
              <span className={cn("ml-1", inv.dayChangePct >= 0 ? "text-emerald-500" : "text-red-500")}>
                ({inv.dayChangePct >= 0 ? "+" : ""}{inv.dayChangePct.toFixed(2)}%)
              </span>
            )}
            {inv.priceLastUpdated && (
              <span className="ml-1 text-muted-foreground/80" title={`Price as of ${new Date(inv.priceLastUpdated).toLocaleString()}`}>
                · {new Date(inv.priceLastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            )}
          </span>
        )}
        {inv.investmentType === "MUTUAL_FUND" && inv.units && (
          <span className="text-xs text-muted-foreground/80 tabular-nums whitespace-nowrap">
            {fmtNum(Number(inv.units))} u × {formatCurrency(inv.livePrice ?? inv.currentPrice ?? 0)}
            {inv.priceLastUpdated && (
              <span className="ml-1 text-muted-foreground/80" title={`NAV as of ${new Date(inv.priceLastUpdated).toLocaleString()}`}>
                · {new Date(inv.priceLastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            )}
          </span>
        )}
        {(inv.investmentType === "GOLD" || inv.investmentType === "GOLD_ETF") && inv.quantityGrams && (
          <span className="text-xs text-muted-foreground/80 whitespace-nowrap">
            {inv.quantityGrams}g · {inv.goldKarat ?? 22}K
            {inv.priceLastUpdated && (
              <span className="ml-1 text-muted-foreground/80" title={`Rate as of ${new Date(inv.priceLastUpdated).toLocaleString()}`}>
                · {new Date(inv.priceLastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            )}
          </span>
        )}
        {(inv.investmentType === "FD" || inv.investmentType === "BOND") && inv.maturityDate && (
          <span className="text-xs text-muted-foreground/80 whitespace-nowrap">Matures {formatDate(inv.maturityDate)}</span>
        )}
      </div>

      {(inv.investmentType === "FD" || inv.investmentType === "BOND") && inv.accruedInterest != null && (
        <div className="mt-2 pt-2 border-t border-border/60 grid grid-cols-2 gap-2">
          <div>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground/80">
                {inv.investmentType === "BOND" ? "Coupon accrued" : "Accrued so far"}
              </p>
              <span title={inv.investmentType === "BOND"
                ? "Pro-rata coupon income accrued from purchase date to today, net of TDS."
                : "Interest earned from purchase date to today. The full amount is credited to your income on the maturity date."}>
                <Info className="w-2.5 h-2.5 text-muted-foreground/60 cursor-help" />
              </span>
            </div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{fmt(inv.accruedInterest)}</p>
          </div>
          {inv.maturityAmount != null && (
            <div>
              <p className="text-xs text-muted-foreground/80">At maturity</p>
              <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">{fmt(inv.maturityAmount)}</p>
            </div>
          )}
        </div>
      )}

      {inv.investmentType === "BOND" && couponPerPeriod != null && (
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/80">
            {inv.couponRate}% {inv.couponFrequency?.toLowerCase()} coupon
            {inv.couponCreditDay && ` · credit day ${inv.couponCreditDay}`}
          </span>
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 tabular-nums">{fmt(couponPerPeriod)}/period</span>
        </div>
      )}

      {/* Auto-income credit note */}
      {inv.linkedAccountId && (
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-1.5">
          <Info className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs text-muted-foreground/80">
            {inv.investmentType === "STOCK"   ? "Dividends" :
             inv.investmentType === "BOND"    ? "Coupons" :
             inv.investmentType === "FD"      ? "Maturity payout" :
             "Income"} auto-credited to linked account
          </span>
        </div>
      )}

      {/* Per-investment dividend / coupon history panel — stops propagation so its own
          expand/add/delete controls don't also trigger the card's onEdit click. */}
      {dividendRecords !== undefined && (
        <div onClick={e => e.stopPropagation()}>
          <InvestmentIncomePanel
            records={dividendRecords}
            label={inv.investmentType === "BOND" ? "Coupons" : "Dividends"}
            accentColor={inv.investmentType === "BOND" ? "text-violet-600 dark:text-violet-400" : "text-indigo-600 dark:text-indigo-400"}
          />
        </div>
      )}

      {inv.investmentType === "MUTUAL_FUND" && inv.sipAmount && inv.nextSipDate && (
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/80">
            Next SIP · {formatDate(inv.nextSipDate)}
          </span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(inv.sipAmount)}</span>
        </div>
      )}

      {/* SIP section for Mutual Funds */}
      {inv.investmentType === "MUTUAL_FUND" && (
        <div onClick={e => e.stopPropagation()}>
          <SipSection investmentId={inv.id} />
        </div>
      )}

      {/* Buy More / Sell buttons for Stocks */}
      {inv.investmentType === "STOCK" && (
        <div onClick={e => e.stopPropagation()}>
          <div className="mt-2 pt-2 border-t border-border/60 flex gap-2">
            <button onClick={() => setStockTxnModal("BUY")}
              className="flex-1 h-7 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all">
              Buy
            </button>
            <button onClick={() => setStockTxnModal("SELL")}
              className="flex-1 h-7 rounded-lg text-xs font-semibold bg-red-600/20 hover:bg-red-600/30 text-red-600 dark:text-red-400 border border-red-500/20 transition-all">
              Sell
            </button>
          </div>
          <StockTransactionHistoryPanel investmentId={inv.id} />
        </div>
      )}
    </div>
    </>
  );
}
