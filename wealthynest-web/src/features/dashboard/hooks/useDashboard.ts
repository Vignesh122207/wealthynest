"use client";

import {useQuery} from "@tanstack/react-query";
import {QUERY_KEYS} from "@/lib/constants";
import {dashboardApi} from "../api/dashboard.api";

export function useDashboard(year?: number, month?: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.DASHBOARD, year, month],
    queryFn:  () => dashboardApi.getDashboard(year, month),
    staleTime: 1000 * 60 * 2,
  });
}
