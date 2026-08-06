"use client";

import {type CSSProperties, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Landmark} from "lucide-react";
import {BankLogo} from "@/components/icons/BankLogo";
import {getBankMonogram} from "@/lib/bankLogos";
import {INDIAN_BANKS} from "@/lib/constants";
import {cn} from "@/lib/utils";

export function BankNameInput({ value, onChange, label = "Bank / Issuer Name", suggestions = INDIAN_BANKS, error }: {
  value: string; onChange: (v: string) => void; label?: string; suggestions?: string[]; error?: string;
}) {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState(value);
  const [style, setStyle]         = useState<CSSProperties>({});

  // Sync query when value prop changes (e.g. edit modal reopened with different account)
  const prevValue = useRef(value);
  if (prevValue.current !== value) { prevValue.current = value; if (!open) setQuery(value); }
  const inputRef                  = useRef<HTMLInputElement>(null);
  const filtered                  = suggestions.filter(b => b.toLowerCase().includes(query.toLowerCase()));

  const reposition = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8));
    setStyle({ position: "fixed", top: r.bottom + 4, left, width: r.width, zIndex: 9999 });
  };

  return (
    <div className="relative">
      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">{label}</label>
      <input ref={inputRef} data-testid="bank-name-input" value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); reposition(); }}
        onFocus={() => { setOpen(true); reposition(); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search or type…"
        className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 transition-all",
          error ? "border-red-500/60" : "border-border")} />
      {/* Portaled to <body> — the modal card has animate-scale-in (transform: scale(1) persists
          via fill-mode:both), which becomes the containing block for a plain `position: fixed`
          child, clipping/mispositioning it instead of anchoring to the viewport. Same fix as the
          account-card action menu needs. */}
      {open && filtered.length > 0 && typeof document !== "undefined" && createPortal(
        <div style={style} className="bg-card border border-border rounded-xl max-h-52 overflow-y-auto shadow-2xl">
          {filtered.map(b => {
            const monogram = getBankMonogram(b);
            return (
              <button key={b} type="button" onMouseDown={() => { onChange(b); setQuery(b); setOpen(false); }}
                className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/70 transition-colors first:rounded-t-xl last:rounded-b-xl">
                {monogram && <BankLogo name={b} fallbackIcon={Landmark} size="xs" />}
                {b}
              </button>
            );
          })}
        </div>,
        document.body
      )}
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
