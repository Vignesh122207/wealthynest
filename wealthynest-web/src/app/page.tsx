import Link from "next/link";
import {
  Sprout, Shield, BarChart3, Users, Wallet,
  ArrowRight, TrendingUp, Target, IndianRupee,
} from "lucide-react";

const FEATURES = [
  { icon: Wallet,        color: "text-indigo-500",  bg: "bg-indigo-500/10",  title: "Asset Tracking",      desc: "Bank accounts, gold, real estate and stocks — your complete net worth in one view." },
  { icon: BarChart3,     color: "text-emerald-500", bg: "bg-emerald-500/10", title: "Smart Analytics",     desc: "Visualise where your money goes with beautiful, actionable charts and trends." },
  { icon: Shield,        color: "text-violet-500",  bg: "bg-violet-500/10",  title: "Private & Secure",    desc: "Your data is encrypted and never sold. Your financial life stays yours." },
  { icon: TrendingUp,    color: "text-cyan-500",    bg: "bg-cyan-500/10",    title: "Investment Tracker",  desc: "Track SIPs, mutual funds, dividends and XIRR — know your real returns." },
  { icon: Users,         color: "text-rose-500",    bg: "bg-rose-500/10",    title: "Family Finance",      desc: "Create a family group and manage shared expenses, budgets and goals together." },
  { icon: Target,        color: "text-amber-500",   bg: "bg-amber-500/10",   title: "Goal Planning",       desc: "Set savings goals, track progress and get a clear picture of when you'll hit them." },
];

const STATS = [
  { value: "₹10L+",   label: "Assets tracked" },
  { value: "100%",    label: "Private & offline-first" },
  { value: "6-in-1",  label: "Finance modules" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-border sticky top-0 bg-background/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Sprout className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">WealthyNest</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
            Sign in
          </Link>
          <Link href="/signup"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-colors font-medium shadow-sm">
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-4 pt-24 pb-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 shadow-sm">
          <IndianRupee className="w-3.5 h-3.5" />
          Built for Indian families
        </div>

        <h1 className="text-4xl lg:text-6xl font-bold tracking-tight max-w-3xl leading-tight mb-6 text-foreground">
          Your finances,{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent">
            finally clear
          </span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-lg mb-10 leading-relaxed">
          Track expenses, plan budgets, monitor investments and grow your wealth —
          all in one beautifully simple app.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <Link href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40">
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login"
            className="inline-flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold text-sm transition-all border border-border">
            Sign in
          </Link>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-8 lg:gap-16">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-2xl font-bold text-foreground">{value}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ──────────────────────────────────────────── */}
      <div className="w-full max-w-6xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="px-4 lg:px-12 py-20 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
            Everything your finances need
          </h2>
          <p className="text-muted-foreground">
            Six powerful modules. One simple app.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title}
              className="group bg-card border border-border rounded-2xl p-6 hover:border-indigo-500/40 hover:shadow-md transition-all">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-6xl mx-auto w-full">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-10 text-center text-white shadow-2xl shadow-indigo-500/20">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-8 w-32 h-32 rounded-full bg-white blur-2xl" />
            <div className="absolute bottom-4 right-8 w-40 h-40 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-2xl lg:text-3xl font-bold mb-3">Ready to take control?</h2>
            <p className="text-white/75 mb-6 max-w-md mx-auto">
              Join thousands of Indian families who track their finances with WealthyNest.
            </p>
            <Link href="/signup"
              className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg">
              Create free account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Sprout className="w-3 h-3 text-white" />
            </div>
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
