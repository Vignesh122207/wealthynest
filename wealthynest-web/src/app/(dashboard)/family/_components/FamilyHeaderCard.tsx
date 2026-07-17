"use client";

import { Crown, Loader2, Pencil, X } from "lucide-react";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Family } from "@/features/family/types/family.types";

type Mode =
  | "idle" | "create" | "join" | "rename"
  | "makeAdmin" | "revokeAdmin" | "confirmRemove"
  | "confirmLeave" | "adminLeave" | "confirmDelete";

// ── Family header card — name display + inline rename ────────────────────────

export function FamilyHeaderCard({
  family, mode, isAdmin, renameName, setRenameName, handleRename, renaming, onEnterRename, onReset,
}: {
  family: Family;
  mode: Mode;
  isAdmin: boolean;
  renameName: string;
  setRenameName: (v: string) => void;
  handleRename: () => void;
  renaming: boolean;
  onEnterRename: () => void;
  onReset: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <PremiumIcon icon={Users} tone="magenta" size="md" className="shrink-0" />
        <div className="flex-1 min-w-0">
          {mode === "rename" ? (
            <div className="flex items-center gap-2">
              <input value={renameName} onChange={e => setRenameName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") onReset(); }}
                className="h-8 px-2.5 rounded-xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 w-36"
                autoFocus />
              <button onClick={handleRename} disabled={!renameName.trim() || renaming}
                className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-60 transition-all flex items-center gap-1.5">
                {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </button>
              <button onClick={onReset} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground truncate">{family.name}</h2>
              {isAdmin && (
                <button onClick={onEnterRename}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          <div className={cn("flex items-center gap-1.5 mt-0.5 text-xs font-semibold", isAdmin ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400")}>
            {isAdmin && <Crown className="w-3 h-3" />}
            {isAdmin ? "You are the admin" : "Member"}
          </div>
        </div>
      </div>
    </div>
  );
}
