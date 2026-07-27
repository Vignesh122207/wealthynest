import {expect} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";

export class HomePage extends BasePage {
  async gotoHome(): Promise<void> {
    await this.goto(ROUTES.home);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${ROUTES.home}$`));
    await this.expectHeaderTitle("Home");
  }
}
