import {cn} from "@/lib/utils";
import {MAX_MEMBERS} from "../constants";

export function SlotBar({ count }: { count: number }) {
  const isFull = count >= MAX_MEMBERS;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: MAX_MEMBERS }).map((_, i) => (
          <div key={i} className={cn(
            "w-3.5 h-3.5 rounded-full border-2 transition-all",
            i < count
              ? isFull ? "bg-amber-400 border-amber-400" : "bg-indigo-500 border-indigo-500"
              : "bg-transparent border-border"
          )} />
        ))}
      </div>
      <span className={cn("text-xs font-semibold tabular-nums", isFull ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        {count} / {MAX_MEMBERS}{isFull && " · Full"}
      </span>
    </div>
  );
}
