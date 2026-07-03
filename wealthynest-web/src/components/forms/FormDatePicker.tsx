"use client";

import { useEffect, useRef, useState } from "react";
import {
  format, parse, isValid, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  placeholder = "Select date", disabled, name,
}: FormDatePickerProps) {
  const [open, setOpen]     = useState(false);
  const [view, setView]     = useState<View>("day");
  const [cursor, setCursor] = useState<Date>(() => parseDate(value) ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = parseDate(value);
    if (d) setCursor(d);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false); onBlur?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setView("month")}
            className="text-sm font-semibold text-slate-100 hover:text-indigo-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800">
            {format(cursor, "MMMM yyyy")}
          </button>
          <button type="button" onClick={() => setCursor(addMonths(cursor, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map(day => {
            const sel      = selectedDate && isSameDay(day, selectedDate);
            const today    = isSameDay(day, new Date());
            const inMonth  = isSameMonth(day, cursor);
            return (
              <button key={day.toISOString()} type="button" onClick={() => selectDay(day)}
                className={cn(
                  "w-7 h-7 mx-auto flex items-center justify-center rounded-lg text-xs transition-all",
                  sel      && "bg-indigo-600 text-white font-bold",
                  !sel && today   && "ring-1 ring-indigo-500 text-indigo-400 font-semibold",
                  !sel && !today  && inMonth  && "text-slate-300 hover:bg-slate-700",
                  !sel && !today  && !inMonth && "text-slate-700 hover:bg-slate-800",
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
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setView("year")}
            className="text-sm font-semibold text-slate-100 hover:text-indigo-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800">
            {yr}
          </button>
          <button type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear() + 1, cursor.getMonth(), 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_NAMES.map((m, i) => (
            <button key={m} type="button"
              onClick={() => { setCursor(new Date(yr, i, 1)); setView("day"); }}
              className={cn(
                "h-9 rounded-xl text-xs font-medium transition-all",
                i === curMon ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700",
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
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-100">{base} – {base + 11}</span>
          <button type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear() + 12, cursor.getMonth(), 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {years.map(yr => (
            <button key={yr} type="button"
              onClick={() => { setCursor(new Date(yr, cursor.getMonth(), 1)); setView("month"); }}
              className={cn(
                "h-9 rounded-xl text-xs font-medium transition-all",
                yr === curYear ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700",
              )}>
              {yr}
            </button>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <div className="relative">
        <input type="text" name={name} value={displayValue} readOnly placeholder={placeholder}
          disabled={disabled}
          onClick={() => { if (!disabled) { setOpen(v => !v); setView("day"); } }}
          className={cn(
            "w-full h-10 pl-3 pr-9 rounded-xl text-sm transition-all outline-none cursor-pointer select-none",
            "bg-slate-800/60 border border-slate-700/60 text-slate-100 placeholder-slate-500",
            "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
            error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
            disabled && "opacity-50 cursor-not-allowed",
          )} />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button type="button" onClick={clear}
              className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
          <CalendarDays className="w-4 h-4 text-slate-500 pointer-events-none" />
        </div>

        {open && (
          <div className="absolute top-full left-0 z-[100] mt-1.5 w-64 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3 shadow-black/50">
            {view === "day"   && renderDays()}
            {view === "month" && renderMonths()}
            {view === "year"  && renderYears()}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
