"use client";

import {useState} from "react";
import {ChevronDown, HelpCircle, Mail} from "lucide-react";
import {cn} from "@/lib/utils";
import {PublicFooter, PublicNav} from "@/components/layout/PublicNav";
import {PremiumIcon} from "@/components/icons/PremiumIcon";

const FAQS = [
  {
    q: "How do I add a family member?",
    a: "Go to the Family tab and create a family group. You'll get a unique invite code — share it with your family member. They can join by entering the code on their Family page after signing up.",
  },
  {
    q: "How do I set up recurring expenses?",
    a: "When adding an expense, toggle on 'Recurring' and choose the frequency (daily, weekly, monthly). The app will automatically log the expense on schedule. You can manage recurring expenses from the Expenses tab.",
  },
  {
    q: "How do I track my investments?",
    a: "Open the Investments tab. You can add stocks (NSE), mutual funds, gold, fixed deposits and bonds. The app loads live NSE prices and calculates your XIRR automatically. EPF/PPF can be tracked as a net-worth asset from the Assets tab.",
  },
  {
    q: "Is my financial data safe?",
    a: "Yes. All data is encrypted in transit (HTTPS) and at rest. We never sell your data, never show ads, and never share your information with third parties. You can export or delete your data anytime from Settings.",
  },
  {
    q: "How do I export my data?",
    a: "Go to Settings → Download Data to export your accounts, expenses and investments as CSV files. You can also download monthly reports from the Reports tab.",
  },
  {
    q: "Does WealthyNest connect to my bank automatically?",
    a: "Not yet — you currently enter transactions manually or import via CSV. We are working on Account Aggregator integration (India's open banking framework) so your bank data syncs automatically.",
  },
  {
    q: "How do I set budget alerts?",
    a: "Create a budget in the Budgets tab. You can set an alert threshold (e.g. 80%). When your spending crosses that threshold, you'll get a notification in the app.",
  },
  {
    q: "Why am I getting push notifications on my phone, and how do I turn them off?",
    a: "The Android app sends a push notification for the same alerts you see in-app — budget breaches, low balance, spend anomalies, upcoming EMI/SIP due dates, and debt due dates. Go to Settings → Notifications to turn off any alert type; turning it off there stops both the in-app notification and the push notification for that type.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Settings → Profile → scroll to the bottom → Close Account. This deactivates your account and your data is retained; only an admin can reactivate it. See wealthynest.in/delete-account for full details, or email support@wealthynest.in if you need your data permanently erased instead.",
  },
  {
    q: "Can I import transactions from a bank or UPI statement?",
    a: "Yes — on the Transactions page, tap Import and upload a CSV export from your bank or UPI app. You'll get an editable preview to review categories and dates before anything is saved.",
  },
  {
    q: "What sign-in options does WealthyNest support?",
    a: "Email and password, Google sign-in, and passkeys (fingerprint, face, or screen lock) all work from the sign-in page. On a device you've already signed into, you can also set up a quick PIN unlock from Settings → Security.",
  },
  {
    q: "Can I change the currency symbol shown in the app?",
    a: "Yes — Settings → Appearance lets you pick INR, USD, EUR or GBP for how amounts are displayed. This only changes the symbol and formatting; it does not convert amounts between currencies.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm font-medium text-foreground pr-4">{q}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 space-y-16">

        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <PremiumIcon icon={HelpCircle} tone="cyan" size="md" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">How can we help?</h1>
          <p className="text-muted-foreground">
            Find answers to common questions or reach out directly.
          </p>
        </div>

        {/* FAQ */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <PremiumIcon icon={Mail} tone="indigo" size="sm" />
            <div>
              <p className="text-sm font-semibold text-foreground">Email support</p>
              <p className="text-xs text-muted-foreground">We reply within 48 hours</p>
            </div>
          </div>
          <a
            href="mailto:support@wealthynest.in"
            className="text-sm text-[#a85f30] dark:text-[#d98a52] hover:underline font-medium"
          >
            support@wealthynest.in
          </a>
        </section>

      </main>

      <PublicFooter />
    </div>
  );
}
