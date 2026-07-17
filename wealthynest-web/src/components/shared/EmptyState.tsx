import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumIcon, type IconTone } from "@/components/icons/PremiumIcon";

interface EmptyStateProps {
  icon:        LucideIcon;
  title:       string;
  description: string;
  action?:     React.ReactNode;
  className?:  string;
  /** Defaults to "gray" for a genuinely empty list — pass "red" (via QueryErrorState, usually)
   * when this is standing in for a failed request instead, so the icon itself signals which one. */
  tone?:       IconTone;
}

export function EmptyState({ icon: Icon, title, description, action, className, tone = "gray" }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center px-4", className)}>
      <PremiumIcon icon={Icon} tone={tone} size="lg" className="mb-4" />
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-5">{description}</p>
      {action}
    </div>
  );
}
