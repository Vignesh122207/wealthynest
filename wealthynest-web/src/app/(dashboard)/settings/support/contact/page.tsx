"use client";

import { ArrowLeft, Mail, Clock } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";

export default function ContactPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header title="Contact Us" />
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-6">

          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>

          {/* Page header */}
          <div className="flex items-center gap-3 pb-1">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Contact Us</p>
              <p className="text-xs text-muted-foreground mt-0.5">We&apos;re here to help</p>
            </div>
          </div>

          {/* Email card */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
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

        </div>
      </PageWrapper>
    </div>
  );
}
