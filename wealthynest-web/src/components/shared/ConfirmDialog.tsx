"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  open:          boolean;
  title:         string;
  description:   string;
  confirmLabel?: string;
  cancelLabel?:  string;
  danger?:       boolean;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  // Guards every caller against double-click/double-tap firing onConfirm twice —
  // some callers close the dialog asynchronously, so closing-on-confirm alone isn't reliable.
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (open) setSubmitting(false); }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  };

  return (
    // lg:left-60 (not inset-0 alone): centering on the full viewport puts this left of the
    // actual content area's center once the desktop Sidebar (sticky w-60 column) appears at lg:.
    <div className="fixed inset-0 lg:left-60 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button onClick={onCancel} className="absolute top-4 right-4 text-muted-foreground/60 hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", danger ? "bg-red-500/10" : "bg-amber-500/10")}>
          <AlertTriangle className={cn("w-5 h-5", danger ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
        </div>
        <h3 className="font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{description}</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 h-10" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} className="flex-1 h-10" onClick={handleConfirm} loading={submitting}>
            {submitting ? "…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
