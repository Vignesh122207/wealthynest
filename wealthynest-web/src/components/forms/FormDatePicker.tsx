"use client";

import {useCallback, useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {CalendarDays, ChevronLeft, ChevronRight, X} from "lucide-react";
import {cn} from "@/lib/utils";

type View = "day" | "month" | "year";

interface FormDatePickerProps {
  label?:       string;
  error?:       string;
  hint?:        string;
  value?:       string;
  onChange?:    (v: string) => void;
  onBlur?:      () => void;
  placeholder?: string;
  disabled?:    boolean;
  name?:        string;
  id?:          string;
  testId?:      string;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS  = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = parse(v, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : null;
}

export function FormDatePicker({
  label, error, hint, value, onChange, onBlur,
  placeholder = "Select date", disabled, name, id, testId,
}: FormDatePickerProps) {
  const [open, setOpen]       = useState(false);
  const [view, setView]       = useState<View>("day");
  const [cursor, setCursor]   = useState<Date>(() => parseDate(value) ?? new Date());
  const [dropPos, setDropPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const inputRef   = useRef<HTMLDivElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const inputId    = id ?? generatedId;
  const popupId    = `${inputId}-calendar`;

  // Keyboard day navigation (arrow keys / Home / End) — a roving-tabindex cell, kept in sync
  // with `cursor` so crossing a month boundary flips the visible grid instead of getting stuck.
  const [focusedDate, setFocusedDate] = useState<Date>(() => parseDate(value) ?? new Date());
  const dayButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!open || view !== "day") return;
    dayButtonRefs.current.get(format(focusedDate, "yyyy-MM-dd"))?.focus();
  }, [focusedDate, cursor, open, view]);

  const handleDayKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, day: Date) => {
    let next: Date;
    switch (e.key) {
      case "ArrowRight": next = addDays(day, 1); break;
      case "ArrowLeft":  next = addDays(day, -1); break;
      case "ArrowDown":  next = addDays(day, 7); break;
      case "ArrowUp":    next = addDays(day, -7); break;
      case "Home":       next = startOfWeek(day, { weekStartsOn: 1 }); break;
      case "End":        next = endOfWeek(day, { weekStartsOn: 1 }); break;
      default: return;
    }
    e.preventDefault();
    setFocusedDate(next);
    if (!isSameMonth(next, cursor)) setCursor(next);
  };

  useEffect(() => {
    const d = parseDate(value);
    if (d) setCursor(d);
  }, [value]);

  // Viewport-relative (position: fixed) and flips upward when there isn't room
  // below — same approach as DropdownPanel. Previously this always opened
  // below using document-relative coordinates with no boundary check, so a
  // date field sitting low in a tall modal (e.g. Goals' Target Date) rendered
  // the calendar partly below the visible viewport.
  const recalcPos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const estimatedHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - 264 - 8);
    setDropPos({
      top:    openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width: rect.width,
    });
  }, []);

  const openCalendar = () => {
    if (disabled) return;
    recalcPos();
    setOpen(v => !v);
    setView("day");
    setFocusedDate(parseDate(value) ?? cursor);
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => recalcPos();
    const onResize = () => recalcPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, recalcPos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!inputRef.current?.contains(target) && !dropRef.current?.contains(target)) {
        setOpen(false);
        onBlur?.();
      }
    };
    // Escape closes from anywhere in the popup — needed in addition to the trigger input's own
    // handler because opening moves focus onto a day cell inside the portal, not the input.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      onBlur?.();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onBlur]);

  const selectedDate = parseDate(value);
  const displayValue = selectedDate ? format(selectedDate, "dd MMM yyyy") : "";

  const selectDay = (d: Date) => {
    onChange?.(format(d, "yyyy-MM-dd"));
    setOpen(false); setView("day"); onBlur?.();
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(""); onBlur?.();
  };

  // ─── Day view ────────────────────────────────────────────────────────────
  const renderDays = () => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd   = endOfWeek(endOfMonth(cursor),     { weekStartsOn: 1 });
    const days      = eachDayOfInterval({ start: gridStart, end: gridEnd });

    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setCursor(subMonths(cursor, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" data-testid="calendar-month-year-header" onClick={() => setView("month")}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-muted">
            {format(cursor, "MMMM yyyy")}
          </button>
          <button type="button" onClick={() => setCursor(addMonths(cursor, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map(day => {
            const sel      = selectedDate && isSameDay(day, selectedDate);
            const today    = isSameDay(day, new Date());
            const inMonth  = isSameMonth(day, cursor);
            const dayKey   = format(day, "yyyy-MM-dd");
            const isFocusable = isSameDay(day, focusedDate);
            return (
              <button key={dayKey} type="button" data-testid={`calendar-day-${dayKey}`} onClick={() => selectDay(day)}
                ref={el => { if (el) dayButtonRefs.current.set(dayKey, el); else dayButtonRefs.current.delete(dayKey); }}
                tabIndex={isFocusable ? 0 : -1}
                onKeyDown={e => handleDayKeyDown(e, day)}
                onFocus={() => setFocusedDate(day)}
                className={cn(
                  "w-7 h-7 mx-auto flex items-center justify-center rounded-lg text-xs transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  sel     && "bg-primary text-primary-foreground font-bold",
                  !sel && today   && "ring-1 ring-primary text-primary font-semibold",
                  !sel && !today  && inMonth  && "text-foreground hover:bg-muted",
                  !sel && !today  && !inMonth && "text-muted-foreground/40 hover:bg-muted",
                )}>
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  // ─── Month view ───────────────────────────────────────────────────────────
  const renderMonths = () => {
    const yr = cursor.getFullYear();
    const curMon = cursor.getMonth();
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <button type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear() - 1, cursor.getMonth(), 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" data-testid="calendar-year-header" onClick={() => setView("year")}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-muted">
            {yr}
          </button>
          <button type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear() + 1, cursor.getMonth(), 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_NAMES.map((m, i) => (
            <button key={m} type="button" data-testid={`calendar-month-${yr}-${String(i + 1).padStart(2, "0")}`}
              onClick={() => { setCursor(new Date(yr, i, 1)); setView("day"); }}
              className={cn(
                "h-9 rounded-xl text-xs font-medium transition-all",
                i === curMon ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
              )}>
              {m}
            </button>
          ))}
        </div>
      </>
    );
  };

  // ─── Year view ────────────────────────────────────────────────────────────
  const renderYears = () => {
    const curYear = cursor.getFullYear();
    const base    = Math.floor(curYear / 12) * 12;
    const years   = Array.from({ length: 12 }, (_, i) => base + i);
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <button type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear() - 12, cursor.getMonth(), 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">{base} – {base + 11}</span>
          <button type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear() + 12, cursor.getMonth(), 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {years.map(yr => (
            <button key={yr} type="button" data-testid={`calendar-year-${yr}`}
              onClick={() => { setCursor(new Date(yr, cursor.getMonth(), 1)); setView("month"); }}
              className={cn(
                "h-9 rounded-xl text-xs font-medium transition-all",
                yr === curYear ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
              )}>
              {yr}
            </button>
          ))}
        </div>
      </>
    );
  };

  const dropdown = open && dropPos ? createPortal(
    <div
      ref={dropRef}
      id={popupId}
      role="dialog"
      aria-modal="true"
      aria-label="Choose date"
      style={{ position: "fixed", top: dropPos.top, bottom: dropPos.bottom, left: dropPos.left, minWidth: dropPos.width, zIndex: 9999 }}
      className="w-64 max-h-[min(320px,calc(100vh-24px))] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl p-3"
    >
      {view === "day"   && renderDays()}
      {view === "month" && renderMonths()}
      {view === "year"  && renderYears()}
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-muted-foreground">{label}</label>}
      <div className="relative" ref={inputRef}>
        <input id={inputId} ref={triggerRef} data-testid={testId} type="text" name={name} value={displayValue} readOnly placeholder={placeholder}
          disabled={disabled}
          onClick={openCalendar}
          onKeyDown={(e) => {
            if (disabled || open) return;
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              openCalendar();
            }
          }}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          aria-invalid={!!error || undefined}
          className={cn(
            "w-full h-10 pl-3 pr-9 rounded-xl text-sm transition-all outline-none cursor-pointer select-none",
            "bg-background border border-border text-foreground placeholder:text-muted-foreground",
            "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
            error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
            disabled && "opacity-50 cursor-not-allowed",
          )} />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button type="button" onClick={clear}
              className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-muted-foreground transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
          <CalendarDays className="w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {dropdown}
    </div>
  );
}
