"use client";

import {useMemo} from "react";
import {useDashboard} from "@/features/dashboard/hooks/useDashboard";
import {useGoals} from "@/features/goals/hooks/useGoals";
import {useIncomeHistory, useInvestments} from "@/features/investments/hooks/useInvestments";
import {useNotificationStore} from "@/store/notification.store";
import {formatCurrency} from "@/lib/utils";

export type NotifSeverity = "error" | "warning" | "success" | "info";
export type NotifType = "budget" | "income" | "goal" | "maturity" | "lowBalance" | "anomaly" | "debtDue" | "loanEmi";

export interface AppNotification {
  id:       string;
  type:     NotifType;
  title:    string;
  message:  string;
  severity: NotifSeverity;
  date?:    string;
}

const SEVERITY_ORDER: Record<NotifSeverity, number> = { error: 0, warning: 1, success: 2, info: 3 };

export function useNotifications() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: dashboard }       = useDashboard(year, month);
  const { data: incomeHistory }   = useIncomeHistory(year);
  const { data: goals }           = useGoals();
  const { data: investments = [] } = useInvestments();

  const { seenIds, dismissedIds, prefs } = useNotificationStore();

  const notifications = useMemo<AppNotification[]>(() => {
    const items: AppNotification[] = [];
    const nowMs = Date.now();

    // Budget alerts
    if (prefs.budgets) {
      for (const b of dashboard?.budgetSummaries ?? []) {
        if (b.overBudget) {
          items.push({
            id:       `budget-over-${b.categoryId}`,
            type:     "budget",
            title:    `Budget exceeded: ${b.categoryName}`,
            message:  `Spent ${formatCurrency(b.spent)} of ${formatCurrency(b.budgeted)} budget`,
            severity: "error",
          });
        } else if (b.percentUsed >= 80) {
          items.push({
            id:       `budget-warn-${b.categoryId}`,
            type:     "budget",
            title:    `Budget nearly full: ${b.categoryName}`,
            message:  `${b.percentUsed.toFixed(0)}% used — ${formatCurrency(b.budgeted - b.spent)} remaining`,
            severity: "warning",
          });
        }
      }
    }

    // Recent income events (last 7 days)
    if (prefs.income) {
      const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
      for (const r of incomeHistory?.records ?? []) {
        if (new Date(r.eventDate).getTime() >= sevenDaysAgo) {
          const label =
            r.incomeType === "DIVIDEND"    ? "Dividend credited"      :
            r.incomeType === "BOND_COUPON" ? "Bond coupon credited"   :
                                             "FD maturity credited";
          items.push({
            id:       `income-${r.id}`,
            type:     "income",
            title:    label,
            message:  `+${formatCurrency(r.amount)} from ${r.investmentName}`,
            severity: "success",
            date:     r.eventDate,
          });
        }
      }
    }

    // Goal milestones
    if (prefs.goals) {
      for (const g of goals ?? []) {
        if (g.percentSaved >= 100) {
          items.push({
            id:       `goal-done-${g.id}`,
            type:     "goal",
            title:    `Goal achieved: ${g.name}`,
            message:  `Reached target of ${formatCurrency(g.targetAmount)}!`,
            severity: "success",
          });
        } else if (g.percentSaved >= 50 && g.percentSaved < 60) {
          items.push({
            id:       `goal-half-${g.id}`,
            type:     "goal",
            title:    `Halfway there: ${g.name}`,
            message:  `${g.percentSaved.toFixed(0)}% of ${formatCurrency(g.targetAmount)} goal reached`,
            severity: "info",
          });
        }
      }
    }

    // FD / Bond maturing within 30 days
    if (prefs.maturity) {
      const thirtyDaysMs = nowMs + 30 * 24 * 60 * 60 * 1000;
      for (const inv of investments) {
        if ((inv.investmentType === "FD" || inv.investmentType === "BOND") && inv.maturityDate) {
          const matMs = new Date(inv.maturityDate).getTime();
          if (matMs >= nowMs && matMs <= thirtyDaysMs) {
            const daysLeft = Math.ceil((matMs - nowMs) / (1000 * 60 * 60 * 24));
            const label  = inv.investmentType === "FD" ? "FD" : "Bond";
            const issuer = inv.bankName ?? inv.companyName ?? "";
            items.push({
              id:       `maturity-${inv.id}`,
              type:     "maturity",
              title:    `${label} matures in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
              message:  `${issuer ? issuer + " — " : ""}${formatCurrency(inv.currentValue)}`,
              severity: daysLeft <= 7 ? "warning" : "info",
              date:     inv.maturityDate,
            });
          }
        }
      }
    }

    return items
      .filter((n) => !dismissedIds.includes(n.id))
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [dashboard, incomeHistory, goals, investments, prefs, dismissedIds]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !seenIds.includes(n.id)).length,
    [notifications, seenIds]
  );

  return { notifications, unreadCount };
}
