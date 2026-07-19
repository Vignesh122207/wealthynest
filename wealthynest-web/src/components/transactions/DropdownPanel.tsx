"use client";

import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";

// ─── Dropdown Panel — portals to <body> so it's never clipped by a scrolling
// modal, and always fits on screen no matter where its trigger sits ─────────

export function DropdownPanel({ anchorRef, open, onClose, children }: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  const [rect, setRect] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !anchorRef.current) { setRect(null); return; }
    const anchor = anchorRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - anchor.bottom - 12;
    const spaceAbove = anchor.top - 12;
    const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(320, Math.max(160, openUpward ? spaceAbove : spaceBelow));
    // Anchor by the edge touching the trigger and let the panel's real (content-driven) height
    // do the rest — pinning both edges (e.g. a "top" computed from the maxHeight cap) leaves a
    // gap above the trigger whenever the list is shorter than maxHeight, since the panel then
    // renders shorter than assumed and floats away from the button instead of hugging it.
    setRect(openUpward
      ? { bottom: window.innerHeight - anchor.top + 6, left: anchor.left, width: anchor.width, maxHeight }
      : { top: anchor.bottom + 6, left: anchor.left, width: anchor.width, maxHeight });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    // Capture-phase "scroll" fires for scrolls anywhere in the tree, including inside the
    // panel's own scrollable list — ignore those so scrolling the list doesn't self-close it.
    const handleScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open, onClose]);

  // Document-level "mousedown" (not an invisible click-catcher div) — every modal wrapper in
  // this app (TransactionModalOverlay, the Account create/edit modal) calls `e.stopPropagation()`
  // on its content's `click` to guard its own backdrop-dismiss. That stop only touches `click`,
  // and a listener bound straight to `document` doesn't depend on bubbling through any particular
  // ancestor anyway — so this closes reliably even when the panel is opened from inside a modal,
  // instead of requiring a re-click on the trigger. Matches FormDatePicker's own approach.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, onClose, anchorRef]);

  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <div ref={panelRef} className="fixed bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden"
      style={{ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width, maxHeight: rect.maxHeight, zIndex: 9999 }}>
      {children}
    </div>,
    document.body
  );
}
