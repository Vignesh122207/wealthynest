import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumIcon, type IconTone } from "@/components/icons/PremiumIcon";

interface StatCardProps {
  title:      string;
  value:      string;
  subtitle?:  string;
  icon:       LucideIcon;
  /** Apple system-color tone for the glossy icon tile — same palette every other stat/category tile in the app uses. */
  tone?:      IconTone;
  trend?:     number;
  className?: string;
}

// Glossy PremiumIcon tile, matching the Home dashboard's StatOverview tiles —
// this component used to render a flat tinted-box icon (iconBg/iconColor
// props), which is why Admin's Overview and any other StatCard user looked
// visually flatter than Home's stat row despite serving the same role.
export function StatCard({ title, value, subtitle, icon, tone = "indigo", trend, className }: StatCardProps) {
  const trendPositive = trend != null && trend >= 0;
  const trendLarge    = trend != null && Math.abs(trend) > 500;

  return (
    <div className={cn(
      "bg-card border border-border rounded-2xl p-4 transition-all duration-200",
      "hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5",
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <PremiumIcon icon={icon} tone={tone} size="sm" />

        {trend !== undefined && !trendLarge && (
          <span className={cn(
            "text-[11px] font-semibold px-2 py-0.5 rounded-full",
            trendPositive
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}>
            {trendPositive ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {trend !== undefined && trendLarge && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            New
          </span>
        )}
      </div>

      <p className="text-xl font-bold text-foreground tabular-nums tracking-tight leading-none mb-1">{value}</p>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{subtitle}</p>}
    </div>
  );
}
