/** Converts an amount stored in `baseCurrency` (always INR in this app) into `targetCurrency`
 * using live rates ({@link CurrencyRates.rates}, keyed by target code, 1 unit of base → N units
 * of that currency). Returns the amount unconverted when no rate is available for the target —
 * callers must gate which currencies are selectable on `rates` actually having that key (see
 * CurrencyToggle), so this fallback is a defensive no-op, never a silently-wrong displayed value
 * reachable through the UI. */
export function convertAmount(
  amount: number,
  targetCurrency: string,
  baseCurrency: string,
  rates: Record<string, number> | undefined,
): number {
  if (targetCurrency === baseCurrency) return amount;
  const rate = rates?.[targetCurrency];
  if (rate == null) return amount;
  return amount * rate;
}
