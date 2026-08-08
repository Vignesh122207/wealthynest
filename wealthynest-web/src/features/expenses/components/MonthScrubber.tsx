import {ChevronLeft, ChevronRight} from "lucide-react";
import {cn} from "@/lib/utils";
import {monthLabel} from "../utils/filterHelpers";
import type {DateMode} from "../types/filters.types";

// Persistent calendar-month pager, always visible next to DateRangeCapsule instead of gated
// behind a "This Month" pill — a chevron both pages the month/year state and switches dateMode to
// "month" in one action, so it stays in sync with whichever range the capsule shows as active.
export function MonthScrubber({ dateMode, setDateMode, year, setYear, month, setMonth, className }: {
  dateMode: DateMode; setDateMode: (m: DateMode) => void;
  year: number; setYear: (y: number) => void;
  month: number; setMonth: (m: number) => void;
  className?: string;
}) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isActive = dateMode === "month";

  const navigate = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y); setDateMode("month");
  };

  return (
    <div className={cn("flex items-center gap-0.5 h-10 shrink-0", className)}>
      <button type="button" onClick={() => navigate(-1)} aria-label="Previous month" data-testid="scrubber-prev"
        className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span data-testid="scrubber-label"
        className={cn("text-sm px-1 min-w-[104px] text-center whitespace-nowrap transition-colors",
          isActive ? "font-semibold text-blue-600 dark:text-blue-400" : "font-medium text-muted-foreground")}>
        {monthLabel(year, month)}
      </span>
      <button type="button" onClick={() => navigate(1)} disabled={isCurrentMonth} aria-label="Next month" data-testid="scrubber-next"
        className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
