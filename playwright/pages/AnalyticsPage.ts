import {expect} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";

/** Models wealthynest-web's /analytics route — entirely read-only (charts + a month navigator),
 * derived from expense/income/investment data created elsewhere. No forms, no mutations. */
export class AnalyticsPage extends BasePage {
  async gotoAnalytics(): Promise<void> {
    await this.goto(ROUTES.analytics);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.headerTitle).toHaveText("Analytics");
  }

  get monthLabel() {
    return this.page.getByTestId(TEST_IDS.analytics.monthLabel);
  }

  async goToPrevMonth(): Promise<void> {
    await this.page.getByTestId(TEST_IDS.analytics.monthPrev).click();
  }

  async goToNextMonth(): Promise<void> {
    await this.page.getByTestId(TEST_IDS.analytics.monthNext).click();
  }

  async expectNextMonthDisabled(): Promise<void> {
    await expect(this.page.getByTestId(TEST_IDS.analytics.monthNext)).toBeDisabled();
  }
}
