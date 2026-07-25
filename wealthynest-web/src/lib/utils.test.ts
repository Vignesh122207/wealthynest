import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cn,
  apiErrorMessage,
  apiErrorCode,
  apiErrorDetails,
  apiRetryAfterSeconds,
  escapeCsvField,
  pctChange,
  formatTrendDelta,
  getStoredCurrency,
  getCurrencySymbol,
  formatCurrency,
  formatCurrencyExact,
  formatCurrencyCompact,
  formatChartTickINR,
  formatDate,
  getInitials,
  getGreeting,
  monthLabel,
  escapeHtml,
} from "./utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts, last one winning", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("apiErrorMessage", () => {
  it("extracts the backend's message from an axios-style error response", () => {
    const error = { response: { data: { message: "Insufficient balance in HDFC Bank." } } };
    expect(apiErrorMessage(error, "fallback")).toBe("Insufficient balance in HDFC Bank.");
  });

  it("falls back for a plain Error with no response payload", () => {
    expect(apiErrorMessage(new Error("network down"), "Something went wrong")).toBe("Something went wrong");
  });

  it("falls back when response.data has no message field", () => {
    const error = { response: { data: {} } };
    expect(apiErrorMessage(error, "fallback")).toBe("fallback");
  });

  it("falls back for a non-object error value", () => {
    expect(apiErrorMessage("just a string", "fallback")).toBe("fallback");
  });
});

describe("apiErrorCode", () => {
  it("extracts the backend's machine-readable error code", () => {
    const error = { response: { data: { error: "ACCOUNT_LOCKED" } } };
    expect(apiErrorCode(error)).toBe("ACCOUNT_LOCKED");
  });

  it("returns undefined when there's no response payload", () => {
    expect(apiErrorCode(new Error("network down"))).toBeUndefined();
  });
});

describe("apiErrorDetails", () => {
  it("extracts the structured details map a BusinessException attached", () => {
    const error = { response: { data: { details: { lockedUntil: "2026-01-01T00:00:00Z" } } } };
    expect(apiErrorDetails(error)).toEqual({ lockedUntil: "2026-01-01T00:00:00Z" });
  });

  it("returns undefined when there are no details", () => {
    const error = { response: { data: {} } };
    expect(apiErrorDetails(error)).toBeUndefined();
  });
});

describe("apiRetryAfterSeconds", () => {
  it("extracts the rate limiter's retryAfterSeconds", () => {
    const error = { response: { data: { retryAfterSeconds: 42 } } };
    expect(apiRetryAfterSeconds(error)).toBe(42);
  });

  it("returns undefined when absent", () => {
    expect(apiRetryAfterSeconds({ response: { data: {} } })).toBeUndefined();
  });
});

