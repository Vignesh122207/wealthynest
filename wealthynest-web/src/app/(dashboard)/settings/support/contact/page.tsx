"use client";

import {ArrowLeft, ChevronRight, Clock, HelpCircle, Mail, Ticket} from "lucide-react";
import Link from "next/link";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {PremiumIcon} from "@/components/icons/PremiumIcon";

export default function ContactPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header title="Contact Us" subtitle="Send us a message and we'll get back to you" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-6">

          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>

          {/* Page header */}
          <div className="flex items-center gap-3 pb-1">
            <PremiumIcon icon={Mail} tone="indigo" size="md" />
            <div>
              <p className="text-base font-semibold text-foreground">Contact Us</p>
              <p className="text-xs text-muted-foreground mt-0.5">We&apos;re here to help</p>
            </div>
          </div>

          {/* Email card */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <PremiumIcon icon={Mail} tone="indigo" size="xs" />
              <p className="text-sm font-semibold text-foreground">Email Support</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-muted/60 rounded-xl px-3.5 py-3">
                <span className="text-sm font-mono text-foreground">support@wealthynest.in</span>
                <a
                  href="mailto:support@wealthynest.in"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0 ml-2"
                >
                  <Mail className="w-3 h-3" /> Send
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                We typically reply within 48 hours on business days.
              </div>
            </div>
          </div>

          {/* Other ways to get help */}
          <div className="space-y-2">
            <Link href="/settings/support/faq"
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 hover:bg-muted/40 transition-colors group">
              <PremiumIcon icon={HelpCircle} tone="cyan" size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">FAQ</p>
                <p className="text-xs text-muted-foreground truncate">Answers to common questions</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
            <Link href="/settings/support/tickets"
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 hover:bg-muted/40 transition-colors group">
              <PremiumIcon icon={Ticket} tone="violet" size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">My Tickets</p>
                <p className="text-xs text-muted-foreground truncate">Track your support requests</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          </div>

        </div>
      </PageWrapper>
    </div>
  );
}
