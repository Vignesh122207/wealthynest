"use client";

import {useEffect, useRef, useState} from "react";
import {Plus, X} from "lucide-react";
import {cn} from "@/lib/utils";

export type FabAction = {
  icon:     React.ElementType;
  label:    string;
  color:    "rose" | "emerald" | "indigo" | "amber" | "violet" | "sky" | "fuchsia" | "slate";
  onClick:  () => void;
  disabled?: boolean;
  /** Shown as a native tooltip when disabled — explains why instead of leaving a dead-looking button. */
  disabledReason?: string;
  hidden?:   boolean;
  testId?:   string;
};

const ITEM_STYLE: Record<string, { gradient: string; shadow: string }> = {
  rose:    { gradient: "from-rose-500 to-red-600",      shadow: "shadow-rose-500/30" },
  emerald: { gradient: "from-emerald-500 to-teal-600",  shadow: "shadow-emerald-500/30" },
  indigo:  { gradient: "from-indigo-500 to-blue-600",   shadow: "shadow-indigo-500/30" },
  amber:   { gradient: "from-amber-500 to-orange-500",  shadow: "shadow-amber-500/30" },
  violet:  { gradient: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/30" },
  sky:     { gradient: "from-sky-500 to-cyan-600",      shadow: "shadow-sky-500/30" },
  // Matches Goals' own fuchsia→purple identity (GoalForm/goals/page.tsx, matching the Sidebar
  // nav gradient for /goals) exactly — added rather than reusing violet so the FAB action
  // matches the form it opens pixel-for-pixel, not just approximately.
  fuchsia: { gradient: "from-fuchsia-500 to-purple-600", shadow: "shadow-fuchsia-500/30" },
  // Matches the Vault nav icon's Graphite Slate accent (Sidebar.tsx) — a deliberately dark,
  // steely pair, distinct from Budgets' amber→orange, to read as "vault/security" not "money".
  // Was copper until copper became the app's brand color — reassigned here to avoid the two
  // meaning the same thing.
  slate:   { gradient: "from-[#334155] to-[#64748b]", shadow: "shadow-[#64748b]/30" },
};

function FabItem({ icon: Icon, label, color, onClick, disabled, disabledReason, index, testId }: FabAction & { index: number }) {
  const style = ITEM_STYLE[color] ?? ITEM_STYLE.indigo;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      style={{ animationDelay: `${index * 35}ms` }}
      className={cn(
        "fab-item group flex items-center gap-3 h-11 pl-3 pr-5 rounded-2xl shadow-lg",
        "bg-gradient-to-r text-white text-sm font-semibold whitespace-nowrap",
        "transition-all duration-150 active:scale-95",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        style.gradient, style.shadow
      )}>
      <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </span>
      {label}
    </button>
  );
}

interface FloatingActionButtonProps {
  actions: FabAction[];
}

export function FloatingActionButton({ actions }: FloatingActionButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visibleActions = actions.filter(a => !a.hidden);

  return (
    <>
      <style>{`
        @keyframes fabItemIn {
          from { opacity:0; transform:translateY(12px) scale(0.90); }
          to   { opacity:1; transform:translateY(0)    scale(1); }
        }
        .fab-item { animation: fabItemIn 0.20s cubic-bezier(.34,1.56,.64,1) both; }
      `}</style>

      <div ref={ref} className="fixed bottom-[4.5rem] lg:bottom-6 right-4 lg:right-6 z-40 flex flex-col items-end gap-2">

        {open && visibleActions.map((action, i) => (
          <FabItem
            key={action.label}
            {...action}
            index={visibleActions.length - 1 - i}
            onClick={() => { setOpen(false); action.onClick(); }}
          />
        ))}

        <button
          type="button"
          data-testid="fab-toggle"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? "Close menu" : "Quick add"}
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center select-none",
            "transition-all duration-200",
            open
              ? "bg-slate-700/90 dark:bg-slate-600/90 shadow-lg backdrop-blur-sm"
              : [
                  "bg-gradient-to-br from-[#c2703d] to-[#27272a]",
                  "shadow-[0_6px_24px_rgba(194,112,61,0.50)]",
                  "hover:shadow-[0_8px_30px_rgba(194,112,61,0.65)] hover:scale-105",
                  "active:scale-95",
                ].join(" ")
          )}>
          {open
            ? <X    className="w-6 h-6 text-white transition-transform duration-200" />
            : <Plus className="w-6 h-6 text-white transition-transform duration-200" />
          }
        </button>
      </div>
    </>
  );
}
