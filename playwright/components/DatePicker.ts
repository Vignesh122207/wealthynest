import type {Page} from "@playwright/test";

/** Drives wealthynest-web's FormDatePicker (components/forms/FormDatePicker.tsx) — a custom
 * calendar popup (day/month/year views), not a native <input type="date">. Reused by every form
 * with a date field (Expense/Income/Transfer date, FD purchase/maturity date, Goal target date). */
export async function pickDate(page: Page, triggerTestId: string, isoDate: string): Promise<void> {
  const [year, month] = isoDate.split("-").map(Number);

  await page.getByTestId(triggerTestId).click();
  // Day view -> month view (for whatever year the calendar currently shows) -> year view, so an
  // arbitrary target year/month is always reachable regardless of the calendar's initial cursor.
  await page.getByTestId("calendar-month-year-header").click();
  await page.getByTestId("calendar-year-header").click();
  await page.getByTestId(`calendar-year-${year}`).click();
  await page.getByTestId(`calendar-month-${year}-${String(month).padStart(2, "0")}`).click();
  await page.getByTestId(`calendar-day-${isoDate}`).click();
}
