import {cn} from "@/lib/utils";

export function SortPills<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-xl border border-border/50">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 h-8 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
            value === o.value
              ? "bg-card text-foreground shadow-sm border border-border/40"
              : "text-muted-foreground hover:text-foreground",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
