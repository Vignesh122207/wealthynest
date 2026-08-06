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

  get smartAlertsRow(): Locator {
    return this.page.getByTestId(TEST_IDS.home.smartAlertsRow);
  }

  /** One element per insight — the rail renders an individual bordered card per insight now,
   * not one shared "Smart Insights" box. Use `.first()`/`.count()` accordingly. */
  get smartInsightCards(): Locator {
    return this.page.getByTestId(TEST_IDS.home.smartInsightCard);
  }

  /** Same shape as smartInsightCards, one per upcoming bill. */
  get smartBillCards(): Locator {
    return this.page.getByTestId(TEST_IDS.home.smartBillCard);
  }

  get periodNavLabel(): Locator {
    return this.page.getByTestId(TEST_IDS.home.periodNavLabel);
  }

  get budgetProgressCaption(): Locator {
    return this.page.getByTestId(TEST_IDS.home.budgetProgressCaption);
  }

  get budgetSection(): Locator {
    return this.page.getByTestId(TEST_IDS.home.budgetSection);
  }

  periodToggle(mode: "month" | "year"): Locator {
    return this.page.getByTestId(TEST_IDS.home.periodToggle(mode));
  }

  async switchToYearMode(): Promise<void> {
    await this.periodToggle("year").click();
  }

  async switchToMonthMode(): Promise<void> {
    await this.periodToggle("month").click();
  }
}
