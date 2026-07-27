"use client";

import {Suspense, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {ArrowLeftRight, Flag, Receipt, TrendingUp} from "lucide-react";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import {IncomeTab} from "./_tabs/IncomeTab";
import {ExpensesTab} from "./_tabs/ExpensesTab";
import {TransfersTab} from "./_tabs/TransfersTab";
import {GoalsTab} from "./_tabs/GoalsTab";

type RuleType = "income" | "expenses" | "transfers" | "goals";

const TABS: TabBarItem<RuleType>[] = [
  { key: "income",    label: "Income",    icon: TrendingUp,     color: "#059669" },
  { key: "expenses",  label: "Expenses",  icon: Receipt,        color: "#e11d48" },
  { key: "transfers", label: "Transfers", icon: ArrowLeftRight, color: "#4f46e5" },
  { key: "goals",     label: "Goals",     icon: Flag,           color: "#c026d3" },
];

function RuleTypeTabs({ value, onChange }: { value: RuleType; onChange: (t: RuleType) => void }) {
  return <TabBar items={TABS} value={value} onChange={onChange} testIdPrefix="recurring-type-tab" />;
}

function RecurringRulesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const validTab: RuleType = (["income", "expenses", "transfers", "goals"] as const)
    .includes(initialTab as RuleType) ? (initialTab as RuleType) : "income";
  const [tab, setTab] = useState<RuleType>(validTab);

  const handleChange = (t: RuleType) => {
    setTab(t);
    router.replace(`/settings/recurring?tab=${t}`, { scroll: false });
  };

  return (
    <div className="flex flex-col flex-1">
      <Header title="Recurring Rules" subtitle="Everything that runs automatically on a schedule" />
      <PageWrapper>
        <RuleTypeTabs value={tab} onChange={handleChange} />
        {tab === "income"    && <IncomeTab />}
        {tab === "expenses"  && <ExpensesTab />}
        {tab === "transfers" && <TransfersTab />}
        {tab === "goals"     && <GoalsTab />}
      </PageWrapper>
    </div>
  );
}

export default function RecurringRulesPage() {
  return (
    <Suspense fallback={null}>
      <RecurringRulesContent />
    </Suspense>
  );
}
