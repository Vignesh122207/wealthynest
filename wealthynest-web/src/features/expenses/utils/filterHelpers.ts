export function pad(n: number) { return String(n).padStart(2, "0"); }

export function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

/** ANDs an explicit account selection with a payment-channel-derived account list, instead of
 * letting whichever one is set last silently override the other. Without this, picking an account
 * on the Transfers tab's filter panel and then a payment channel on the Expenses tab produced
 * different result sets depending on which tab was open: the server-side Expenses-tab query only
 * ever sent one of the two lists (never both), while the client-side "All" tab filter already
 * ANDed them together.
 *
 * - Both set: narrow to accounts satisfying both (the explicit selection, filtered to the channel).
 * - Only one set: use it.
 * - Neither set: empty (no account filter).
 */
export function resolveEffectiveAccountIds(
  payChannel: string,
  selectedAccountIds: string[],
  channelAccountIds: string[],
): string[] {
  if (payChannel && selectedAccountIds.length > 0) {
    return selectedAccountIds.filter(id => channelAccountIds.includes(id));
  }
  if (selectedAccountIds.length > 0) return selectedAccountIds;
  return channelAccountIds;
}
