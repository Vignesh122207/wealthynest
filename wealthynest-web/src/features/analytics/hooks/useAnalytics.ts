"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import { analyticsApi } from "../api/analytics.api";

export function useAnalytics(year?: number, month?: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.DASHBOARD, "analytics", year, month],
    queryFn:  () => analyticsApi.getDashboard(year, month),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAnnualTrend(year: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.DASHBOARD, "annual", year],
    queryFn:  () => analyticsApi.getAnnualTrend(year),
    staleTime: 1000 * 60 * 10,
  });
}
