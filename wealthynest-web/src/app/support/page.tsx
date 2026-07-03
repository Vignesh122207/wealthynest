"use client";

import { useState } from "react";
import { ChevronDown, Mail, Coffee, MessageCircle, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicNav, PublicFooter } from "@/components/layout/PublicNav";

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
    a: "Open the Investments tab. You can add stocks (NSE), mutual funds, gold, fixed deposits, bonds, PPF and NPS. The app loads live NSE prices and calculates your XIRR automatically.",
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
    q: "How do I delete my account?",
    a: "Go to Settings → scroll to the bottom → Close Account. This permanently deletes all your data. This action cannot be undone.",
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

const UPI_ID = "vikkysachin12-1@oksbi";
const UPI_LINK = `upi://pay?pa=${UPI_ID}&pn=WealthyNest&cu=INR&tn=Support%20WealthyNest`;

function UpiSupport() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="bg-gradient-to-br from-amber-500/8 to-orange-500/8 border border-amber-500/20 rounded-2xl p-6 text-center">
      <div className="text-3xl mb-3">☕</div>
      <h2 className="text-base font-semibold text-foreground mb-2">Support WealthyNest</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
        WealthyNest is free forever with no ads. If it has helped your family manage money better,
        a coffee keeps the servers running and motivates future features.
      </p>

      {/* UPI ID chip with copy */}
      <div className="inline-flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-2.5 mb-4">
        <Coffee className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm font-mono font-medium text-foreground">{UPI_ID}</span>
        <button
          onClick={handleCopy}
          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy UPI ID"
        >
          {copied
            ? <Check className="w-3.5 h-3.5 text-emerald-500" />
            : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {copied ? "Copied! Paste in any UPI app." : "Copy and pay via GPay, PhonePe, Paytm or any UPI app."}
      </p>

      {/* Mobile UPI deep link */}
      <a
        href={UPI_LINK}
        className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-950 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
      >
        <Coffee className="w-4 h-4" />
        Pay via UPI app
      </a>
      <p className="text-xs text-muted-foreground mt-2">Opens GPay / PhonePe on mobile</p>
    </section>
  );
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 space-y-16">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 mb-5">
            <MessageCircle className="w-6 h-6 text-indigo-500" />
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
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Email support</p>
              <p className="text-xs text-muted-foreground">We reply within 48 hours</p>
            </div>
          </div>
          <a
            href="mailto:support@wealthynest.in"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            support@wealthynest.in
          </a>
        </section>

        {/* Support via UPI */}
        <UpiSupport />

      </main>

      <PublicFooter />
    </div>
  );
}
