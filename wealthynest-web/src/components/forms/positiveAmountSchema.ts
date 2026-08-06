import {z} from "zod";

/** Shared "positive amount, optionally capped" schema factory for the app's single-field amount
 * modals (debt payment/received, loan payment, goal savings add/withdraw) — same
 * react-hook-form + zod validation shape every other form in the app uses, just for a form with
 * exactly one field, instead of each one hand-rolling its own useState + inline check. `max` is
 * computed fresh per call (remaining debt, remaining goal amount, etc.), same pattern as
 * goalSchema(isLinked) being rebuilt each render for its own dynamic cap. */
export function positiveAmountSchema(max?: number, maxMessage?: string) {
  let amount = z.coerce.number().positive("Enter an amount greater than zero.");
  if (max != null) amount = amount.max(max, maxMessage ?? `Cannot exceed ${max}.`);
  return z.object({ amount });
}

export type PositiveAmountFormValues = z.input<ReturnType<typeof positiveAmountSchema>>;
