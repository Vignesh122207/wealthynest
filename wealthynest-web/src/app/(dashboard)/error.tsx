"use client";

import {AlertTriangle} from "lucide-react";

// Route-level error boundary for the dashboard segment, same shape as this directory's own
// loading.tsx: the persistent (dashboard)/layout.tsx (sidebar/header/mobile nav) keeps rendering
// around this, so an error in one page's content doesn't blank the whole app shell the way falling
// through to the root app/error.tsx would - the user keeps their nav to get somewhere else.
export default function DashboardErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>
      <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{error.message || "This page hit an unexpected error."}</p>
      <button onClick={reset}
        className="bg-gradient-to-br from-brand-600 to-brand-500 shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
        Try again
      </button>
    </div>
  );
}
