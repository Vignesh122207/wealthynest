import {useState} from "react";
import {addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isAfter, isBefore, isSameDay, isSameMonth, isValid, parse, startOfMonth, startOfWeek, subMonths} from "date-fns";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {cn} from "@/lib/utils";

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type View = "range" | "month" | "year";

function parseISO(v: string): Date | null {
  if (!v) return null;
  const d = parse(v, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : null;
}

// One linked pair of month grids, not two independently-navigable calendars — a single prev/next
// pair above both advances them together (left = cursor, right = cursor+1), matching how every
// other dual-calendar range picker (Airbnb, Linear's cycle picker) behaves. Leading/trailing days
// that spill into the adjacent month render as blank cells instead of that month's real numbers —
// showing them would mean the same calendar date is clickable in both panels at once (whichever
// panel currently has it as in-month vs. spillover), which is confusing and collides on this
// component's date-keyed data-testids.
function MiniMonth({ cursorDate, pendingStart, effectiveEnd, onDayClick, onDayHover }: {
  cursorDate: Date;
  pendingStart: Date | null;
  effectiveEnd: Date | null;
  onDayClick: (day: Date) => void;
  onDayHover: (day: Date) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(cursorDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursorDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="flex-1 min-w-0">
      <p className="text-center text-xs font-semibold text-foreground mb-2">{format(cursorDate, "MMMM yyyy")}</p>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground/70 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map(day => {
          if (!isSameMonth(day, cursorDate)) return <div key={day.toISOString()} />;
          const iso = format(day, "yyyy-MM-dd");
          const isStart = !!pendingStart && isSameDay(day, pendingStart);
          const isEnd = !!effectiveEnd && isSameDay(day, effectiveEnd);
          const inBetween = !!pendingStart && !!effectiveEnd && isAfter(day, pendingStart) && isBefore(day, effectiveEnd);
          const isToday = isSameDay(day, new Date());
          return (
            <button key={iso} type="button" data-testid={`range-day-${iso}`}
              onClick={() => onDayClick(day)} onMouseEnter={() => onDayHover(day)}
              className={cn("h-7 w-full mx-auto text-xs transition-colors",
                (isStart || isEnd) && "bg-primary text-primary-foreground font-bold rounded-full",
                inBetween && "bg-primary/12 text-foreground",
                !isStart && !isEnd && !inBetween && "text-foreground hover:bg-muted rounded-full",
                !isStart && !isEnd && !inBetween && isToday && "ring-1 ring-primary/60")}>
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DualCalendarRangePicker({ customStart, customEnd, onApply, onClear }: {
  customStart: string; customEnd: string;
  onApply: (start: string, end: string) => void;
  onClear: () => void;
}) {
  const initialStart = parseISO(customStart);
  const initialEnd = parseISO(customEnd);
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(initialEnd ?? initialStart ?? new Date()));
  const [pendingStart, setPendingStart] = useState<Date | null>(initialStart);
  const [pendingEnd, setPendingEnd] = useState<Date | null>(initialEnd);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  // Clicking the "August 2026" label drills into a month grid, then a year grid — same
  // day/month/year drill-down FormDatePicker's own calendar popup already uses, so jumping to a
  // different year doesn't mean clicking "previous month" a dozen times.
  const [view, setView] = useState<View>("range");
  const yearBlockStart = Math.floor(cursor.getFullYear() / 12) * 12;
  const yearBlock = Array.from({ length: 12 }, (_, i) => yearBlockStart + i);

  // While only a start is picked, the hovered day stands in as a live preview of what the range
  // would be if the user clicked it — collapses back to just pendingEnd once a real end is chosen.
  const effectiveEnd = pendingEnd ?? (pendingStart && hoverDate && !isBefore(hoverDate, pendingStart) ? hoverDate : null);

  const handleDayClick = (day: Date) => {
    if (!pendingStart || pendingEnd) { setPendingStart(day); setPendingEnd(null); return; }
    if (isBefore(day, pendingStart)) { setPendingStart(day); setPendingEnd(null); return; }
    setPendingEnd(day);
  };

  return (
    <div className="p-3 w-full max-h-full overflow-y-auto" onMouseLeave={() => setHoverDate(null)}>
      {/* Stays on screen no matter which month/year is currently browsed to, so picking a "from"
          date and then navigating far away to pick "to" doesn't feel like the first pick got
          lost — the range itself already supports any distance apart (see handleDayClick above),
          this is purely about keeping that fact visible. */}
      {pendingStart && (
        <div data-testid="range-pending-summary"
          className="flex items-center gap-1.5 mb-2.5 px-2.5 py-1.5 rounded-lg bg-primary/8 text-xs font-medium text-foreground">
          <span>{format(pendingStart, "dd MMM yyyy")}</span>
          <span className="text-muted-foreground">→</span>
          {pendingEnd
            ? <span>{format(pendingEnd, "dd MMM yyyy")}</span>
            : <span className="text-muted-foreground">pick an end date…</span>}
        </div>
      )}

      {view === "range" && (
        <>
          <div className="flex items-center justify-between mb-2.5">
            <button type="button" onClick={() => setCursor(c => subMonths(c, 1))} aria-label="Previous month"
              data-testid="range-nav-prev"
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setView("month")} data-testid="range-cursor-label"
              className="text-[11px] font-semibold text-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-muted transition-colors">
              {format(cursor, "MMMM yyyy")}
            </button>
            <button type="button" onClick={() => setCursor(c => addMonths(c, 1))} aria-label="Next month"
              data-testid="range-nav-next"
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-4">
            <MiniMonth cursorDate={cursor} pendingStart={pendingStart} effectiveEnd={effectiveEnd}
              onDayClick={handleDayClick} onDayHover={setHoverDate} />
            <MiniMonth cursorDate={addMonths(cursor, 1)} pendingStart={pendingStart} effectiveEnd={effectiveEnd}
              onDayClick={handleDayClick} onDayHover={setHoverDate} />
          </div>
        </>
      )}

      {view === "month" && (
        <>
          <div className="flex items-center justify-between mb-2.5">
            <button type="button" onClick={() => setCursor(c => new Date(c.getFullYear() - 1, c.getMonth(), 1))} aria-label="Previous year"
              data-testid="range-year-prev"
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setView("year")} data-testid="range-year-header"
              className="text-[11px] font-semibold text-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-muted transition-colors">
              {cursor.getFullYear()}
            </button>
            <button type="button" onClick={() => setCursor(c => new Date(c.getFullYear() + 1, c.getMonth(), 1))} aria-label="Next year"
              data-testid="range-year-next"
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_NAMES.map((m, i) => (
              <button key={m} type="button" data-testid={`range-month-${cursor.getFullYear()}-${String(i + 1).padStart(2, "0")}`}
                onClick={() => { setCursor(new Date(cursor.getFullYear(), i, 1)); setView("range"); }}
                className={cn("h-9 rounded-lg text-xs font-medium transition-all",
                  i === cursor.getMonth() ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      {view === "year" && (
        <>
          <div className="flex items-center justify-between mb-2.5">
            <button type="button" onClick={() => setCursor(c => new Date(c.getFullYear() - 12, c.getMonth(), 1))} aria-label="Previous years"
              data-testid="range-years-prev"
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-foreground">{yearBlockStart} – {yearBlockStart + 11}</span>
            <button type="button" onClick={() => setCursor(c => new Date(c.getFullYear() + 12, c.getMonth(), 1))} aria-label="Next years"
              data-testid="range-years-next"
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {yearBlock.map(yr => (
              <button key={yr} type="button" data-testid={`range-year-${yr}`}
                onClick={() => { setCursor(new Date(yr, cursor.getMonth(), 1)); setView("month"); }}
                className={cn("h-9 rounded-lg text-xs font-medium transition-all",
                  yr === cursor.getFullYear() ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
                {yr}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-border/60">
        <button type="button" data-testid="range-clear"
          onClick={() => { setPendingStart(null); setPendingEnd(null); onClear(); }}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          Clear (all time)
        </button>
        <button type="button" data-testid="range-apply" disabled={!pendingStart || !pendingEnd}
          onClick={() => { if (pendingStart && pendingEnd) onApply(format(pendingStart, "yyyy-MM-dd"), format(pendingEnd, "yyyy-MM-dd")); }}
          className="h-7 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all">
          Apply
        </button>
      </div>
    </div>
  );
}
