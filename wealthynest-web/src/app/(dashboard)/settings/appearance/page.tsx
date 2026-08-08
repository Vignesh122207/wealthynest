"use client";

import {Monitor, Moon, Sun} from "lucide-react";
import {useTheme} from "next-themes";
import {useEffect, useState} from "react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {CurrencyGlyph} from "@/components/icons/CurrencyGlyph";
import {CURRENCIES, usePrefsStore} from "@/store/preferences.store";
import {cn} from "@/lib/utils";

const THEMES = [
  { id: "light",  label: "Light",  icon: Sun,     desc: "Clean white background" },
  { id: "dark",   label: "Dark",   icon: Moon,    desc: "Easy on the eyes at night" },
  { id: "system", label: "System", icon: Monitor, desc: "Follows your device setting" },
] as const;

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = usePrefsStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col flex-1">
      <Header title="Appearance" subtitle="Customize theme and how WealthyNest looks" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-6">

          {/* Icon header */}
          <div className="flex flex-col items-center gap-3 py-2">
            <PremiumIcon icon={Sun} tone="orange" size="xl" />
            <p className="text-base font-semibold text-foreground">Appearance</p>
          </div>

          {/* Theme picker */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Theme</p>
            {mounted && (
              <div className="grid grid-cols-3 gap-3">
                {THEMES.map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    data-testid={`theme-option-${id}`}
                    className={cn(
                      "flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all",
                      theme === id
                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/40"
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <div className="text-center flex-1">
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] leading-tight mt-0.5 opacity-70">{desc}</p>
                    </div>
                    {theme === id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Currency picker */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Currency</p>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code as Parameters<typeof setCurrency>[0])}
                  data-testid={`currency-option-${c.code}`}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
                    currency === c.code
                      ? "bg-indigo-500/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  {/* w-7 text-lg fit a single glyph (₹/$/€/£) — S$ needs a touch more room, and
                      AED renders its real 2025 dirham sign as an SVG (no shipping font has the
                      character yet — see DirhamSign's own comment), sized to match the others'
                      visual weight rather than the icon's native (much bulkier) proportions. */}
                  <span className="w-10 h-6 flex items-center justify-center shrink-0 text-foreground">
                    <CurrencyGlyph code={c.code} className="h-3 w-auto text-sm font-semibold whitespace-nowrap" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", currency === c.code ? "text-indigo-600 dark:text-indigo-400" : "text-foreground")}>
                      {c.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.code}</p>
                  </div>
                  {currency === c.code && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      </PageWrapper>
    </div>
  );
}
