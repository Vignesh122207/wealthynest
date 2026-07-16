"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// A small info-icon trigger that reveals a tip on hover/focus/tap — for supplementary
// guidance (e.g. password rules) that shouldn't cost permanent layout space next to a field.
export function InfoTooltip({ content, className }: { content: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="More info"
        className="text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 bottom-full right-0 mb-2 w-56 rounded-xl bg-foreground text-background text-xs leading-relaxed px-3 py-2.5 shadow-xl"
        >
          {content}
        </span>
      )}
    </span>
  );
}
