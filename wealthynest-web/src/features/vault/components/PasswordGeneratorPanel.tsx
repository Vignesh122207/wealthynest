"use client";

import {useEffect, useState} from "react";
import {RefreshCw} from "lucide-react";
import {cn} from "@/lib/utils";
import {
  DEFAULT_GENERATOR_OPTIONS, GENERATOR_LENGTH_MAX, GENERATOR_LENGTH_MIN,
  PASSPHRASE_WORDS_MAX, PASSPHRASE_WORDS_MIN,
  type PasswordGeneratorOptions, generatePassphrase, generatePassword,
} from "../lib/passwordGenerator";

const VAULT_TO = "#c2703d";

type Mode = "random" | "passphrase";

/** Single call site (VaultItemForm) — kept as its own file for readability, not for reuse. */
export function PasswordGeneratorPanel({ onGenerate }: { onGenerate: (value: string) => void }) {
  const [mode, setMode]           = useState<Mode>("random");
  const [options, setOptions]     = useState<PasswordGeneratorOptions>(DEFAULT_GENERATOR_OPTIONS);
  const [wordCount, setWordCount] = useState(4);

  const regenerate = (m: Mode = mode, o: PasswordGeneratorOptions = options, w: number = wordCount) => {
    onGenerate(m === "random" ? generatePassword(o) : generatePassphrase(w));
  };

  // Generate once on mount so opening the panel immediately shows/fills a value.
  useEffect(() => { regenerate(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const setMode_ = (m: Mode) => { setMode(m); regenerate(m); };
  const setOptions_ = (patch: Partial<PasswordGeneratorOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next); regenerate(mode, next);
  };
  const setWordCount_ = (w: number) => { setWordCount(w); regenerate(mode, options, w); };

  return (
    <div className="mt-2 p-3 bg-muted/40 border border-border rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["random", "passphrase"] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode_(m)}
              className={cn(
                "h-7 px-3 rounded-lg text-xs font-medium transition-all",
                mode === m ? "text-white" : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              style={mode === m ? { backgroundColor: VAULT_TO } : undefined}>
              {m === "random" ? "Random" : "Passphrase"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => regenerate()} aria-label="Regenerate"
          className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {mode === "random" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Length</span>
            <span className="font-mono tabular-nums text-foreground">{options.length}</span>
          </div>
          <input type="range" min={GENERATOR_LENGTH_MIN} max={GENERATOR_LENGTH_MAX} value={options.length}
            onChange={(e) => setOptions_({ length: Number(e.target.value) })}
            className="w-full accent-[#c2703d]" style={{ accentColor: VAULT_TO }} />
          <div className="flex flex-wrap gap-3">
            {([
              ["upper", "A-Z"], ["digits", "0-9"], ["symbols", "!@#"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={options[key]} style={{ accentColor: VAULT_TO }}
                  onChange={(e) => setOptions_({ [key]: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-border bg-background cursor-pointer" />
                {label}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Words</span>
            <span className="font-mono tabular-nums text-foreground">{wordCount}</span>
          </div>
          <input type="range" min={PASSPHRASE_WORDS_MIN} max={PASSPHRASE_WORDS_MAX} value={wordCount}
            onChange={(e) => setWordCount_(Number(e.target.value))}
            className="w-full" style={{ accentColor: VAULT_TO }} />
        </div>
      )}
    </div>
  );
}
