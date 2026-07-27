import {expect} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";

/** Models wealthynest-web's /notifications inbox — merges server-persisted notifications with
 * client-derived ones (budget/goal/low-balance/etc, computed from other modules' data). No
 * create/edit flow of its own; only filtering and mark-all-read/dismiss actions. */
export class NotificationsPage extends BasePage {
  async gotoNotifications(): Promise<void> {
    await this.goto(ROUTES.notifications);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.headerTitle).toHaveText("Notifications");
  }

  // TabBar renders each filter as role="tab" (not the default implicit "button" role), with
  // selection state on aria-selected rather than a color class — the active tab's fill lives on
  // a separate sliding indicator element behind the button, not a class on the button itself.
  filterButton(label: string) {
    return this.page.getByRole("tab", { name: label, exact: true });
  }

  async selectFilter(label: string): Promise<void> {
    await this.filterButton(label).click();
  }

  async expectFilterActive(label: string): Promise<void> {
    await expect(this.filterButton(label)).toHaveAttribute("aria-selected", "true");
  }
}
