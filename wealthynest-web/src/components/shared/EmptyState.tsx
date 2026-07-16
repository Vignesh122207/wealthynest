import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumIcon } from "@/components/icons/PremiumIcon";

interface EmptyStateProps {
  icon:        LucideIcon;
  title:       string;
  description: string;
  action?:     React.ReactNode;
  className?:  string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center px-4", className)}>
      <PremiumIcon icon={Icon} tone="gray" size="lg" className="mb-4" />
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-5">{description}</p>
      {action}
    </div>
  );
}
