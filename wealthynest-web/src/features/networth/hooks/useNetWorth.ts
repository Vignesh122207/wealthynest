"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import { networthApi } from "../api/networth.api";

export function useNetWorthSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.NET_WORTH_SUMMARY,
    queryFn:  networthApi.getSummary,
  });
}

export function useNetWorthHistory() {
  return useQuery({
    queryKey: [...QUERY_KEYS.NET_WORTH_SUMMARY, "history"],
    queryFn:  networthApi.getHistory,
    staleTime: 1000 * 60 * 30,
  });
}
