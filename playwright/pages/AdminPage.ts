import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {waitForApiResponse} from "../helpers/wait.helper";

/** Models wealthynest-web's /admin route — ADMIN-role-gated (see admin/page.tsx's redirect
 * effect for anyone else). Deep mutation coverage here is intentionally limited to a dedicated,
 * disposable test user (never the shared regressionUser/e2eUser) — see admin.spec.ts and the
 * README for why. */
export class AdminPage extends BasePage {
  async gotoAdmin(): Promise<void> {
    await this.goto(ROUTES.admin);
  }

  async selectTab(id: "overview" | "users" | "tickets" | "audit" | "jobs"): Promise<void> {
    await this.page.getByTestId(`admin-tab-${id}`).click();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.headerTitle).toHaveText("Admin");
  }

  // ── Users tab ───────────────────────────────────────────────────────────
  async searchUsers(query: string): Promise<void> {
    await this.page.getByTestId("admin-users-search").fill(query);
  }

  userRow(emailOrName: string): Locator {
    return this.page.getByTestId("admin-user-row").filter({ hasText: emailOrName });
  }

  async toggleUserActive(emailOrName: string): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, /\/admin\/users\/[^/]+\/toggle-active$/, "PATCH"),
      this.userRow(emailOrName).getByRole("button", { name: /^(Deactivate|Activate)$/ }).click(),
    ]);
  }

  async expectUserActive(emailOrName: string, active: boolean): Promise<void> {
    await expect(this.userRow(emailOrName).getByText(active ? "Active" : "Inactive", { exact: true })).toBeVisible();
  }
}
