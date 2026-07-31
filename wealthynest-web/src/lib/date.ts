// new Date().toISOString().split("T")[0] looks like a harmless way to get "today" as YYYY-MM-DD,
// but toISOString() converts to UTC first — for any timezone ahead of UTC (IST included,
// UTC+5:30), that rolls the date back a calendar day for roughly the first ~5.5 hours after local
// midnight, silently defaulting date fields to yesterday. getFullYear()/getMonth()/getDate() read
// the local calendar directly, with no UTC conversion.
export function todayLocalISO(): string {
  return toLocalISODate(new Date());
}

export function toLocalISODate(date: Date): string {
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day   = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
