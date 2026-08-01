import {expect, type Page} from "@playwright/test";

/** A page whose content overflows its viewport horizontally forces the whole app into side-scroll
 * on narrow screens — the most common "not actually responsive" symptom. Shared by BasePage (for
 * authenticated dashboard page objects) and by pre-login pages (login/signup), which have their
 * own page objects but aren't authenticated and so don't extend BasePage. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "page overflows horizontally at the current viewport width").toBeLessThanOrEqual(clientWidth + 1);
}
