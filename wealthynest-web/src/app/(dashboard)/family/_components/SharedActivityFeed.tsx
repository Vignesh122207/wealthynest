import { Receipt } from "lucide-react";
import { PremiumIcon, GlossyBadge } from "@/components/icons/PremiumIcon";
import { getInitials } from "@/lib/utils";
import type { Expense } from "@/features/expenses/types/expense.types";

const firstName = (name: string) => name.trim().split(/\s+/).filter(Boolean)[0] || name;

// ── Shared activity feed ───────────────────────────────────────────────────────

export function SharedActivityFeed({
  recentFamilyExpenses, totalMonthExpenses, memberMap, memberColorMap, chartMonthLabel, fmt,
}: {
  recentFamilyExpenses: Expense[];
  totalMonthExpenses:   number;
  memberMap:      Map<string, string>;
  memberColorMap: Map<string, string>;
  chartMonthLabel: string;
  fmt: (n: number) => string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PremiumIcon icon={Receipt} tone="cobalt" size="xs" />
          <h3 className="text-sm font-semibold text-foreground">Shared Activity</h3>
        </div>
        <span className="text-xs text-muted-foreground">{chartMonthLabel}</span>
      </div>
      <div className="space-y-2.5">
        {recentFamilyExpenses.map(e => {
          const who    = memberMap.get(e.userId);
          const color  = memberColorMap.get(e.userId) ?? "#6366f1";
          const dayStr = new Date(e.expenseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          return (
            <div key={e.id} className="flex items-center gap-3">
              <GlossyBadge hex={color} size="xs" className="shrink-0">
                <span className="text-[9px] font-bold text-white">{who ? getInitials(who) : "?"}</span>
              </GlossyBadge>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{e.description || e.categoryName || "Expense"}</p>
                <p className="text-[10px] text-muted-foreground/60">
                  {who ? firstName(who) : "Member"} · {dayStr}
                  {e.categoryName && e.description && <span className="ml-1 text-muted-foreground/40">· {e.categoryName}</span>}
                </p>
              </div>
              <p className="text-xs font-semibold text-red-500 dark:text-red-400 tabular-nums shrink-0">−{fmt(e.amount)}</p>
            </div>
          );
        })}
        {totalMonthExpenses > 15 && (
          <div className="pt-1 text-center">
            <span className="text-xs text-muted-foreground/60">+{totalMonthExpenses - 15} more this month</span>
          </div>
        )}
      </div>
    </div>
  );
}
