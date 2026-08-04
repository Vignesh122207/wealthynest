"use client";

import {useEffect, useLayoutEffect, useRef, useState} from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {lighten} from "@/components/icons/PremiumIcon";

export interface TabBarItem<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
  /** Category color as a hex string — a neutral slate for "All"/"Overview"-style items, the
   * item's own brand color otherwise. Drives the icon's color at rest, the sliding indicator's
   * gradient once selected, and the hover tint. */
  color: string;
  /** Omit for items that never show a count (e.g. "All"). 0 also renders no badge. */
  count?: number;
}

interface TabBarProps<T extends string> {
  items: TabBarItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Prefix for each button's data-testid, e.g. "budget-list-tab" → "budget-list-tab-monthly". */
  testIdPrefix?: string;
  className?: string;
}

// Shared filter-tab rail — segmented chip track with a sliding gradient indicator. Replaces the
// flat solid-fill pill pattern that used to be hand-duplicated (its own local TAB_ACTIVE_BG map
// and near-identical JSX) across every section of the app: Accounts, Investments, Transactions,
// Debts, Budgets, Categories, Recurring Rules, Vault, Admin, Reports, and Notifications.
export function TabBar<T extends string>({ items, value, onChange, testIdPrefix, className }: TabBarProps<T>) {
  const railRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number; color: string } | null>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  const activeItem = items.find((i) => i.key === value);

  useLayoutEffect(() => {
    const btn = btnRefs.current[value];
    if (!btn || !activeItem) return;

    function measure() {
      if (!btn || !activeItem) return;
      setIndicator({ left: btn.offsetLeft, top: btn.offsetTop, width: btn.offsetWidth, height: btn.offsetHeight, color: activeItem.color });
    }
    measure();
    btn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });

    // Re-measure if ANY tab's box changes size after this — not just the active one. The
    // original webfont-swap case (next/font's font-display: swap reflowing the active label
    // slightly after this first synchronous measurement) only needed the active button watched,
    // but a count badge (e.g. Expenses/Income) populating a moment later — once that tab's own
    // query resolves, independently of the active tab's — shifts every later sibling's
    // offsetLeft, including the active tab's, even though the active tab's own box never
    // changed. Watching only the active button misses that shift entirely and leaves the
    // indicator stuck at its old position/size — visibly misaligned from the button underneath,
    // most noticeable right after a refresh when every tab's count is still arriving.
    const observer = new ResizeObserver(measure);
    (Object.values(btnRefs.current) as (HTMLButtonElement | null | undefined)[]).forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items.length]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    function updateFade() {
      if (!rail) return;
      setFade({
        left: rail.scrollLeft > 4,
        right: rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 4,
      });
    }
    updateFade();
    rail.addEventListener("scroll", updateFade);
    window.addEventListener("resize", updateFade);
    return () => {
      rail.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, [items.length]);

  // Scroll-fade uses a content mask (fades the chips themselves to transparent), not a
  // background-color overlay — with no enclosing tray behind them, there's no longer a single
  // "fade toward this color" to fade into, and a mask fades correctly against whatever the page
  // actually puts behind the rail (a card, the bare page background, either theme).
  const maskImage = `linear-gradient(to right, ${fade.left ? "transparent" : "black"} 0, black 24px, black calc(100% - 24px), ${fade.right ? "transparent" : "black"} 100%)`;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={railRef}
        role="tablist"
        className="relative flex gap-1.5 overflow-x-auto snap-x snap-proximity no-scrollbar"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        {indicator && (
          <div
            aria-hidden
            // top-0 left-0 anchors the transform's origin at (0,0) — without an explicit
            // top/left, an absolutely-positioned element falls back to its "static position" as
            // the base the translate() is added on top of, which is inconsistent and was making
            // the indicator land offset (too low, effectively taller) from the actual button.
            className="absolute top-0 left-0 rounded-xl transition-[transform,width,height,background,box-shadow] duration-300 ease-out"
            style={{
              transform: `translate(${indicator.left}px, ${indicator.top}px)`,
              width: indicator.width,
              height: indicator.height,
              background: `linear-gradient(135deg, ${lighten(indicator.color, 0.35)}, ${indicator.color})`,
              boxShadow: `0 6px 14px -4px ${indicator.color}99, inset 0 1px 0 rgba(255,255,255,.25)`,
            }}
          />
        )}
        {items.map((item) => {
          const active = item.key === value;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              ref={(el) => { btnRefs.current[item.key] = el; }}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={testIdPrefix ? `${testIdPrefix}-${item.key}` : undefined}
              onClick={() => onChange(item.key)}
              style={{
                "--hover-tint": `color-mix(in srgb, ${item.color} 18%, hsl(var(--card)))`,
                "--hover-border": `color-mix(in srgb, ${item.color} 45%, hsl(var(--border)))`,
              } as React.CSSProperties}
              className={cn(
                "relative z-[1] flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors duration-150 delay-150 shrink-0 snap-start",
                active
                  ? "text-white border border-transparent"
                  : "text-muted-foreground bg-card border border-border hover:bg-[var(--hover-tint)] hover:border-[var(--hover-border)]"
              )}
            >
              {/* Icon/label/badge color must NOT track the indicator's 300ms slide 1:1 — that
                  was tried and made things worse: at e.g. t=40ms the color is only ~13% blended,
                  so a long jump across a wide rail (5-6 tabs, Accounts/Investments) reads as
                  washed-out grey text smeared across a partially-arrived colored pill for most of
                  the animation. delay-150 duration-150 instead holds the ORIGINAL, fully legible
                  color (grey-on-card, or white-on-pill for the outgoing tab) for the first half of
                  the indicator's travel — while it's still visibly in transit and not yet under
                  this button — then snaps to the target color over a quick 150ms in the second
                  half, landing close to when the indicator itself arrives. Never fully synced
                  (that needs a bigger redesign — see the indicator's own effect for why), but no
                  window of low-contrast or invisible text either. */}
              <Icon className="w-3.5 h-3.5 shrink-0 transition-colors duration-150 delay-150" style={{ color: active ? "#fff" : item.color }} />
              {item.label}
              {!!item.count && (
                <span className={cn(
                  "text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-colors duration-150 delay-150",
                  active ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
