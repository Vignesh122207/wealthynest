import {cn} from "@/lib/utils";

export function FormButtons({ onCancel, isPending, label, color }: {
  onCancel: () => void; isPending: boolean; label: string; color: string;
}) {
  const bgMap: Record<string, string> = {
    indigo: "bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40",
    emerald: "bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40",
    amber: "bg-gradient-to-br from-amber-600 to-amber-500 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40",
    sky: "bg-gradient-to-br from-sky-600 to-sky-500 shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40",
    violet: "bg-gradient-to-br from-violet-600 to-violet-500 shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40",
  };
  return (
    <div className="flex gap-2 pt-1">
      <button type="submit" data-testid="investment-form-submit" disabled={isPending}
        className={cn("flex-1 h-10 rounded-xl text-sm font-medium text-white hover:-translate-y-0.5 disabled:hover:translate-y-0 transition-all disabled:opacity-60", bgMap[color] ?? bgMap.indigo)}>
        {isPending ? "Saving…" : label}
      </button>
      <button type="button" onClick={onCancel}
        className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
        Cancel
      </button>
    </div>
  );
}
