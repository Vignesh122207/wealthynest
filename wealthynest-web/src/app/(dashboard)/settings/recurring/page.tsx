"use client";

import {Suspense, useState} from "react";
import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {ArrowLeft, ArrowLeftRight, Flag, Receipt, TrendingUp} from "lucide-react";
import {cn} from "@/lib/utils";
import {IncomeTab} from "./_tabs/IncomeTab";
import {ExpensesTab} from "./_tabs/ExpensesTab";
import {TransfersTab} from "./_tabs/TransfersTab";
import {GoalsTab} from "./_tabs/GoalsTab";

type RuleType = "income" | "expenses" | "transfers" | "goals";

const TABS: { key: RuleType; label: string; icon: React.ElementType; activeBg: string }[] = [
  { key: "income",    label: "Income",    icon: TrendingUp,     activeBg: "bg-emerald-600" },
  { key: "expenses",  label: "Expenses",  icon: Receipt,        activeBg: "bg-rose-600" },
  { key: "transfers", label: "Transfers", icon: ArrowLeftRight, activeBg: "bg-indigo-600" },
  { key: "goals",     label: "Goals",     icon: Flag,           activeBg: "bg-fuchsia-600" },
];

function RuleTypeTabs({ value, onChange }: { value: RuleType; onChange: (t: RuleType) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto max-w-full" style={{ scrollbarWidth: "none" }}>
      {TABS.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn(
            "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
            value === t.key ? cn(t.activeBg, "text-white") : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
          )}>
          <t.icon className="w-3.5 h-3.5" /> {t.label}
        </button>
      ))}
    </div>
  );
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
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Settings
        </Link>
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
