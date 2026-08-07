// How many months of `year` have actually elapsed, relative to `now` — used to prorate the
// Yearly summary's "Budgeted This Year" figure (monthlyBudgeted × this, not a flat × 12). A flat
// ×12 projects a full year's commitment from whatever the current month's budget happens to be,
// which overstates the figure for anyone who only started budgeting partway through the year. A
// fully-elapsed past year still gets the full 12; a not-yet-reached year (not reachable via the
// page's own navigateYear, which blocks going past the current year, but kept defensive) gets 0.
export function getMonthsElapsedInYear(year: number, now: Date): number {
  if (year < now.getFullYear()) return 12;
  if (year > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}
