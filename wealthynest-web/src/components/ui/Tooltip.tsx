"use client";

import {type ReactNode, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Info} from "lucide-react";
import {cn} from "@/lib/utils";

// Generic hover/focus tooltip for wrapping an arbitrary trigger element (e.g. an icon-only
// button) — unlike InfoTooltip below, it has no built-in affordance icon of its own.
// A short show-delay avoids flashing a tooltip on quick mouse-throughs (e.g. sweeping down a
// collapsed sidebar); hiding and keyboard focus stay instant.
//
// Rendered through a portal into document.body with `position: fixed`, measured from the
// trigger's own bounding rect — a plain `absolute` child would get clipped by the sidebar nav's
// `overflow-y-auto` list (setting overflow-y to anything but visible forces the browser to
// compute overflow-x as auto too, per the CSS overflow spec, silently turning that list into a
// horizontal-clip container). Also dismisses on click, since a Next.js <Link> keeps focus after
// a client-side navigation — without this, selecting a collapsed item left its tooltip stuck
// open on the newly-active icon until the mouse moved away.
export function Tooltip({ content, children, side = "top", className }: {
  content: ReactNode; children: ReactNode; side?: "top" | "right"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const showTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (showTimeout.current) clearTimeout(showTimeout.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(
      side === "right"
        ? { top: rect.top + rect.height / 2, left: rect.right + 8 }
        : { top: rect.top - 8, left: rect.left + rect.width / 2 }
    );
    setOpen(true);
  }
  function scheduleShow() {
    showTimeout.current = setTimeout(show, 300);
  }
  function hide() {
    if (showTimeout.current) clearTimeout(showTimeout.current);
    setOpen(false);
  }

  return (
    <span
      ref={triggerRef}
      className={className ?? "inline-flex"}
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      {open && position && typeof document !== "undefined" && createPortal(
        <span
          role="tooltip"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            transform: side === "right" ? "translateY(-50%)" : "translate(-50%, -100%)",
          }}
          className="z-50 whitespace-nowrap rounded-lg bg-foreground text-background text-xs font-medium px-2.5 py-1.5 shadow-xl pointer-events-none"
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
}

// A small info-icon trigger that reveals a tip on hover/focus/tap — for supplementary
// guidance (e.g. password rules) that shouldn't cost permanent layout space next to a field.
export function InfoTooltip({ content, className }: { content: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="More info"
        className="text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 bottom-full right-0 mb-2 w-56 rounded-xl bg-foreground text-background text-xs leading-relaxed px-3 py-2.5 shadow-xl"
        >
          {content}
        </span>
      )}
    </span>
  );
}
