"use client";

import {useEffect, useRef, useState} from "react";
import {CheckCircle2, RefreshCw, Search, X} from "lucide-react";
import type {InvestmentSearchResult} from "@/features/investments/types/investment.types";

interface LiveSearchProps {
  placeholder: string;
  minChars?: number;
  onSearch: (q: string) => Promise<InvestmentSearchResult[]>;
  renderResult: (r: InvestmentSearchResult) => React.ReactNode;
  onSelect: (r: InvestmentSearchResult) => void;
}

export function LiveSearch({ placeholder, minChars = 2, onSearch, renderResult, onSelect }: LiveSearchProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<InvestmentSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (q.length < minChars) { setResults([]); setOpen(false); setError(null); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await Promise.race([
          onSearch(q),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
        ]);
        setResults(res.slice(0, 10));
        setOpen(res.length > 0);
        if (res.length === 0) setError("No results found. Try a different name.");
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "timeout")
          setError("Search timed out. Please try again.");
        else
          setError("Search failed. Check your connection.");
        setResults([]);
      } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [q, minChars, onSearch]);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full h-12 pl-10 pr-10 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-indigo-500 focus:bg-background transition-all" />
        {loading
          ? <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 animate-spin" />
          : q && <button type="button" onClick={() => { setQ(""); setResults([]); setOpen(false); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        }
      </div>
      {error && !open && q.length >= minChars && !loading && (
        <p className="text-xs text-amber-400 mt-1.5 pl-1">{error}</p>
      )}
      {open && results.length > 0 && (
        <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <button key={i} type="button"
              onClick={() => { onSelect(r); setQ(""); setResults([]); setOpen(false); }}
              className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0">
              {renderResult(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SelectedChip({ label, sub, onClear }: { label: string; sub?: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
      <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-4.5 h-4.5 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{label}</p>
        {sub && <p className="text-[11px] text-indigo-400/80 mt-0.5 font-mono">{sub}</p>}
      </div>
      <button type="button" onClick={onClear}
        className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground/80 hover:text-foreground shrink-0 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
