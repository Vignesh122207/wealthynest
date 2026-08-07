"use client";

import {useEffect, useRef, useState} from "react";
import {Plus, X} from "lucide-react";
import {cn} from "@/lib/utils";

export type FabAction = {
  icon:     React.ElementType;
  label:    string;
  color:    "rose" | "emerald" | "indigo" | "amber" | "violet" | "sky" | "fuchsia" | "vaultBrass";
  onClick:  () => void;
  disabled?: boolean;
  /** Shown as a native tooltip when disabled — explains why instead of leaving a dead-looking button. */
  disabledReason?: string;
  hidden?:   boolean;
  testId?:   string;
};

const ITEM_STYLE: Record<string, { gradient: string }> = {
  rose:    { gradient: "from-rose-500 to-red-600" },
  emerald: { gradient: "from-emerald-500 to-teal-600" },
  indigo:  { gradient: "from-indigo-500 to-blue-600" },
  amber:   { gradient: "from-amber-500 to-orange-500" },
  violet:  { gradient: "from-violet-500 to-purple-600" },
  sky:     { gradient: "from-sky-500 to-cyan-600" },
  // Matches Goals' own fuchsia→purple identity (GoalForm/goals/page.tsx, matching the Sidebar
  // nav gradient for /goals) exactly — added rather than reusing violet so the FAB action
  // matches the form it opens pixel-for-pixel, not just approximately.
  fuchsia: { gradient: "from-fuchsia-500 to-purple-600" },
  // Vault's own brass/graphite identity (see VaultHealthCard's "vault door" hero) — a deep bronze
  // pair, distinct from Budgets' amber→orange, to read as "vault/security" not "money". Kept dark
  // throughout the gradient (rather than running into the brighter brass used elsewhere in Vault)
  // so this pill's white label text stays readable at both ends.
  vaultBrass: { gradient: "from-[#1f1a10] to-[#8a6314]" },
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
        "fab-item group flex items-center gap-3 h-11 pl-3 pr-5 rounded-2xl",
        "bg-gradient-to-r text-white text-sm font-semibold whitespace-nowrap",
        "transition-all duration-150 active:scale-95",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        style.gradient
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

      {/* bottom-[...] (not a plain bottom-18 class): needs to clear MobileNav, whose real height
          varies with env(safe-area-inset-bottom) on gesture-nav devices — a flat rem value here
          overlapped MobileNav's own "More" button on exactly those devices. */}
      <div className="fixed bottom-[calc(5.5rem_+_env(safe-area-inset-bottom,0px))] lg:bottom-6 right-4 lg:right-6 z-40 flex flex-col items-end gap-2" ref={ref}>

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
              ? "bg-slate-700/90 dark:bg-slate-600/90 backdrop-blur-sm"
              : "bg-gradient-to-br from-[#c2703d] to-[#27272a] hover:scale-105 active:scale-95"
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
