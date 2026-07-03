"use client";

import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", danger ? "bg-red-500/10" : "bg-amber-500/10")}>
          <AlertTriangle className={cn("w-5 h-5", danger ? "text-red-400" : "text-amber-400")} />
        </div>
        <h3 className="font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-5">{description}</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 h-10 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={cn("flex-1 h-10 rounded-xl text-sm font-medium transition-all",
              danger ? "bg-red-600 hover:bg-red-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white")}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
