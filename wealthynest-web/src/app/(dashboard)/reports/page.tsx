"use client";

import {useState} from "react";
import {BarChart2, CalendarDays, Database, FileText} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {cn} from "@/lib/utils";
import {MonthlyTab} from "./_components/MonthlyTab";
import {AnnualTab} from "./_components/AnnualTab";
import {ExportTab} from "./_components/ExportTab";

const TABS = [
  { id: "monthly", label: "Monthly",     icon: CalendarDays },
  { id: "annual",  label: "Annual",      icon: BarChart2    },
  { id: "export",  label: "Export Data", icon: Database     },
] as const;
type Tab = typeof TABS[number]["id"];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("monthly");

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

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-2xl p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-testid={`reports-tab-${id}`}
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
