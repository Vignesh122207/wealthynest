"use client";

import {Loader2, LogOut, Trash2} from "lucide-react";

// ── Danger-zone section (always rendered at the very bottom) ─────────────────

type Mode =
  | "idle" | "create" | "join" | "rename"
  | "makeAdmin" | "revokeAdmin" | "confirmRemove"
  | "confirmLeave" | "adminLeave" | "confirmDelete";

export function DangerZone({
  mode, familyName, membersCount, isAdmin, leaving, deleting,
  deleteConfirmText, setDeleteConfirmText,
  onLeave, onDelete, onEnterConfirmLeave, onEnterAdminLeave, onEnterConfirmDelete, onReset,
}: {
  mode: Mode;
  familyName?: string;
  membersCount: number;
  isAdmin: boolean;
  leaving: boolean;
  deleting: boolean;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  onLeave: () => void;
  onDelete: () => void;
  onEnterConfirmLeave: () => void;
  onEnterAdminLeave: () => void;
  onEnterConfirmDelete: () => void;
  onReset: () => void;
}) {
  if (mode === "confirmLeave") {
    return (
      <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">
          Leave <span className="font-semibold">{familyName}</span>? Your personal data stays in your account.
        </p>
        <div className="flex gap-2">
          <button onClick={onLeave} disabled={leaving} data-testid="family-confirm-leave"
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5 text-white transition-all disabled:opacity-60 disabled:hover:translate-y-0">
            {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Yes, leave
          </button>
          <button onClick={onReset} className="h-9 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
        </div>
      </div>
    );
  }

  if (mode === "confirmDelete") {
    const deleteBlocked = deleteConfirmText !== familyName;
    return (
      <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">
          Delete <span className="font-semibold">{familyName}</span>? All {membersCount} members will be removed.
          Everyone&apos;s individual data stays in their own accounts.
        </p>
        <div>
          <label htmlFor="delete-family-confirm" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Type <span className="font-semibold text-foreground">{familyName}</span> to confirm
          </label>
          <input id="delete-family-confirm" autoFocus autoComplete="off"
            value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
            disabled={deleting}
            data-testid="family-delete-confirm-input"
            className="w-full h-9 px-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/25 transition-all disabled:opacity-50" />
        </div>
        <div className="flex gap-2">
          <button onClick={onDelete} disabled={deleting || deleteBlocked} data-testid="family-confirm-delete"
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5 text-white transition-all disabled:opacity-60 disabled:hover:translate-y-0">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Yes, delete group
          </button>
          <button onClick={onReset} className="h-9 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
        </div>
      </div>
    );
  }

  // idle — show buttons
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-widest px-0.5">Danger Zone</p>
      <div className="bg-card border border-red-500/20 rounded-2xl p-4 flex flex-wrap gap-2">
        {isAdmin ? (
          <>
            <button
              onClick={() => membersCount <= 1 ? onEnterConfirmLeave() : onEnterAdminLeave()}
              data-testid="family-leave-trigger"
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-red-600 dark:text-red-500 bg-red-500/8 border border-red-500/30 hover:bg-red-500/15 transition-all">
              <LogOut className="w-3.5 h-3.5" /> Leave Group
            </button>
            <button onClick={onEnterConfirmDelete} data-testid="family-delete-trigger"
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-red-600 dark:text-red-500 bg-red-500/8 border border-red-500/30 hover:bg-red-500/15 transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Delete Group
            </button>
          </>
        ) : (
          <button onClick={onEnterConfirmLeave} disabled={leaving} data-testid="family-leave-trigger"
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-red-600 dark:text-red-500 bg-red-500/8 border border-red-500/30 hover:bg-red-500/15 transition-all disabled:opacity-60">
            <LogOut className="w-3.5 h-3.5" /> Leave Group
          </button>
        )}
      </div>
    </div>
  );
}
