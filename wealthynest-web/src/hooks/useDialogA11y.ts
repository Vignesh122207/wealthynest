"use client";

import {type RefObject, useEffect} from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Shared keyboard/focus behavior for every full-screen dialog in the app (TransactionModalOverlay,
// ConfirmDialog): Escape closes it, Tab cycles without escaping to the page behind it, and the
// background stops scrolling while it's open. Doesn't steal focus from a field the dialog's own
// content already autoFocus'd — only moves focus onto the dialog itself if nothing inside it has
// focus yet.
export function useDialogA11y(containerRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!container.contains(document.activeElement)) container.focus();

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
        return;
      }
      if (e.key !== "Tab" || !container) return;
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDismiss]);
}
