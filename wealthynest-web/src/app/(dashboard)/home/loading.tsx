// Overrides the group-level (dashboard)/loading.tsx specifically for /home: that generic
// 4-stat-card + table skeleton doesn't match Home's actual layout, so on any client-side
// navigation that hits it (notably /launch's router.replace on cold start, which never
// prefetches /home first) it flashed briefly before Home's own page mounted and immediately
// swapped in its real per-widget isLoading skeletons — two visibly different loading UIs back
// to back, reported as "loading twice." Home already renders its own accurate skeleton per
// section (StatOverview, BudgetSection, TransactionList, NetWorthTrend, SixMonthTrend all take
// isLoading), so this segment needs no fallback of its own.
export default function HomeLoading() {
  return null;
}
