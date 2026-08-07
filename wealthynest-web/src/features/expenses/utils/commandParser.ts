import type {Granularity} from "./granularity";
import type {TxType} from "../types/filters.types";

export interface ParsedCommand {
  granularity?:   Granularity;
  categoryId?:    string;
  categoryName?:  string;
  txType?:        TxType;
  recurringOnly?: boolean;
  /** Human-readable labels for what was actually understood, for a "Applied: X, Y, Z" confirmation
   * — a command bar that silently changes filters with no feedback is worse than no command bar. */
  matchedTerms:   string[];
}

// Loose aliases so "food" resolves to whichever of the user's OWN categories is actually named
// something like "Dining" or "Groceries" — this is deliberately a small, lightweight keyword
// matcher (no backend, no LLM), not a real NLU model, so it only needs to cover common phrasing,
// not every possible way to say something.
const CATEGORY_ALIASES: Record<string, string[]> = {
  food:          ["food", "dining", "restaurant", "grocery", "groceries", "eating"],
  shopping:      ["shopping", "shop"],
  travel:        ["travel", "trip", "vacation", "holiday"],
  transport:     ["transport", "fuel", "petrol", "cab", "commute", "uber", "ola"],
  entertainment: ["entertainment", "movie", "streaming", "subscription"],
  health:        ["health", "medical", "doctor", "pharmacy", "fitness", "gym"],
  bills:         ["bill", "utility", "utilities", "electricity", "rent"],
};

function findGranularity(q: string): { granularity?: Granularity; label?: string } {
  if (/\bytd\b|year to date/.test(q)) return { granularity: "YTD", label: "Year to date" };
  if (/\ball time\b|\beverything\b|\bever\b/.test(q)) return { granularity: "ALL", label: "All time" };
  const monthsMatch = q.match(/(?:last\s+)?(\d+)\s*months?/);
  if (monthsMatch) {
    const n = Number(monthsMatch[1]);
    const granularity: Granularity = n <= 1 ? "1M" : n <= 3 ? "3M" : "6M";
    return { granularity, label: `Last ${n} month${n === 1 ? "" : "s"}` };
  }
  if (/\bthis month\b|\blast month\b/.test(q)) return { granularity: "1M", label: "Last month" };
  return {};
}

function findCategory(q: string, categories: { id: string; name: string }[]): { categoryId?: string; categoryName?: string } {
  // Direct name match first — "groceries" typed verbatim always wins over an alias guess.
  for (const c of categories) {
    if (q.includes(c.name.toLowerCase())) return { categoryId: c.id, categoryName: c.name };
  }
  for (const aliasValues of Object.values(CATEGORY_ALIASES)) {
    if (!aliasValues.some(a => q.includes(a))) continue;
    const match = categories.find(c => aliasValues.some(a => c.name.toLowerCase().includes(a)));
    if (match) return { categoryId: match.id, categoryName: match.name };
  }
  return {};
}

function findTxType(q: string): { txType?: TxType; label?: string } {
  const mentionsSpending = /\bspending\b|\bexpenses?\b|\bspent\b/.test(q);
  const mentionsIncome   = /\bincome\b|\bearnings?\b|\bsalary\b/.test(q);
  const mentionsTransfer = /\btransfers?\b/.test(q);
  // "food spending ... compared to income" mentions both — the comparison is exactly what the
  // merged All tab already shows (expenses + income side by side), so treat "compared to" (or
  // both terms present at once) as a request for that view rather than picking one arbitrarily.
  if (mentionsSpending && mentionsIncome) return { txType: "all", label: "All transactions" };
  if (mentionsSpending) return { txType: "expenses", label: "Expenses" };
  if (mentionsIncome)   return { txType: "income", label: "Income" };
  if (mentionsTransfer) return { txType: "transfers", label: "Transfers" };
  return {};
}

/** Lightweight, fully client-side natural-language command parser — pattern/keyword matching
 * against filters already on the Transactions page (category, date range, tab), not a real
 * LLM-backed query engine. Deliberately conservative: only sets fields it's actually confident
 * about, and reports exactly what it understood via matchedTerms so nothing changes silently. */
export function parseCommand(query: string, categories: { id: string; name: string }[]): ParsedCommand {
  const q = query.toLowerCase().trim();
  const result: ParsedCommand = { matchedTerms: [] };
  if (!q) return result;

  const { granularity, label: dateLabel } = findGranularity(q);
  if (granularity) { result.granularity = granularity; result.matchedTerms.push(dateLabel!); }

  const { categoryId, categoryName } = findCategory(q, categories);
  if (categoryId) { result.categoryId = categoryId; result.categoryName = categoryName; result.matchedTerms.push(categoryName!); }

  const { txType, label: typeLabel } = findTxType(q);
  if (txType) { result.txType = txType; result.matchedTerms.push(typeLabel!); }

  if (/\brecurring\b/.test(q)) { result.recurringOnly = true; result.matchedTerms.push("Recurring only"); }

  return result;
}
