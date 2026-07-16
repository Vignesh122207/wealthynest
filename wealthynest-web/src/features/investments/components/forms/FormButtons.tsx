import { cn } from "@/lib/utils";

export function FormButtons({ onCancel, isPending, label, color }: {
  onCancel: () => void; isPending: boolean; label: string; color: string;
}) {
  const bgMap: Record<string, string> = {
    indigo: "bg-indigo-600 hover:bg-indigo-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    amber: "bg-amber-600 hover:bg-amber-500",
    sky: "bg-sky-600 hover:bg-sky-500",
    violet: "bg-violet-600 hover:bg-violet-500",
  };
  return (
    <div className="flex gap-2 pt-1">
      <button type="submit" disabled={isPending}
        className={cn("flex-1 h-10 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60", bgMap[color] ?? bgMap.indigo)}>
        {isPending ? "Saving…" : label}
      </button>
      <button type="button" onClick={onCancel}
        className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
        Cancel
      </button>
    </div>
  );
}
