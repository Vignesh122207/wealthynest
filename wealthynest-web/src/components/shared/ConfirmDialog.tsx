"use client";

import {useEffect, useId, useRef, useState} from "react";
import {AlertTriangle, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {useDialogA11y} from "@/hooks/useDialogA11y";
import {useSidebarOffsetClass} from "@/hooks/useSidebarOffsetClass";

interface ConfirmDialogProps {
  open:          boolean;
  title:         string;
  description:   React.ReactNode;
  confirmLabel?: string;
  cancelLabel?:  string;
  danger?:       boolean;
  /** For a caller that waits for its own mutation's onSuccess before closing (rather than closing
   * optimistically on click) — pass the mutation's real `isPending` here so the confirm button's
   * spinner tracks actual request state and self-recovers if the request fails. Most callers close
   * immediately on click and don't need this; omitting it keeps the previous self-managed behavior. */
  loading?:      boolean;
  /** For a flow whose blast radius goes beyond "undo this one row" (removes other people, locks
   * the user out) — requires the exact text to be typed before Confirm enables, on top of the
   * usual click. Omitted by default; most confirmations don't need this extra friction. */
  typeToConfirm?: string;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = false, loading, typeToConfirm, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState("");
  useEffect(() => { if (open) setTypedValue(""); }, [open]);
  const typeToConfirmBlocked = !!typeToConfirm && typedValue !== typeToConfirm;
  // Guards every caller against double-click/double-tap firing onConfirm twice —
  // some callers close the dialog asynchronously, so closing-on-confirm alone isn't reliable.
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (open) setSubmitting(false); }, [open]);
  const isExternallyManaged = loading !== undefined;
  const isBusy = isExternallyManaged ? loading : submitting;

  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId  = useId();
  const typeInputId = useId();
  // Escape/backdrop/X all route through this so a confirm already in flight can't be
  // cancelled out from under it — same guard handleConfirm already applies to double-clicks.
  const handleCancel = () => { if (!isBusy) onCancel(); };
  useDialogA11y(containerRef, handleCancel);
  const sidebarOffset = useSidebarOffsetClass();

  if (!open) return null;

  const handleConfirm = () => {
    if (isBusy || typeToConfirmBlocked) return;
    if (!isExternallyManaged) setSubmitting(true);
    onConfirm();
  };

  return (
    // sidebarOffset (not inset-0 alone): centering on the full viewport puts this left of the
    // actual content area's center once the desktop Sidebar (a sticky column) appears at lg:.
    <div data-testid="modal-overlay-backdrop" className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", sidebarOffset)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancel} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl outline-none"
      >
        <button onClick={handleCancel} className="absolute top-4 right-4 text-muted-foreground/60 hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", danger ? "bg-red-500/10" : "bg-amber-500/10")}>
          <AlertTriangle className={cn("w-5 h-5", danger ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
        </div>
        <h3 id={titleId} className="font-semibold text-foreground mb-2">{title}</h3>
        <p id={descId} className="text-sm text-muted-foreground mb-5">{description}</p>
        {typeToConfirm && (
          <div className="mb-5">
            <label htmlFor={typeInputId} className="block text-xs font-medium text-muted-foreground mb-1.5">
              Type <span className="font-semibold text-foreground">{typeToConfirm}</span> to confirm
            </label>
            <input
              id={typeInputId}
              autoFocus
              autoComplete="off"
              value={typedValue}
              onChange={e => setTypedValue(e.target.value)}
              disabled={isBusy}
              className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/25 transition-all disabled:opacity-50"
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button data-testid="confirm-dialog-cancel" variant="secondary" className="flex-1 h-10" onClick={handleCancel} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button data-testid="confirm-dialog-confirm" variant={danger ? "danger" : "primary"} className="flex-1 h-10" onClick={handleConfirm} loading={isBusy} disabled={typeToConfirmBlocked}>
            {isBusy ? "…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
