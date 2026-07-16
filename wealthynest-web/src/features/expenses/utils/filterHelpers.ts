export function pad(n: number) { return String(n).padStart(2, "0"); }

export function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}
