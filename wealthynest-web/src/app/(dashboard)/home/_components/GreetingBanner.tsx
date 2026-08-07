"use client";

import {Calendar, CalendarRange, ChevronLeft, ChevronRight} from "lucide-react";
import {cn, getGreeting, monthLabel} from "@/lib/utils";

export type HomeViewMode = "month" | "year";

interface GreetingBannerProps {
  firstName:        string;
  year:             number;
  month:            number;
  isCurrentMonth:   boolean;
  isCurrentYear:    boolean;
  onNavigate:       (dir: -1 | 1) => void;
  onNavigateYear:   (dir: -1 | 1) => void;
  viewMode:         HomeViewMode;
  onViewModeChange: (mode: HomeViewMode) => void;
}

export function GreetingBanner({
  firstName, year, month, isCurrentMonth, isCurrentYear, onNavigate, onNavigateYear,
  viewMode, onViewModeChange,
}: GreetingBannerProps) {
  const isYear = viewMode === "year";
  const label  = isYear ? String(year) : monthLabel(year, month);

  return (
    // Always a single row, even on mobile (previously flex-col below sm, which pushed the
    // period controls onto their own line) — the greeting gets flex-1/min-w-0 so it's first in
    // line for the row's space and only truncates as a last resort; the controls on the right
    // are shrink-0 and, below sm, collapse into one compact icon-driven pill (see the mobile-only
    // block further down) specifically so they never need to squeeze the greeting to fit.
    //
    // No inline "insight" chip here anymore — this row's only job is orientation (who/when), not
    // a second "financial coach" one-liner competing with SmartAlertsRow's own pace-forecast card
    // a section below. One coach voice on the page, not two saying different things about the
    // same month.
    //
    // Text sizes below only step up from sm: onward, not at the base (mobile) tier — the chip that
    // used to sit here was already `hidden md:inline-flex`, so it never occupied mobile space in
    // the first place, meaning there's no room actually freed up below the md breakpoint to spend
    // on bigger type. Below sm specifically, this row keeps its original sizes on purpose: that's
    // the one tier the mobile-pill comment further down says was measured against real devices to
    // keep "Good morning, {name}" from ever truncating on a mainstream phone width.
    <div data-testid="greeting-banner" className="animate-fade-in-up flex flex-row items-center justify-between gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl shrink-0" aria-hidden>
            {{ morning: "🌤️", afternoon: "☀️", evening: "🌙" }[getGreeting()] ?? "👋"}
          </span>
          <p className="text-base sm:text-xl lg:text-2xl font-bold text-foreground tracking-tight truncate">
            Good {getGreeting()}, {firstName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Month/Year switch — sm and up only; mobile gets the single combined pill below */}
        <div className="hidden sm:flex items-center gap-0.5 bg-card border border-border/50 rounded-xl p-1 shrink-0">
          {(["month", "year"] as const).map((mode) => (
            <button
              key={mode}
              data-testid={`period-toggle-${mode}`}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors",
                viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Month/Year navigator — sm and up only; mobile gets the single combined pill below */}
        <div className="hidden sm:flex items-center gap-1 bg-card border border-border/50 rounded-xl p-1 shrink-0">
          <button
            onClick={() => (isYear ? onNavigateYear(-1) : onNavigate(-1))}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/60 flex items-center justify-center transition-colors"
            aria-label={isYear ? "Previous year" : "Previous month"}
          >
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span data-testid="period-nav-label" className="text-xs font-semibold text-foreground min-w-[4.5rem] text-center tabular-nums">
            {label}
          </span>
          <button
            onClick={() => (isYear ? onNavigateYear(1) : onNavigate(1))}
            disabled={isYear ? isCurrentYear : isCurrentMonth}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/60 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={isYear ? "Next year" : "Next month"}
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Mobile-only: the two pills above collapse into one lean pill — the Month/Year
            segmented control (two text buttons) and its icon merge into a single tap-to-cycle
            "icon + label" button (no separate button chrome for the icon, no fixed-width label
            reservation), and prev/next shrink to 20px. Every px here is deliberately fought for:
            this is what keeps "Good morning, {name}" from ever needing to truncate on a mainstream
            phone width (measured against real devices, not just guessed) while still sharing the
            row with full period navigation instead of wrapping to a second line. */}
        <div className="flex sm:hidden items-center gap-1 bg-card border border-border/50 rounded-xl pl-1.5 pr-1 py-1 shrink-0">
          <button
            data-testid="period-toggle-mobile"
            onClick={() => onViewModeChange(isYear ? "month" : "year")}
            aria-label={`${isYear ? "Switch to month view" : "Switch to year view"} — currently showing ${label}`}
            className="flex items-center gap-1 text-primary"
          >
            {isYear ? <CalendarRange className="w-3.5 h-3.5 shrink-0" /> : <Calendar className="w-3.5 h-3.5 shrink-0" />}
            {/* Deliberately kept at 11px rather than the rest of the app's 12px caption floor —
                this is the one label inside the row whose real-device-measured no-truncate budget
                the top-of-file comment is about; every other caption on Home has room to spare. */}
            <span data-testid="period-nav-label-mobile" className="text-[11px] font-semibold text-foreground tabular-nums whitespace-nowrap">
              {label}
            </span>
          </button>
          <button
            onClick={() => (isYear ? onNavigateYear(-1) : onNavigate(-1))}
            className="w-5 h-5 rounded-md hover:bg-muted/60 flex items-center justify-center transition-colors"
            aria-label={isYear ? "Previous year" : "Previous month"}
          >
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => (isYear ? onNavigateYear(1) : onNavigate(1))}
            disabled={isYear ? isCurrentYear : isCurrentMonth}
            className="w-5 h-5 rounded-md hover:bg-muted/60 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={isYear ? "Next year" : "Next month"}
          >
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
