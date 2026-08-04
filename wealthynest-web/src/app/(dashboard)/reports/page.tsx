"use client";

import {BarChart2, CalendarDays, Database, FileText} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import {useTabParam} from "@/hooks/useTabParam";
import {MonthlyTab} from "./_components/MonthlyTab";
import {AnnualTab} from "./_components/AnnualTab";
import {ExportTab} from "./_components/ExportTab";

const TAB_IDS = ["monthly", "annual", "export"] as const;
type Tab = (typeof TAB_IDS)[number];

const TABS: TabBarItem<Tab>[] = [
  { key: "monthly", label: "Monthly",     icon: CalendarDays, color: "#2563eb" },
  { key: "annual",  label: "Annual",      icon: BarChart2,    color: "#7c3aed" },
  { key: "export",  label: "Export Data", icon: Database,     color: "#059669" },
];

export default function ReportsPage() {
  const [tab, setTab] = useTabParam<Tab>(TAB_IDS, "monthly");

  return (
    <>
      <Header title="Reports" subtitle="Generate and export detailed financial reports" />
      <PageWrapper>
        <div className="max-w-5xl space-y-6">

          {/* Intro */}
          <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
            <PremiumIcon icon={FileText} tone="indigo" size="md" />
            <div>
              <p className="text-sm font-semibold text-foreground">Financial Reports & Exports</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Download monthly or annual reports as CSV or PDF. Export raw data for spreadsheets, tax filing, or CA consultations.
              </p>
            </div>
          </div>

          {/* Tabs — shared TabBar template. */}
          <TabBar items={TABS} value={tab} onChange={setTab} testIdPrefix="reports-tab" />

          {/* Tab content — kept mounted so selections are preserved on tab switch */}
          <div style={{ display: tab === "monthly" ? "block" : "none" }}><MonthlyTab /></div>
          <div style={{ display: tab === "annual"  ? "block" : "none" }}><AnnualTab  /></div>
          <div style={{ display: tab === "export"  ? "block" : "none" }}><ExportTab  /></div>

        </div>
      </PageWrapper>
    </>
  );
}
