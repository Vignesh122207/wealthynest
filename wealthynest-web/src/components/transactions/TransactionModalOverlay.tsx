"use client";

import { useRef } from "react";
import { useDialogA11y } from "@/hooks/useDialogA11y";

// ─── Shared full-screen overlay used by every add/edit transaction modal ──────

export function TransactionModalOverlay({ onDismiss, children, maxWidth = "max-w-lg" }: {
  onDismiss: () => void;
  children:  React.ReactNode;
  /** Most forms fit max-w-lg; a denser multi-field form (e.g. Investments' add/edit, which
   * covers Stock/MF/Gold/FD/Bond fields at once) can pass a wider Tailwind max-w-* class. */
  maxWidth?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y(containerRef, onDismiss);

  return (
    // lg:left-60 (not inset-0 alone): the desktop Sidebar is a sticky w-60 column left of
    // this fixed layer, not an overlay above it — centering on the full viewport put every
    // modal visibly left of the actual content area's center once the sidebar appears at lg:.
    <div className="fixed inset-0 lg:left-60 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onDismiss}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto outline-none`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
