import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getStoredCurrency(): string {
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

export function formatCurrency(amount: number, currency?: string): string {
  const curr = currency ?? getStoredCurrency();
  const locale = curr === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: curr,
    maximumFractionDigits: 0,
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

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(date));
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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
