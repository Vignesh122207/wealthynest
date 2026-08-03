import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";

export class HomePage extends BasePage {
  async gotoHome(): Promise<void> {
    await this.goto(ROUTES.home);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${ROUTES.home}$`));
    await this.expectHeaderTitle("Home");
  }

  get attentionRow(): Locator {
    return this.page.getByTestId(TEST_IDS.home.attentionRow);
  }

  get overBudgetBanner(): Locator {
    return this.page.getByTestId(TEST_IDS.home.overBudgetBanner);
  }

  get overBudgetDismissButton(): Locator {
    return this.page.getByTestId(TEST_IDS.home.overBudgetDismiss);
  }

  get debtPulse(): Locator {
    return this.page.getByTestId(TEST_IDS.home.debtPulseWrap);
  }

  get smartInsightsCard(): Locator {
    return this.page.getByTestId(TEST_IDS.home.smartInsightsCard);
  }

  get upcomingBillsCard(): Locator {
    return this.page.getByTestId(TEST_IDS.home.upcomingBillsCard);
  }

  get periodNavLabel(): Locator {
    return this.page.getByTestId(TEST_IDS.home.periodNavLabel);
  }

  get budgetProgressCaption(): Locator {
    return this.page.getByTestId(TEST_IDS.home.budgetProgressCaption);
  }

  periodToggle(mode: "month" | "year"): Locator {
    return this.page.getByTestId(TEST_IDS.home.periodToggle(mode));
  }

  async dismissOverBudgetBanner(): Promise<void> {
    await this.overBudgetDismissButton.click();
  }

  async switchToYearMode(): Promise<void> {
    await this.periodToggle("year").click();
  }

  async switchToMonthMode(): Promise<void> {
    await this.periodToggle("month").click();
  }

  /** True when `locator` spans (approximately) the full width of `row` — i.e. it's alone in
   * the reflowing row — vs. roughly half when it's sharing the row with a sibling. A few px of
   * slack covers the row's own padding/border box rounding.
   *
   * Polls rather than taking one `boundingBox()` snapshot: Smart Insights' card can mount as
   * soon as the dashboard's own data resolves (via the pace-forecast insight) and then re-render
   * again moments later once the separate prev-month query resolves and adds the category-delta
   * insight — a real, brief window where a single unretried boundingBox() read can catch the
   * element mid-transition and see `null`. expect.poll retries until the layout settles instead
   * of failing on that first read. */
  async expectSpansFullRow(locator: Locator, row: Locator): Promise<void> {
    await expect.poll(async () => {
      const [itemBox, rowBox] = await Promise.all([locator.boundingBox(), row.boundingBox()]);
      if (!itemBox || !rowBox) return null;
      return itemBox.width / rowBox.width;
    }).toBeGreaterThan(0.9);
  }

  async expectSharesRow(locatorA: Locator, locatorB: Locator, row: Locator): Promise<void> {
    await expect.poll(async () => {
      const [boxA, boxB, rowBox] = await Promise.all([locatorA.boundingBox(), locatorB.boundingBox(), row.boundingBox()]);
      if (!boxA || !boxB || !rowBox) return null;
      return Math.max(boxA.width, boxB.width) / rowBox.width;
    }).toBeLessThan(0.65);
  }
}
