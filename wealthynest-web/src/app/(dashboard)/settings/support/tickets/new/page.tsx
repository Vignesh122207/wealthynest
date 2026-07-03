"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, TicketCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { useCreateTicket } from "@/features/support/hooks/useSupport";
import type { TicketCategory } from "@/features/support/types/support.types";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: TicketCategory; label: string; emoji: string; desc: string }[] = [
  { value: "BUG_REPORT",        emoji: "🐛", label: "Bug Report",       desc: "Something isn't working correctly" },
  { value: "FEATURE_REQUEST",   emoji: "✨", label: "Feature Request",  desc: "Suggest a new feature or improvement" },
  { value: "ACCOUNT_ISSUE",     emoji: "👤", label: "Account Issue",    desc: "Problems with your profile or access" },
  { value: "DATA_SYNC_ISSUE",   emoji: "🔄", label: "Data / Sync",      desc: "Data missing, incorrect, or not syncing" },
  { value: "GENERAL_QUESTION",  emoji: "❓", label: "General Question", desc: "Anything else you'd like to ask" },
];

export default function NewTicketPage() {
  const router = useRouter();
  const { mutate, isPending } = useCreateTicket();

  const [category, setCategory] = useState<TicketCategory>("GENERAL_QUESTION");
  const [subject,     setSubject]     = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (subject.trim().length < 5)       e.subject     = "Subject must be at least 5 characters";
    if (description.trim().length < 10)  e.description = "Description must be at least 10 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutate({ subject: subject.trim(), description: description.trim(), category }, {
      onSuccess: (ticket) => router.push(`/settings/support/tickets/${ticket.id}`),
    });
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="New Ticket" />
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-6">

          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Support
          </Link>

          {/* Header */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <TicketCheck className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">Create a Support Ticket</p>
              <p className="text-xs text-muted-foreground mt-1">Describe your issue and we&apos;ll respond in the app.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Category */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Category</p>
              <div className="grid grid-cols-1 gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                      category === c.value
                        ? "bg-indigo-500/10 border-indigo-500/40"
                        : "bg-card border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="text-xl shrink-0">{c.emoji}</span>
                    <div>
                      <p className={cn("text-sm font-medium", category === c.value ? "text-indigo-600 dark:text-indigo-400" : "text-foreground")}>
                        {c.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.desc}</p>
                    </div>
                    {category === c.value && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject + description */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground block">Subject</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Brief summary of your issue"
                  maxLength={200}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                {errors.subject && <p className="text-xs text-red-500">{errors.subject}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  Description
                  <span className="ml-1 text-muted-foreground/50 font-normal">({description.length}/5000)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail — steps to reproduce, what you expected vs what happened..."
                  rows={6}
                  maxLength={5000}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                />
                {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Ticket
            </button>

          </form>
        </div>
      </PageWrapper>
    </div>
  );
}
