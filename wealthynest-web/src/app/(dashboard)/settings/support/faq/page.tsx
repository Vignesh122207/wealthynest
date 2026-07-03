"use client";

import { useState } from "react";
import { ArrowLeft, HelpCircle, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    emoji: "👨‍👩‍👧",
    q: "How do I add a family member?",
    a: "Go to the Family tab and create a family group. You'll get a unique invite code — share it with your family member. They can join by entering the code on their Family page after signing up.",
  },
  {
    emoji: "🔄",
    q: "How do I set up recurring expenses?",
    a: "When adding an expense, toggle on 'Recurring' and choose the frequency (daily, weekly, monthly). The app will automatically log the expense on schedule. You can manage recurring expenses from the Expenses tab.",
  },
  {
    emoji: "📈",
    q: "How do I track my investments?",
    a: "Open the Investments tab. You can add stocks (NSE), mutual funds, gold, fixed deposits, bonds, PPF and NPS. The app loads live NSE prices and calculates your XIRR automatically.",
  },
  {
    emoji: "🔒",
    q: "Is my financial data safe?",
    a: "Yes. All data is encrypted in transit (HTTPS) and at rest. We never sell your data, never show ads, and never share your information with third parties. You can export or delete your data anytime from Reports.",
  },
  {
    emoji: "📊",
    q: "How do I download my reports?",
    a: "Go to Reports in the sidebar. You can select a month or year and download CSV or PDF reports. You can also export raw data for expenses, accounts, and investments.",
  },
  {
    emoji: "🏦",
    q: "Does WealthyNest connect to my bank automatically?",
    a: "Not yet — you currently enter transactions manually or import via CSV. We are working on Account Aggregator integration (India's open banking framework) so your bank data syncs automatically.",
  },
  {
    emoji: "🔔",
    q: "How do I set budget alerts?",
    a: "Create a budget in the Budgets tab. You can set an alert threshold (e.g. 80%). When your spending crosses that threshold, you'll get a notification in the app.",
  },
  {
    emoji: "🗑️",
    q: "How do I delete my account?",
    a: "Go to Settings → scroll to the bottom → Close account. This deactivates your account. Your data is retained and only an admin can reactivate it.",
  },
];

function FaqItem({ emoji, q, a }: { emoji: string; q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("bg-card border border-border rounded-2xl overflow-hidden transition-all", open && "ring-1 ring-indigo-500/20")}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-xl shrink-0 w-7 text-center">{emoji}</span>
        <span className="flex-1 text-sm font-medium text-foreground">{q}</span>
        {open
          ? <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 text-sm text-muted-foreground leading-relaxed border-t border-border/60 ml-[3.125rem]">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header title="FAQ" />
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-5">

          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 pb-1">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Frequently Asked Questions</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tap a question to see the answer</p>
            </div>
          </div>

          {/* FAQ list */}
          <div className="space-y-2">
            {FAQS.map(faq => (
              <FaqItem key={faq.q} emoji={faq.emoji} q={faq.q} a={faq.a} />
            ))}
          </div>


        </div>
      </PageWrapper>
    </div>
  );
}
