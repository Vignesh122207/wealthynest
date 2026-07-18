import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pulls the backend's BusinessException message (e.g. "Insufficient balance in HDFC Bank.")
// out of a failed mutation's error, falling back to a generic message for anything else
// (network errors, unexpected 500s) that doesn't carry a useful server-provided reason.
export function apiErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "response" in e) {
    const data = (e as { response?: { data?: { message?: string } } }).response?.data;
    if (data?.message) return data.message;
  }
  return fallback;
}

// Escapes a single CSV cell: quotes it when it contains a comma/quote/newline,
// and — separately — guards against CSV formula injection. Excel/Sheets treat
// a cell starting with =, +, -, @ (or a tab/CR) as a formula to evaluate even
// when the cell is quoted, so a stray user-entered description like
// "=cmd|'/c calc'!A1" would execute on open. Prefixing a literal apostrophe
// forces it to be read as plain text instead.
export function escapeCsvField(value: string): string {
  if (!value) return "";
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Percentage change vs a previous value. Returns undefined only when a value
// is genuinely missing (so the tile can fall back to a "New" badge) — every
// stat tile on the dashboard uses this same helper so they read uniformly.
// A zero previous value is treated as a full +100% move (curr > 0) rather than
// hidden, since dividing by zero would either blow up (e.g. a stray ₹1 credit
// producing "+4,999,900%") or, if left unguarded, hide the comparison entirely.
export function pctChange(curr: number | undefined, prev: number | undefined): number | undefined {
  if (curr == null || prev == null) return undefined;
  if (prev === 0) return curr === 0 ? 0 : 100;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return Number.isFinite(pct) && Math.abs(pct) <= 999 ? pct : undefined;
}

// Renders a signed trend percentage with a directional arrow, e.g. "↑ 4.8% vs last month".
// Returns undefined (render nothing / a "New" fallback) when there's no value to show.
export function formatTrendDelta(pct: number | undefined, suffix = "vs last month"): string | undefined {
  if (pct == null) return undefined;
  return `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(1)}% ${suffix}`;
}

export function getStoredCurrency(): string {
  try {
    const raw = localStorage.getItem("wn-preferences");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.currency ?? "INR";
    }
  } catch {
    // ignore
  }
  return "INR";
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

/** Standalone currency symbol (no amount) — for CSV headers, masked-privacy placeholders, etc.,
 * where formatCurrency's Intl.NumberFormat output can't be used because there's no number to format. */
export function getCurrencySymbol(currency?: string): string {
  const curr = currency ?? getStoredCurrency();
  return CURRENCY_SYMBOLS[curr] ?? curr;
}

export function formatCurrency(amount: number, currency?: string): string {
  const curr = currency ?? getStoredCurrency();
  const locale = curr === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: curr,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Whole-rupee display (formatCurrency) rounds ₹9,999.50 up to "₹10,000" — fine for dashboards,
// but misleading anywhere the number IS the spendable ceiling (account pickers next to an amount
// field): a user who sees "₹10,000" and enters exactly that gets rejected for being 50 paise
// over. This shows the true balance whenever it isn't a whole rupee, and stays identical to
// formatCurrency otherwise.
export function formatCurrencyExact(amount: number, currency?: string): string {
  const curr = currency ?? getStoredCurrency();
  const locale = curr === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: curr,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number, currency?: string): string {
  const curr = currency ?? getStoredCurrency();
  const locale = curr === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: curr,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Chart axis tick label: always ₹, always L (lakh) or K (thousand) — distinct from
 * formatCurrencyCompact, which respects the user's stored currency preference. */
export function formatChartTickINR(value: number): string {
  return `₹${Math.abs(value) >= 100000 ? `${(value / 100000).toFixed(1)}L` : `${(value / 1000).toFixed(0)}K`}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

// Escapes text before it's interpolated into an HTML string built by hand (e.g. the Reports
// page's print/PDF template, assembled via document.write rather than React) — anywhere a
// user-editable value like a category name rides along un-sanitized, e.g. via `${cat}` in a
// template literal, it would otherwise execute as markup instead of rendering as plain text.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
