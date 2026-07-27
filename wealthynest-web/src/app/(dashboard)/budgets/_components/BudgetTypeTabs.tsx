"use client";

import {Calendar, CalendarDays} from "lucide-react";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import type {BudgetType} from "@/features/budgets/types/budget.types";

// Same shared TabBar template as Accounts/Investments/Expenses. No "All" tab — unlike those
// pages, Monthly and Yearly budgets live on different time bases (a monthly amount recurs every
// month, a yearly one doesn't), so a combined list would mix numbers that don't actually compare
// — see budgets/page.tsx's own annualization comment for why the summary strip above has to
// convert before combining them, instead of just summing raw.
const TAB_COLOR: Record<BudgetType, string> = {
  MONTHLY: "#2563eb",
  YEARLY:  "#7c3aed",
};

interface BudgetTypeTabsProps {
  value: BudgetType;
  onChange: (t: BudgetType) => void;
  monthlyCount: number;
  yearlyCount: number;
}

export function BudgetTypeTabs({ value, onChange, monthlyCount, yearlyCount }: BudgetTypeTabsProps) {
  const items: TabBarItem<BudgetType>[] = [
    { key: "MONTHLY", label: "Monthly", icon: Calendar,     color: TAB_COLOR.MONTHLY, count: monthlyCount },
    { key: "YEARLY",  label: "Yearly",  icon: CalendarDays, color: TAB_COLOR.YEARLY,  count: yearlyCount },
  ];
  return <TabBar items={items} value={value} onChange={onChange} testIdPrefix="budget-list-tab" />;
}
