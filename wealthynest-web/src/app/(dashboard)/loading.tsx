import {StatCardSkeleton, TableRowSkeleton} from "@/components/shared/LoadingSkeleton";

// Route-level fallback shown while a dashboard segment's JS chunk/RSC payload is
// still loading — the persistent (dashboard)/layout.tsx (sidebar/header) keeps
// rendering around this, so only the page content area shows the skeleton.
// Per-page data-fetch loading (TanStack Query isLoading) is handled separately
// inside each page and is unaffected by this.
export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <TableRowSkeleton rows={6} />
      </div>
    </div>
  );
}
