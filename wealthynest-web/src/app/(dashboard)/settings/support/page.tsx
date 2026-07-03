"use client";

import { ArrowLeft, Mail, Ticket, Plus, HelpCircle, Shield, FileText, Coffee, ChevronRight, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import type { LucideIcon } from "lucide-react";

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1.5">{label}</p>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  href, icon: Icon, iconBg, label, description, external,
}: {
  href: string;
  icon: LucideIcon;
  iconBg: string;
  label: string;
  description: string;
  external?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/40 transition-colors group">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-4.5 h-4.5 text-white" size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return <Link href={href}>{inner}</Link>;
}

export default function SupportPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header title="Help & Support" />
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-6">

          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>

          {/* Icon header */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
              <LifeBuoy className="w-8 h-8 text-cyan-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">How can we help?</p>
              <p className="text-xs text-muted-foreground mt-1">Browse FAQs or reach out to us.</p>
            </div>
          </div>

          {/* Get Help */}
          <MenuGroup label="Get Help">
            <MenuItem
              href="/settings/support/contact"
              icon={Mail}
              iconBg="bg-indigo-500"
              label="Contact Us"
              description="Email support · reply within 48 hours"
            />
            <MenuItem
              href="/settings/support/tickets"
              icon={Ticket}
              iconBg="bg-violet-500"
              label="My Tickets"
              description="View and track your support requests"
            />
            <MenuItem
              href="/settings/support/tickets/new"
              icon={Plus}
              iconBg="bg-emerald-500"
              label="Create a Ticket"
              description="Report a bug or ask a question"
            />
          </MenuGroup>

          {/* Information */}
          <MenuGroup label="Information">
            <MenuItem
              href="/settings/support/faq"
              icon={HelpCircle}
              iconBg="bg-cyan-500"
              label="FAQ"
              description="Answers to common questions"
            />
            <MenuItem
              href="/privacy"
              icon={Shield}
              iconBg="bg-slate-500"
              label="Privacy Policy"
              description="How we handle your data"
              external
            />
            <MenuItem
              href="/terms"
              icon={FileText}
              iconBg="bg-slate-500"
              label="Terms of Service"
              description="Terms & conditions of use"
              external
            />
          </MenuGroup>

          {/* Support the app */}
          <MenuGroup label="Support the App">
            <MenuItem
              href="/settings/support/coffee"
              icon={Coffee}
              iconBg="bg-indigo-500"
              label="Support WealthyNest"
              description="Help keep the app free · pay via UPI"
            />
          </MenuGroup>

        </div>
      </PageWrapper>
    </div>
  );
}
