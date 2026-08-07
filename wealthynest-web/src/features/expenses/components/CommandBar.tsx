"use client";

import {useState} from "react";
import {Sparkles, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {parseCommand, type ParsedCommand} from "../utils/commandParser";

interface CommandBarProps {
  categories: { id: string; name: string }[];
  onApply: (result: ParsedCommand) => void;
}

/** Lightweight natural-language command input — client-side keyword matching (see
 * commandParser.ts) against filters already on the page, not a real LLM-backed query engine.
 * Always shows exactly what it understood before/after applying, since a command bar that
 * silently changes filters with no confirmation is worse than not having one. */
export function CommandBar({ categories, onApply }: CommandBarProps) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState<ParsedCommand | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = parseCommand(query, categories);
    setApplied(result);
    if (result.matchedTerms.length > 0) onApply(result);
  };

  const clear = () => { setQuery(""); setApplied(null); };

  return (
    <div className="space-y-1.5">
      <form onSubmit={handleSubmit} className="relative flex-1 min-w-0">
        <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500/70" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Try “food spending vs income over the last 3 months”"
          data-testid="command-bar-input"
          className="w-full h-10 pl-9 pr-9 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all" />
        {query && (
          <button type="button" onClick={clear} aria-label="Clear command"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>
      {applied && (
        <p className={cn("text-xs px-1", applied.matchedTerms.length > 0 ? "text-indigo-500 dark:text-indigo-400" : "text-muted-foreground")}>
          {applied.matchedTerms.length > 0
            ? `Applied: ${applied.matchedTerms.join(" · ")}`
            : "Didn't catch a filter in that — try mentioning a category, a time range, or “income”/“expenses”."}
        </p>
      )}
    </div>
  );
}
