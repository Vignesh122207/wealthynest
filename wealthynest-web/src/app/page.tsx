import Link from "next/link";
import {
    Bell,
    ChevronDown,
    CreditCard,
    Eye,
    FileText,
    Fingerprint,
    Gem,
    HeartHandshake,
    IndianRupee,
    KeyRound,
    Landmark,
    LineChart,
    Lock,
    type LucideIcon,
    PieChart,
    Receipt,
    ShieldCheck,
    Sparkles,
    Target,
    TrendingUp,
    Users,
    Wallet,
} from "lucide-react";
import {BrandMark} from "@/components/icons/BrandMark";
import {type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import {LandingClosingCTA, LandingHeroCTA, LandingNavCTA} from "@/components/layout/LandingCTA";
import {CountUp} from "@/components/shared/CountUp";
import {getCategoryColor, getCategoryIcon} from "@/lib/categoryMeta";

// ─── Real demo data — same helpers/tones the actual dashboard uses, fabricated
// numbers only. Every icon and color on this page is produced by the app's own
// resolvers (getCategoryIcon/getCategoryColor, ACCOUNT_TYPE hexes), not a
// separate "marketing site" palette, so this page shows what a new user will
// actually see, not an illustration of it. ─────────────────────────────────────

const SPENDING = [
  { name: "Groceries",     amount: "₹12,400" },
  { name: "Food & Dining", amount: "₹6,850" },
  { name: "Transport",     amount: "₹4,200" },
  { name: "Entertainment", amount: "₹3,100" },
];

const ACCOUNTS = [
  { label: "Bank Account", icon: Landmark,   hex: "#5856D6" },
  { label: "Cash Wallet",  icon: Wallet,     hex: "#34C759" },
  { label: "Credit Card",  icon: CreditCard, hex: "#FF375F" },
];

interface FeatureGroup {
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  gradient: [string, string];
  icon: LucideIcon;
  bullets: string[];
}

const GROUPS: FeatureGroup[] = [
  {
    id: "overview", eyebrow: "Overview", icon: Wallet,
    gradient: ["#0ea5e9", "#4f46e5"],
    heading: "Every account, one place",
    body: "Cash, bank accounts, credit cards, loans — add each once and WealthyNest keeps every balance current. Give a transaction a category, and its icon and color follow it everywhere: the transaction list, budgets, charts, filters. Never a mismatch.",
    bullets: ["Unified balance across every account type", "One category icon system, used consistently app-wide", "Statement CSV import, reviewed before anything is saved"],
  },
  {
    id: "planning", eyebrow: "Planning", icon: PieChart,
    gradient: ["#f59e0b", "#ea580c"],
    heading: "Budgets that actually warn you",
    body: "Set a monthly or yearly limit per category and get notified the moment you're close to breaching it — not when the statement arrives. Goals track toward a target date. Debts are tracked apart from investments, so what you own and what you owe never get confused.",
    bullets: ["Budget-breach alerts, in-app and instant", "Goals with real target dates and progress", "Debts kept separate from assets and investments", "Recurring income, transfers & goal contributions — set once, done"],
  },
  {
    id: "growth", eyebrow: "Growth", icon: TrendingUp,
    gradient: ["#10b981", "#16a34a"],
    heading: "Real returns, not guesses",
    body: "Stocks, mutual funds, gold, real estate, fixed deposits — track what you invested against what it's actually worth today, with XIRR so you see your true annualized return, not just a headline percentage.",
    bullets: ["XIRR on every holding, not just portfolio total", "Dividends tracked as their own income stream", "Net worth trend, going back as far as your data", "Mutual fund CAS import, even PDF-password protected"],
  },
  {
    id: "insights", eyebrow: "Insights", icon: LineChart,
    gradient: ["#14b8a6", "#06b6d4"],
    heading: "Built for the whole family",
    body: "Invite your family with a code and share budgets, expenses and goals — see who spent what, this month, at a glance. Export a branded report any time, and get notified the moment something needs your attention.",
    bullets: ["Shared budgets and per-member spending", "Split a bill with family and settle up with one tap", "Branded PDF & CSV reports, one click", "Smart alerts for low balance and unusual spending"],
  },
  {
    id: "vault", eyebrow: "Security", icon: KeyRound,
    gradient: ["#8b5cf6", "#6366f1"],
    heading: "A vault for everything else",
    body: "Passwords, PINs, and private notes don't belong in a notes app. WealthyNest's built-in vault encrypts every item, generates strong passwords for you, and holds 2FA codes alongside the login they belong to — so the family's other secrets live somewhere safer too.",
    bullets: ["Encrypted storage for passwords, PINs & secure notes", "Built-in password generator plus 2FA (TOTP) codes", "Vault Health flags reused or weak passwords"],
  },
];

const TRUST = [
  { icon: Lock,          title: "Encrypted, never sold", body: "Your data is encrypted at rest and in transit. No ads, no trackers reselling your spending habits." },
  { icon: Fingerprint,   title: "PIN & passkey login",   body: "Sign back in with a PIN or your device's Face ID / fingerprint. No password to phish or leak." },
  { icon: HeartHandshake, title: "Family-scoped, always", body: "Shared data stays inside your family group. Nothing about your money is visible outside it." },
  { icon: ShieldCheck,   title: "Free forever",           body: "No paid tier waiting behind a paywall, no feature held back to upsell you later." },
];

function MiniStat({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: IconTone; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <PremiumIcon icon={Icon} tone={tone} size="xs" />
        <span className="text-[10px] font-semibold text-muted-foreground/70 truncate">{label}</span>
      </div>
      <p className="text-base font-bold text-foreground tabular-nums tracking-tight leading-none">{value}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-border sticky top-0 bg-background/85 backdrop-blur-md z-30">
        <div className="flex items-center gap-2">
          <BrandMark boxClassName="w-8 h-8" iconClassName="w-6 h-6" />
          <span className="text-base font-bold tracking-tight text-foreground">WealthyNest</span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#security" className="hover:text-foreground transition-colors">Security</a>
        </div>
        <div className="flex items-center gap-3">
          <LandingNavCTA />
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative px-6 lg:px-12 pt-16 pb-24 lg:pt-24 lg:pb-32 overflow-hidden">
        {/* Ambient brand glow — same indigo/violet family as .hero-gradient, low opacity so it reads in both themes */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-[#c2703d]/10 blur-3xl" />
          <div className="absolute top-20 -right-32 w-[24rem] h-[24rem] rounded-full bg-[#935a35]/10 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">

          {/* Left — copy */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 bg-[#c2703d]/10 border border-[#c2703d]/25 text-[#a85f30] dark:text-[#d98a52] text-xs font-semibold px-4 py-1.5 rounded-full mb-7 shadow-sm">
              <IndianRupee className="w-3.5 h-3.5" />
              Built for Indian families
            </div>

            <h1 className="text-4xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.08] mb-6 text-foreground text-balance">
              <span className="bg-gradient-to-r from-[#a85f30] via-[#6b4526] to-[#c2703d] bg-clip-text text-transparent">
                One nest
              </span>{" "}
              for your entire financial life.
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
              Bank balances, gold, real estate, stocks, debts and goals — WealthyNest pulls your
              whole net worth into one dashboard, tracks every rupee you spend, and never shows
              you an ad to do it.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <LandingHeroCTA />
              <a href="#features"
                className="inline-flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-6 py-3.5 rounded-xl font-semibold text-sm transition-all border border-border">
                See what&rsquo;s inside <ChevronDown className="w-4 h-4" />
              </a>
            </div>

            {/* Trust chips — concrete, checkable claims, not a vanity stat row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
              {["Free forever", "No ads, ever", "Bank-grade encryption", "PIN & passkey login"].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — signature element: a faithful recreation of the real Home
              dashboard, built from the app's own PremiumIcon/category-resolver
              code with fabricated numbers, not a stock illustration. */}
          <div className="relative animate-fade-in-up delay-150 animate-float">
            {/* Peeking card behind — investment stat, offset + rotated for depth */}
            <div className="hidden sm:block absolute -left-6 -bottom-8 w-48 bg-card border border-border/80 rounded-2xl shadow-xl p-4 -rotate-6 opacity-90">
              <div className="flex items-center gap-1.5 mb-2">
                <PremiumIcon icon={TrendingUp} tone="emerald" size="xs" />
                <span className="text-[10px] font-semibold text-muted-foreground/70">Investments</span>
              </div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                <CountUp to={14.2} decimals={1} prefix="+" suffix="%" />
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">XIRR, all holdings</p>
            </div>

            {/* Main card */}
            <div className="relative bg-card border border-border/80 rounded-3xl shadow-2xl shadow-[#2a1608]/10 dark:shadow-black/40 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs text-muted-foreground">Good evening, Aditi</p>
                  <p className="text-sm font-bold text-foreground">Your Net Worth</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center relative shrink-0">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 ring-2 ring-card" />
                </div>
              </div>

              <p className="text-3xl font-extrabold text-foreground tabular-nums tracking-tight mb-1">
                <CountUp to={1842600} prefix="₹" />
              </p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-5">▲ 4.8% this month</p>

              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <MiniStat icon={Receipt} tone="red"   label="Expenses" value={<CountUp to={52300} prefix="₹" />} />
                <MiniStat icon={Wallet}  tone="green" label="Income"   value={<CountUp to={95000} prefix="₹" />} />
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Spending by category</p>
                <div className="space-y-2">
                  {SPENDING.map(s => (
                    <div key={s.name} className="flex items-center gap-2.5">
                      <PremiumIcon icon={getCategoryIcon({ name: s.name })} hex={getCategoryColor(s.name)} size="xs" />
                      <span className="text-xs text-foreground flex-1 truncate">{s.name}</span>
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">{s.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ──────────────────────────────────────────── */}
      <div className="w-full max-w-6xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── Features — the 4 real product groups, alternating layout ──────── */}
      <section id="features" className="px-6 lg:px-12 py-20 lg:py-24 max-w-6xl mx-auto w-full scroll-mt-16">
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-[#c2703d] uppercase tracking-widest mb-3">What&rsquo;s inside</p>
          <h2 className="text-2xl lg:text-3xl font-extrabold text-foreground mb-3 tracking-tight">
            Five ways WealthyNest keeps you ahead
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto" style={{ fontFamily: "var(--font-inter)" }}>
            Everything a real household&rsquo;s finances need — not an expense tracker with extra tabs bolted on.
          </p>
        </div>

        <div className="space-y-16 lg:space-y-24">
          {GROUPS.map((g, i) => {
            const reversed = i % 2 === 1;
            return (
              <div key={g.id} id={g.id}
                className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center scroll-mt-16 ${reversed ? "lg:[&>*:first-child]:order-2" : ""}`}>

                {/* Copy */}
                <div>
                  <div className="inline-flex items-center gap-2 mb-4">
                    <PremiumIcon icon={g.icon} gradient={g.gradient} size="sm" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{g.eyebrow}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">{g.heading}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-5" style={{ fontFamily: "var(--font-inter)" }}>{g.body}</p>
                  <ul className="space-y-2.5">
                    {g.bullets.map(b => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `linear-gradient(135deg, ${g.gradient[0]}, ${g.gradient[1]})` }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual */}
                <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
                  {g.id === "overview" && (
                    <div className="space-y-4">
                      <div className="flex gap-2.5">
                        {ACCOUNTS.map(a => (
                          <div key={a.label} className="flex-1 flex flex-col items-center gap-2 bg-muted/40 rounded-2xl py-4">
                            <PremiumIcon icon={a.icon} hex={a.hex} size="sm" />
                            <span className="text-[10px] font-medium text-muted-foreground text-center">{a.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 bg-muted/40 rounded-2xl px-4 py-3">
                        <PremiumIcon icon={getCategoryIcon({ name: "Groceries" })} hex={getCategoryColor("Groceries")} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Groceries</p>
                          <p className="text-xs text-muted-foreground">Big Bazaar · Today</p>
                        </div>
                        <span className="text-sm font-bold text-rose-500 tabular-nums">−₹1,240</span>
                      </div>
                    </div>
                  )}

                  {g.id === "planning" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/40 rounded-2xl p-4 flex flex-col items-center">
                        <div className="relative w-20 h-20 mb-2">
                          <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
                            <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
                            <circle cx="40" cy="40" r="34" fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 34}`} strokeDashoffset={`${2 * Math.PI * 34 * (1 - 0.72)}`} />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-foreground tabular-nums">72%</span>
                          </div>
                        </div>
                        <p className="text-xs font-medium text-foreground">Dining Budget</p>
                        <p className="text-[10px] text-muted-foreground">₹7,200 of ₹10,000</p>
                      </div>
                      <div className="bg-muted/40 rounded-2xl p-4 flex flex-col justify-center gap-3">
                        <div className="flex items-center gap-2">
                          <PremiumIcon icon={Target} gradient={["#d946ef", "#9333ea"]} size="xs" />
                          <span className="text-xs font-medium text-foreground">Emergency Fund</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600" style={{ width: "64%" }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">₹1,28,000 of ₹2,00,000</p>
                      </div>
                    </div>
                  )}

                  {g.id === "growth" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-muted/40 rounded-2xl px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <PremiumIcon icon={Gem} gradient={["#8b5cf6", "#c026d3"]} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Net Worth Trend</p>
                            <p className="text-[10px] text-muted-foreground">Last 6 months</p>
                          </div>
                        </div>
                        <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden>
                          <polyline points="0,22 14,18 28,20 42,12 56,9 72,4" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-muted/40 rounded-2xl p-3.5">
                          <p className="text-[10px] font-semibold text-muted-foreground/70 mb-1">Invested</p>
                          <p className="text-base font-bold text-foreground tabular-nums"><CountUp to={620000} prefix="₹" /></p>
                        </div>
                        <div className="bg-muted/40 rounded-2xl p-3.5">
                          <p className="text-[10px] font-semibold text-muted-foreground/70 mb-1">XIRR</p>
                          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"><CountUp to={14.2} decimals={1} prefix="+" suffix="%" /></p>
                        </div>
                      </div>
                    </div>
                  )}

                  {g.id === "insights" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 bg-muted/40 rounded-2xl px-4 py-3.5">
                        <div className="flex -space-x-2">
                          {["A", "R", "K"].map((letter, idx) => (
                            <div key={letter}
                              className="w-8 h-8 rounded-full ring-2 ring-card flex items-center justify-center text-[11px] font-bold text-white"
                              style={{ background: [`#6366f1`, `#f43f5e`, `#10b981`][idx] }}>
                              {letter}
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">3 family members</p>
                          <p className="text-[10px] text-muted-foreground">Shared budgets & goals</p>
                        </div>
                        <PremiumIcon icon={Users} tone="pink" size="xs" />
                      </div>
                      <div className="flex items-center gap-3 bg-muted/40 rounded-2xl px-4 py-3">
                        <PremiumIcon icon={FileText} tone="indigo" size="xs" />
                        <p className="text-xs text-foreground flex-1">Monthly-Report-July.pdf</p>
                        <span className="text-[10px] font-semibold text-[#c2703d]">Ready</span>
                      </div>
                    </div>
                  )}

                  {g.id === "vault" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 bg-muted/40 rounded-2xl px-4 py-3.5">
                        <PremiumIcon icon={KeyRound} gradient={["#8b5cf6", "#6366f1"]} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Netflix</p>
                          <p className="text-xs text-muted-foreground tracking-widest">••••••••••••</p>
                        </div>
                        <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-muted/40 rounded-2xl p-3.5">
                          <p className="text-[10px] font-semibold text-muted-foreground/70 mb-1">2FA code</p>
                          <p className="text-base font-bold text-foreground tabular-nums tracking-widest">482 913</p>
                        </div>
                        <div className="bg-muted/40 rounded-2xl p-3.5">
                          <p className="text-[10px] font-semibold text-muted-foreground/70 mb-1">Vault Health</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">No reuse found</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Security band ────────────────────────────────────── */}
      <section id="security" className="relative px-6 lg:px-12 py-20 lg:py-24 overflow-hidden scroll-mt-16">
        <div className="absolute inset-0 hero-gradient" aria-hidden />
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <div className="absolute top-8 left-12 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-4 right-16 w-72 h-72 rounded-full bg-white blur-3xl" />
        </div>
        {/* Softens the cut into/out of this section's flat purple against the dark sections above
            and below it — a hard color-block edge otherwise reads as an abrupt seam. */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-[#ecc9a3] uppercase tracking-widest mb-3">Why trust us with your money</p>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-3 tracking-tight">
              Private by default, not by promise
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRUST.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white/10 border border-white/15 rounded-2xl p-5 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-1.5 text-sm">{title}</h3>
                <p className="text-xs text-[#f5e3d3] leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Independent note ─────────────────────────────────── */}
      {/* Deliberately not a stat/testimonial section — there isn't a real user count or quote
          worth publishing yet, and inventing one for a finance app is exactly the kind of thing
          the "Free forever, no ads" pitch above is supposed to be a contrast to. This is the
          honest version of that same trust argument. */}
      <section className="px-6 py-16 max-w-2xl mx-auto w-full text-center">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Built independently — no VC funding, no ad network, no data broker deals. Just one
          developer building the finance app their own family needed. Nothing here to sell you
          but a better way to track your money.
        </p>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <section className="px-6 pb-20 lg:pb-24 pt-16 max-w-6xl mx-auto w-full text-center">
        <Sparkles className="w-6 h-6 text-[#c2703d] mx-auto mb-5" />
        <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground mb-4 tracking-tight text-balance">
          Give your money a home.
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-8" style={{ fontFamily: "var(--font-inter)" }}>
          Join the families already tracking their whole financial life in one place — free, forever.
        </p>
        <LandingClosingCTA />
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandMark boxClassName="w-7 h-7" iconClassName="w-5 h-5" roundedClassName="rounded-lg" />
            <span className="text-sm font-semibold text-foreground">WealthyNest</span>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} WealthyNest · Free forever · No ads · Built for Indian families.
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
