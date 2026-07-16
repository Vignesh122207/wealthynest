"use client";

// ─── Shared full-screen overlay used by every add/edit transaction modal ──────

export function TransactionModalOverlay({ onDismiss, children, maxWidth = "max-w-lg" }: {
  onDismiss: () => void;
  children:  React.ReactNode;
  /** Most forms fit max-w-lg; a denser multi-field form (e.g. Investments' add/edit, which
   * covers Stock/MF/Gold/FD/Bond fields at once) can pass a wider Tailwind max-w-* class. */
  maxWidth?: string;
}) {
  return (
    // lg:left-60 (not inset-0 alone): the desktop Sidebar is a sticky w-60 column left of
    // this fixed layer, not an overlay above it — centering on the full viewport put every
    // modal visibly left of the actual content area's center once the sidebar appears at lg:.
    <div className="fixed inset-0 lg:left-60 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onDismiss}>
      <div className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
