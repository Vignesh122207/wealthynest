import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title:      string;
  value:      string;
  subtitle?:  string;
  icon:       LucideIcon;
  iconColor?: string;
  iconBg?:    string;
  trend?:     number;
  className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-2xl p-5 hover:shadow-sm hover:border-border/80 transition-all",
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg ?? "bg-primary/10")}>
          <Icon className={cn("w-5 h-5", iconColor ?? "text-primary")} />
        </div>
        {trend !== undefined && (
          Math.abs(trend) > 500 ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
              New
            </span>
          ) : (
            <span className={cn(
              "text-xs font-semibold px-2 py-1 rounded-full",
              trend >= 0 ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-red-500/10 text-red-500 dark:text-red-400"
            )}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
            </span>
          )
        )}
      </div>
      <p className="text-2xl font-bold text-foreground mb-0.5 tracking-tight tabular-nums">{value}</p>
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>}
    </div>
  );
}
