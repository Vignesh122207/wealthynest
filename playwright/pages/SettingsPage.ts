import {expect} from "@playwright/test";
import {BasePage} from "./BasePage";
import {waitForApiResponse} from "../helpers/wait.helper";

/** Models the smaller wealthynest-web /settings/* subpages — Profile, Security (validation path
 * only; see README for why a real password-change mutation isn't exercised against the shared
 * regressionUser), Appearance, and Notification preferences. Each is simple enough on its own
 * that a dedicated page-object file per route would be mostly boilerplate — bundled here instead,
 * one `goto*` per route. */
export class SettingsPage extends BasePage {
  async gotoProfile(): Promise<void> {
    await this.goto("/settings/profile");
  }

  async gotoSecurity(): Promise<void> {
    await this.goto("/settings/security");
  }

  async gotoAppearance(): Promise<void> {
    await this.goto("/settings/appearance");
  }

  async gotoNotificationPrefs(): Promise<void> {
    await this.goto("/settings/notifications");
  }

  // ── Profile ─────────────────────────────────────────────────────────────
  async updateFullName(name: string): Promise<void> {
    await this.page.getByTestId("profile-fullname-input").fill(name);
    await Promise.all([
      waitForApiResponse(this.page, /\/users\/me$/, "PATCH"),
      this.page.getByTestId("profile-form-submit").click(),
    ]);
  }

  // ── Security ────────────────────────────────────────────────────────────
  async attemptPasswordChangeWithMismatch(current: string, newPassword: string, confirmPassword: string): Promise<void> {
    await this.page.getByTestId("security-current-password-input").fill(current);
    await this.page.getByTestId("security-new-password-input").fill(newPassword);
    await this.page.getByTestId("security-confirm-password-input").fill(confirmPassword);
    await this.page.getByTestId("security-password-submit").click();
  }

  /** A real password-change round trip — only ever call this against a dedicated throwaway user
   * (see security.spec.ts), never regressionUser/e2eUser: it changes the credential every other
   * regression file relies on being able to log in with. */
  async changePassword(current: string, newPassword: string): Promise<void> {
    await this.page.getByTestId("security-current-password-input").fill(current);
    await this.page.getByTestId("security-new-password-input").fill(newPassword);
    await this.page.getByTestId("security-confirm-password-input").fill(newPassword);
    await Promise.all([
      waitForApiResponse(this.page, "/users/me/change-password", "POST"),
      this.page.getByTestId("security-password-submit").click(),
    ]);
  }

  /** Registers a real passkey via `navigator.credentials.create()` — only resolves without
   * hanging on a real device prompt if a CDP virtual authenticator has already been attached to
   * this page (see helpers/webauthn.helper.ts's addVirtualAuthenticator, called by the test
   * before this). */
  async addPasskey(nickname: string): Promise<void> {
    await this.page.getByTestId("security-passkey-add-toggle").click();
    await this.page.getByTestId("security-passkey-nickname-input").fill(nickname);
    await Promise.all([
      waitForApiResponse(this.page, "/users/me/webauthn/register/verify", "POST"),
      this.page.getByTestId("security-passkey-submit").click(),
    ]);
  }

  async expectPasskeyVisible(nickname: string): Promise<void> {
    await expect(this.page.getByText(nickname, { exact: true })).toBeVisible();
  }

  // ── Appearance ──────────────────────────────────────────────────────────
  async selectTheme(id: "light" | "dark" | "system"): Promise<void> {
    await this.page.getByTestId(`theme-option-${id}`).click();
  }

  async expectThemeSelected(id: "light" | "dark" | "system"): Promise<void> {
    await expect(this.page.getByTestId(`theme-option-${id}`)).toHaveClass(/border-indigo-500/);
  }

  async selectCurrency(code: string): Promise<void> {
    await this.page.getByTestId(`currency-option-${code}`).click();
  }

  async expectCurrencySelected(code: string): Promise<void> {
    await expect(this.page.getByTestId(`currency-option-${code}`)).toHaveClass(/bg-indigo-500\/5/);
  }

  // ── Notification preferences ───────────────────────────────────────────
  notifToggle(key: "all" | "budgets" | "income" | "goals" | "maturity") {
    return this.page.getByTestId(`notif-pref-${key}`);
  }

  async toggleNotifPref(key: "budgets" | "income" | "goals" | "maturity"): Promise<void> {
    await this.notifToggle(key).click();
  }

  // ── Shared assertions ───────────────────────────────────────────────────
  async expectTextVisible(text: string): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }
}
