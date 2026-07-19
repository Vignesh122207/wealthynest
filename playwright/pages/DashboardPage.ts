import {expect} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";

export class DashboardPage extends BasePage {
  async gotoDashboard(): Promise<void> {
    await this.goto(ROUTES.dashboard);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${ROUTES.dashboard}$`));
    await this.expectHeaderTitle("Home");
  }
}
