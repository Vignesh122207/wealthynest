"use client";

import {BarChart2, Info, Loader2, LogIn, Plus, Sparkles, Target, TrendingUp} from "lucide-react";
import {GlossyBadge, PremiumIcon} from "@/components/icons/PremiumIcon";
import {MAX_MEMBERS} from "@/features/family/constants";

type Mode =
  | "idle" | "create" | "join" | "rename"
  | "makeAdmin" | "revokeAdmin" | "confirmRemove"
  | "confirmLeave" | "adminLeave" | "confirmDelete";

// ── No Family — hero + Create/Join cards, or the Create/Join forms themselves ──

export function NoFamilyOnboarding({
  mode, setMode, familyName, setFamilyName, inviteCode, setInviteCode,
  handleCreate, handleJoin, creating, joining, reset,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  familyName: string;
  setFamilyName: (v: string) => void;
  inviteCode: string;
  setInviteCode: (v: string) => void;
  handleCreate: () => void;
  handleJoin: () => void;
  creating: boolean;
  joining: boolean;
  reset: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      {mode === "idle" && (
        <div className="space-y-8">
          {/* Hero */}
          <div className="text-center pt-8 pb-1">
            <GlossyBadge hex="#5856D6" size="xl" className="mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" strokeWidth={2.25} />
            </GlossyBadge>
            <h2 className="text-2xl font-bold text-foreground mb-2">Bring your family&apos;s finances together</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Track shared expenses, budgets, and net worth with up to {MAX_MEMBERS} family
              members — everyone sees the same picture, in real time.
            </p>
          </div>

          {/* Create / Join cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <button onClick={() => setMode("create")} data-testid="family-create-card"
              className="flex flex-col items-center gap-3 p-7 bg-card border border-border hover:border-indigo-500/40 hover:bg-indigo-600/5 rounded-2xl transition-all group">
              <PremiumIcon icon={Plus} tone="indigo" size="lg" className="transition-transform group-hover:scale-105" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground mb-1">Create a Family</p>
                <p className="text-xs text-muted-foreground">Start a new group and invite up to {MAX_MEMBERS - 1} others</p>
              </div>
            </button>
            <button onClick={() => setMode("join")} data-testid="family-join-card"
              className="flex flex-col items-center gap-3 p-7 bg-card border border-border hover:border-emerald-500/40 hover:bg-emerald-600/5 rounded-2xl transition-all group">
              <PremiumIcon icon={LogIn} tone="emerald" size="lg" className="transition-transform group-hover:scale-105" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground mb-1">Join a Family</p>
                <p className="text-xs text-muted-foreground">Enter an invite code to join a group</p>
              </div>
            </button>
          </div>

          {/* Feature highlights */}
          <div>
            <p className="text-center text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-4">What you get</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: TrendingUp, tone: "violet" as const, title: "Combined Net Worth", desc: "See everyone's assets and debts combined, updated in real time." },
                { icon: Target,     tone: "orange" as const, title: "Shared Budgets",     desc: "Set spending limits together and track them as a family." },
                { icon: BarChart2,  tone: "indigo" as const, title: "Spending Insights",  desc: "See who's spending what, and where, every month." },
              ].map(f => (
                <div key={f.title} className="bg-card border border-border rounded-2xl p-5 text-center">
                  <PremiumIcon icon={f.icon} tone={f.tone} size="md" className="mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground mb-1">{f.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5 p-3.5 bg-muted/60 border border-border rounded-xl">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              A family group connects up to {MAX_MEMBERS} members — shared expense tracking, budgets, and net worth.
              Create a group and share the invite code, or enter a code to join an existing group.
            </p>
          </div>
        </div>
      )}

      {mode === "create" && (
        <div className="max-w-md mx-auto bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <PremiumIcon icon={Plus} tone="indigo" size="sm" />
            <h3 className="text-sm font-semibold text-foreground">Create a Family</h3>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Family Name</label>
            <input value={familyName} onChange={e => setFamilyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="e.g. The Kumars, Smith Family"
              data-testid="family-name-input"
              className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-colors"
              autoFocus />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={!familyName.trim() || creating} data-testid="family-create-submit"
              className="flex-1 h-10 rounded-xl text-sm font-medium bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 text-white transition-all disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : "Create Family"}
            </button>
            <button onClick={() => { reset(); setFamilyName(""); }}
              className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div className="max-w-md mx-auto bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <PremiumIcon icon={LogIn} tone="emerald" size="sm" />
            <h3 className="text-sm font-semibold text-foreground">Join a Family</h3>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Invite Code</label>
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder="e.g. AB12CD34" maxLength={8}
              data-testid="family-invite-code-input"
              className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-sm font-mono text-foreground placeholder-muted-foreground tracking-widest focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 transition-colors uppercase"
              autoFocus />
            <p className="text-xs text-muted-foreground">Ask your family admin for the 8-character invite code.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleJoin} disabled={inviteCode.length < 4 || joining} data-testid="family-join-submit"
              className="flex-1 h-10 rounded-xl text-sm font-medium bg-gradient-to-br from-emerald-700 to-emerald-600 shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-0.5 text-white transition-all disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2">
              {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : "Join Family"}
            </button>
            <button onClick={() => { reset(); setInviteCode(""); }}
              className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
