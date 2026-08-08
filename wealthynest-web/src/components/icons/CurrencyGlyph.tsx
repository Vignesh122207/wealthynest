import {getCurrencySymbol} from "@/lib/utils";
import {DirhamSign} from "./DirhamSign";

// Single place that decides "text symbol, or the real AED glyph" — used by every spot that
// renders the active currency's symbol as its own JSX node (amount-input prefixes, the
// Appearance currency picker). Text-only contexts (CSV headers, masked-privacy placeholders,
// filter-chip labels built via string concatenation) can't use this — an SVG can't substitute
// inside a template literal — and keep showing "AED" as plain text; there's no way around that
// until the real character ships in mainstream fonts.
export function CurrencyGlyph({ code, className }: { code?: string; className?: string }) {
  if (code === "AED") return <DirhamSign className={className} />;
  return <span className={className}>{getCurrencySymbol(code)}</span>;
}
