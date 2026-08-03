"use client";

import {useQuery} from "@tanstack/react-query";
import {QUERY_KEYS} from "@/lib/constants";
import {analyticsApi} from "../api/analytics.api";

// `enabled` defaults to true (every existing call site, e.g. Analytics' own YoY chart, is
// unaffected) — Home's Year-mode toggle passes false while browsing Month mode so this fetch
// (and the year-1 comparison call alongside it) doesn't fire on every Home load.
export function useAnnualTrend(year: number, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.DASHBOARD, "annual", year],
    queryFn:  () => analyticsApi.getAnnualTrend(year),
    staleTime: 1000 * 60 * 10,
    enabled,
  });
}
