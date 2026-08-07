import {memo} from "react";
import {ArrowLeftRight, CreditCard, HandCoins, RefreshCw} from "lucide-react";
import {getCategoryColor, getCategoryIcon, INCOME_ICON_MAP} from "@/lib/categoryMeta";
import {badgeTextColor, PremiumIcon} from "@/components/icons/PremiumIcon";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useIsDark} from "@/hooks/useIsDark";
import {INCOME_SOURCES} from "@/lib/constants";
import type {Expense} from "@/features/expenses/types/expense.types";
import type {IncomeEntry} from "@/features/income/types/income.types";
import type {AccountTransfer} from "@/features/accounts/types/account.types";

// Debt-linked transfers carry a structured debtLabel + debtContactName so the counterparty is
// always visible in the badge, even when the row's own description was overwritten by a custom
// user note at creation time. Falls back to a generic "Debt" for any legacy row without these.
const DEBT_LABEL_TEXT: Record<string, string> = { LENT: "Lent", BORROWED: "Borrowed", REPAID: "Repaid" };

export function DebtBadge({ debtLabel, debtContactName }: { debtLabel?: string; debtContactName?: string }) {
  const label = debtLabel ? DEBT_LABEL_TEXT[debtLabel] ?? "Debt" : "Debt";
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
      {debtContactName ? `${label} · ${debtContactName}` : label}
    </span>
  );
}

// A muted interpunct separating the category pill from the account name in a row's subtext line
// ("[Category] • [Account]") — only rendered between two parts that both actually exist, never as
// a stray leading/trailing dot.
function Interpunct() {
  return <span className="text-xs text-muted-foreground/40" aria-hidden>•</span>;
}

export const ExpenseRow = memo(function ExpenseRow({ expense, accountName, onEdit, balance }: {
  expense:     Expense;
  accountName: string | undefined;
  onEdit:      () => void;
  /** Running account balance after this transaction — shown only by the "All" tab's merged feed. */
  balance?:    number;
}) {
  const { fmt } = useAmountFormatter();
  const isDark = useIsDark();
  const catIcon  = getCategoryIcon({ name: expense.categoryName ?? "", icon: expense.categoryIcon });
  const catColor = getCategoryColor(expense.categoryName ?? "", expense.categoryColor);
  // The row's title is the merchant/payee (the description, e.g. "Starbucks") — falling back to
  // the category name only when there's no description at all. When that fallback happens, the
  // category pill below would otherwise show the exact same text as the title directly above it;
  // suppressing it there avoids that literal duplicate.
  const title = expense.description || expense.categoryName || "Expense";
  const showCategoryPill = !!expense.categoryName && expense.categoryName !== title;
  return (
    <button type="button" onClick={onEdit}
      aria-label={`Edit ${title}, ${fmt(expense.amount)}`}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
      <PremiumIcon icon={catIcon} hex={catColor} size="sm" className="w-9 h-9" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate leading-5">{title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {showCategoryPill && (
            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: catColor + "18", color: badgeTextColor(catColor, isDark) }}>{expense.categoryName}</span>
          )}
          {showCategoryPill && accountName && <Interpunct />}
          {accountName && <span className="text-xs text-muted-foreground/80">{accountName}</span>}
          {expense.paymentMethod === "CREDIT_CARD" && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-500 dark:text-rose-400 font-medium">Card</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">−{fmt(expense.amount)}</p>
        {balance !== undefined && (
          <p className="text-[11px] text-muted-foreground/80 tabular-nums mt-0.5">Bal {fmt(balance)}</p>
        )}
      </div>
    </button>
  );
});

export const IncomeRow = memo(function IncomeRow({ entry, accountName, onEdit, balance }: {
  entry:       IncomeEntry;
  accountName: string | undefined;
  onEdit:      () => void;
  /** Running account balance after this transaction — shown only by the "All" tab's merged feed. */
  balance?:    number;
}) {
  const { fmt } = useAmountFormatter();
  const isDark = useIsDark();
  const src = INCOME_ICON_MAP[entry.source] ?? INCOME_ICON_MAP.OTHER;
  const sourceLabel = INCOME_SOURCES.find(s => s.value === entry.source)?.label ?? entry.source;
  const title = entry.description || sourceLabel;
  const showSourcePill = sourceLabel !== title;
  return (
    <button type="button" onClick={onEdit}
      aria-label={`Edit ${title}, ${fmt(entry.amount)}`}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
      <PremiumIcon icon={src.icon} hex={src.color} size="sm" className="w-9 h-9" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate leading-5">{title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {showSourcePill && (
            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: src.color + "20", color: badgeTextColor(src.color, isDark) }}>
              {sourceLabel}
            </span>
          )}
          {showSourcePill && accountName && <Interpunct />}
          {accountName && <span className="text-xs text-muted-foreground/80">{accountName}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">+{fmt(entry.amount)}</p>
        {balance !== undefined && (
          <p className="text-[11px] text-muted-foreground/80 tabular-nums mt-0.5">Bal {fmt(balance)}</p>
        )}
      </div>
    </button>
  );
});

export const TransferRow = memo(function TransferRow({ transfer, onEdit, balance }: {
  transfer: AccountTransfer;
  onEdit:   () => void;
  /** Running account balance after this transaction — shown only by the "All" tab's merged feed. */
  balance?: number;
}) {
  const { fmt } = useAmountFormatter();
  const isAdj  = transfer.adjustment;
  const isDebt = transfer.debt;
  const isIn   = !!transfer.toAccountId;
  const sign   = (isAdj || isDebt) ? (isIn ? "+" : "−") : "";
  const route  = `${transfer.fromAccountName} → ${transfer.toAccountName}`;
  const title  = transfer.description || route;
  // Only show the from→to route as a subtext line when the title is actually a real description —
  // when it fell back to the route itself, showing it again directly underneath would just repeat
  // the title verbatim.
  const showRouteSubtext = !!transfer.description;
  return (
    <button type="button" onClick={onEdit}
      aria-label={`Edit transfer, ${fmt(transfer.amount)}`}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
      <PremiumIcon icon={isDebt ? (isIn ? HandCoins : CreditCard) : isAdj ? RefreshCw : ArrowLeftRight}
        hex={isDebt ? (isIn ? "#14b8a6" : "#f43f5e") : undefined}
        tone={isDebt ? undefined : isAdj ? "gray" : "indigo"} size="sm" className="w-9 h-9" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate leading-5">{title}</p>
        {isDebt ? (
          <div className="mt-0.5">
            <DebtBadge debtLabel={transfer.debtLabel} debtContactName={transfer.debtContactName} />
          </div>
        ) : showRouteSubtext ? (
          <p className="text-xs text-muted-foreground/80 mt-0.5">{route}</p>
        ) : null}
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-bold tabular-nums",
          isDebt ? (isIn ? "text-teal-500 dark:text-teal-400" : "text-rose-500 dark:text-rose-400")
            : isAdj ? "text-muted-foreground" : "text-indigo-500 dark:text-indigo-400")}>
          {sign}{fmt(transfer.amount)}
        </p>
        {balance !== undefined && (
          <p className="text-[11px] text-muted-foreground/80 tabular-nums mt-0.5">Bal {fmt(balance)}</p>
        )}
      </div>
    </button>
  );
});
