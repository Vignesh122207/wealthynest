import {cn} from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 px-4 border-b border-border/40">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </>
  );
}
