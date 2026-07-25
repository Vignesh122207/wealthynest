"use client";

import {useEffect, useState} from "react";
import {Check, RefreshCw} from "lucide-react";
import {cn} from "@/lib/utils";
import {
  DEFAULT_GENERATOR_OPTIONS, GENERATOR_LENGTH_MAX, GENERATOR_LENGTH_MIN,
  PASSPHRASE_WORDS_MAX, PASSPHRASE_WORDS_MIN,
  type PasswordGeneratorOptions, generatePassphrase, generatePassword,
} from "../lib/passwordGenerator";

const VAULT_BRASS_LIGHT = "#f6d776";
const VAULT_BRASS_DEEP = "#a9791a";
const VAULT_BRASS_TEXT = "#241705";

type Mode = "random" | "passphrase";

/** Single call site (VaultItemForm) — kept as its own file for readability, not for reuse.
 * Matches the Vault redesign prototype's generate panel: a live monospace preview of the
 * candidate value with explicit Regenerate/"Use this" actions, rather than silently overwriting
 * the real password field on every option change (dirtying the form before the user has actually
 * chosen a value, and giving no on-panel confirmation of what's about to be written). */
export function PasswordGeneratorPanel({ onUse }: { onUse: (value: string) => void }) {
  const [mode, setMode]           = useState<Mode>("random");
  const [options, setOptions]     = useState<PasswordGeneratorOptions>(DEFAULT_GENERATOR_OPTIONS);
  const [wordCount, setWordCount] = useState(4);
  const [preview, setPreview]     = useState("");

  const regenerate = (m: Mode = mode, o: PasswordGeneratorOptions = options, w: number = wordCount) => {
    setPreview(m === "random" ? generatePassword(o) : generatePassphrase(w));
  };

  // Generate once on mount so opening the panel immediately shows a preview.
  useEffect(() => { regenerate(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const setMode_ = (m: Mode) => { setMode(m); regenerate(m); };
  const setOptions_ = (patch: Partial<PasswordGeneratorOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next); regenerate(mode, next);
  };
  const setWordCount_ = (w: number) => { setWordCount(w); regenerate(mode, options, w); };

  return (
    <div className="mt-2 p-3 bg-muted/40 border border-dashed border-border rounded-2xl space-y-3">
      <div className="flex gap-1.5">
        {(["random", "passphrase"] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode_(m)}
            className={cn(
              "h-7 px-3 rounded-lg text-xs font-semibold transition-all",
              mode !== m && "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            style={mode === m ? { background: `linear-gradient(135deg, ${VAULT_BRASS_LIGHT}, ${VAULT_BRASS_DEEP})`, color: VAULT_BRASS_TEXT } : undefined}>
            {m === "random" ? "Random" : "Passphrase"}
          </button>
        ))}
      </div>

      {mode === "random" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Length</span>
            <span className="font-mono tabular-nums text-foreground">{options.length}</span>
          </div>
          <input type="range" min={GENERATOR_LENGTH_MIN} max={GENERATOR_LENGTH_MAX} value={options.length}
            onChange={(e) => setOptions_({ length: Number(e.target.value) })}
            className="w-full accent-[#a9791a]" style={{ accentColor: VAULT_BRASS_DEEP }} />
          <div className="flex flex-wrap gap-3">
            {([
              ["upper", "A-Z"], ["digits", "0-9"], ["symbols", "!@#"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={options[key]} style={{ accentColor: VAULT_BRASS_DEEP }}
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
            className="w-full" style={{ accentColor: VAULT_BRASS_DEEP }} />
        </div>
      )}

      <div className="pt-2 border-t border-dashed border-border space-y-2.5">
        <p data-testid="vault-generator-preview"
          className="font-mono text-[13px] font-semibold tracking-wide text-foreground break-all">
          {preview}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => regenerate()}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-bold border border-border bg-card text-foreground hover:bg-muted transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
          <button type="button" onClick={() => onUse(preview)} data-testid="vault-generator-use"
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-bold transition-colors"
            style={{ background: `linear-gradient(135deg, ${VAULT_BRASS_LIGHT}, ${VAULT_BRASS_DEEP})`, color: VAULT_BRASS_TEXT }}>
            <Check className="w-3.5 h-3.5" /> Use this
          </button>
        </div>
      </div>
    </div>
  );
}
