import { cn, formatCurrency } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount:     number;
  currency?:  string;
  className?: string;
  size?:      "sm" | "md" | "lg" | "xl";
  color?:     "default" | "success" | "danger" | "muted";
}

const SIZE_CLASSES  = { sm: "text-sm", md: "text-base", lg: "text-xl font-semibold", xl: "text-3xl font-bold" };
const COLOR_CLASSES = { default: "text-slate-100", success: "text-emerald-400", danger: "text-red-400", muted: "text-slate-400" };

export function CurrencyDisplay({ amount, currency, className, size = "md", color = "default" }: CurrencyDisplayProps) {
  return (
    <span className={cn(SIZE_CLASSES[size], COLOR_CLASSES[color], "tabular-nums tracking-tight", className)}>
      {formatCurrency(amount, currency)}
    </span>
  );
}