describe("escapeCsvField", () => {
  it("returns an empty string unchanged", () => {
    expect(escapeCsvField("")).toBe("");
  });

  it("leaves a plain value untouched", () => {
    expect(escapeCsvField("Groceries")).toBe("Groceries");
  });

  it("quotes a value containing a comma", () => {
    expect(escapeCsvField("Smith, John")).toBe('"Smith, John"');
  });

  it("quotes a value containing a double quote and escapes the inner quote", () => {
    expect(escapeCsvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("prefixes a leading '=' to neutralize CSV formula injection", () => {
    expect(escapeCsvField("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
  });

  it("prefixes a leading '+', '-', '@', tab, or CR the same way", () => {
    expect(escapeCsvField("+1")).toBe("'+1");
    expect(escapeCsvField("-1")).toBe("'-1");
    expect(escapeCsvField("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("does not mistake a mid-string '=' for a formula prefix", () => {
    expect(escapeCsvField("a=b")).toBe("a=b");
  });
});

describe("pctChange", () => {
  it("returns undefined when either value is missing", () => {
    expect(pctChange(undefined, 100)).toBeUndefined();
    expect(pctChange(100, undefined)).toBeUndefined();
  });

  it("computes a positive percentage increase", () => {
    expect(pctChange(150, 100)).toBe(50);
  });

  it("computes a negative percentage decrease", () => {
    expect(pctChange(50, 100)).toBe(-50);
  });

  it("treats a zero previous value with a positive current as +100%, not a divide-by-zero blowup", () => {
    expect(pctChange(500, 0)).toBe(100);
  });

  it("treats a zero previous value with a zero current as 0%, not hidden", () => {
    expect(pctChange(0, 0)).toBe(0);
  });

  it("uses the absolute value of a negative previous value as the denominator", () => {
    expect(pctChange(-50, -100)).toBe(50);
  });

  it("hides an absurd swing beyond 999% rather than showing a meaningless number", () => {
    expect(pctChange(5000, 1)).toBeUndefined();
  });
});

describe("formatTrendDelta", () => {
  it("returns undefined when there's no percentage to show", () => {
    expect(formatTrendDelta(undefined)).toBeUndefined();
  });

  it("renders an upward arrow for a positive change", () => {
    expect(formatTrendDelta(4.8)).toBe("↑ 4.8% vs last month");
  });

  it("renders a downward arrow for a negative change, using the absolute magnitude", () => {
    expect(formatTrendDelta(-4.8)).toBe("↓ 4.8% vs last month");
  });

  it("accepts a custom suffix", () => {
    expect(formatTrendDelta(10, "vs last week")).toBe("↑ 10.0% vs last week");
  });
});

describe("getStoredCurrency / getCurrencySymbol", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to INR when nothing is stored", () => {
    expect(getStoredCurrency()).toBe("INR");
  });

  it("reads the currency out of the wn-preferences store", () => {
    window.localStorage.setItem("wn-preferences", JSON.stringify({ state: { currency: "USD" } }));
    expect(getStoredCurrency()).toBe("USD");
  });

  it("falls back to INR when the stored value is malformed JSON", () => {
    window.localStorage.setItem("wn-preferences", "{not json");
    expect(getStoredCurrency()).toBe("INR");
  });

  it("maps known currency codes to their symbol", () => {
    expect(getCurrencySymbol("INR")).toBe("₹");
    expect(getCurrencySymbol("USD")).toBe("$");
    expect(getCurrencySymbol("EUR")).toBe("€");
    expect(getCurrencySymbol("GBP")).toBe("£");
  });

  it("falls back to the raw code for an unknown currency", () => {
    expect(getCurrencySymbol("XYZ")).toBe("XYZ");
  });

  it("uses the stored currency when none is passed explicitly", () => {
    window.localStorage.setItem("wn-preferences", JSON.stringify({ state: { currency: "USD" } }));
    expect(getCurrencySymbol()).toBe("$");
  });
});

describe("formatCurrency", () => {
  it("formats a whole-rupee INR amount with no decimals", () => {
    expect(formatCurrency(150000, "INR")).toBe("₹1,50,000");
  });

  it("rounds a fractional amount to the nearest whole rupee", () => {
    expect(formatCurrency(9999.5, "INR")).toBe("₹10,000");
  });

  it("formats USD using US grouping", () => {
    expect(formatCurrency(150000, "USD")).toBe("$150,000");
  });
});

describe("formatCurrencyExact", () => {
  it("matches formatCurrency for a whole-rupee amount", () => {
    expect(formatCurrencyExact(10000, "INR")).toBe("₹10,000");
  });

  it("shows the true paise value instead of rounding, unlike formatCurrency", () => {
    expect(formatCurrencyExact(9999.5, "INR")).toBe("₹9,999.5");
  });
});

describe("formatCurrencyCompact", () => {
  it("compacts a large INR amount using lakh notation", () => {
    expect(formatCurrencyCompact(1500000, "INR")).toBe("₹15L");
  });
});

describe("formatChartTickINR", () => {
  it("renders values under a lakh in thousands", () => {
    expect(formatChartTickINR(45000)).toBe("₹45K");
  });

  it("renders values at or above a lakh in lakhs with one decimal", () => {
    expect(formatChartTickINR(250000)).toBe("₹2.5L");
  });

  it("puts the minus sign before the ₹ symbol for a negative tick, not between ₹ and the number", () => {
    expect(formatChartTickINR(-250000)).toBe("-₹2.5L");
  });
});

describe("formatDate", () => {
  it("formats a date string as dd MMM yyyy", () => {
    expect(formatDate("2026-06-01")).toBe("01 Jun 2026");
  });

  it("formats a Date object the same way", () => {
    expect(formatDate(new Date(2026, 5, 1))).toBe("01 Jun 2026");
  });
});

describe("getInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getInitials("Vignesh Arunachalam")).toBe("VA");
  });

  it("uppercases lowercase input", () => {
    expect(getInitials("john doe")).toBe("JD");
  });

  it("handles a single-word name", () => {
    expect(getInitials("Cher")).toBe("C");
  });

  it("collapses repeated whitespace between words", () => {
    expect(getInitials("  Jane   Smith  ")).toBe("JS");
  });

  it("falls back to '?' for an empty/whitespace-only name", () => {
    expect(getInitials("   ")).toBe("?");
  });
});

describe("getGreeting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'morning' before noon", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 9, 0, 0));
    expect(getGreeting()).toBe("morning");
  });

  it("returns 'afternoon' between noon and 5pm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 14, 0, 0));
    expect(getGreeting()).toBe("afternoon");
  });

  it("returns 'evening' at or after 5pm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 20, 0, 0));
    expect(getGreeting()).toBe("evening");
  });
});

describe("monthLabel", () => {
  it("renders a short month name with the year", () => {
    expect(monthLabel(2026, 6)).toBe("Jun 2026");
  });

  it("handles January correctly (1-indexed month input, 0-indexed Date constructor)", () => {
    expect(monthLabel(2026, 1)).toBe("Jan 2026");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert('&"xss"')</script>`))
      .toBe("&lt;script&gt;alert(&#39;&amp;&quot;xss&quot;&#39;)&lt;/script&gt;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Groceries")).toBe("Groceries");
  });
});
