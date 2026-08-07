"use client";

import {useQuery} from "@tanstack/react-query";
import {QUERY_KEYS} from "@/lib/constants";
import {currencyApi} from "../api/currency.api";

/** Live INR→USD/EUR rates for the Transactions page's currency toggle. The backend already
 * caches these for an hour (CurrencyRateServiceImpl), so a long client staleTime just avoids an
 * extra round-trip on every mount rather than working around a slow upstream. */
export function useCurrencyRates() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCY_RATES,
    queryFn:  currencyApi.getRates,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
