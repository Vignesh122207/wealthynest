import {expect, test} from "../../fixtures";
import {faker} from "@faker-js/faker";

// Serial — see debts.spec.ts's comment. Security coverage here is deliberately limited to the
// client-side validation path (mismatched confirm password) — a real password-change mutation
// would break every other regression file's ability to log in as the shared regressionUser for
// the rest of the run. See README's "Known gaps" for the full reasoning; a real change+revert
// round trip would need a dedicated throwaway user to be worth the risk.
test.describe.configure({ mode: "serial" });

test.describe("Settings", () => {
  test("updates the profile display name @regression", async ({ settingsPage }) => {
    const newName = faker.person.fullName();
    await settingsPage.gotoProfile();
    await settingsPage.updateFullName(newName);
    await settingsPage.expectTextVisible(newName);
  });

  test("password change is blocked client-side when confirmation doesn't match @regression", async ({ settingsPage }) => {
    await settingsPage.gotoSecurity();
    await settingsPage.attemptPasswordChangeWithMismatch("whatever-current", "NewPassword123", "DoesNotMatch123");
    await settingsPage.expectTextVisible("Passwords do not match");
  });

  test("appearance: theme and currency selection persists visually @regression", async ({ settingsPage }) => {
    await settingsPage.gotoAppearance();
    await settingsPage.selectTheme("dark");
    await settingsPage.expectThemeSelected("dark");
    await settingsPage.expectHtmlThemeClass("dark");
    await settingsPage.selectTheme("light");
    await settingsPage.expectThemeSelected("light");
    await settingsPage.expectHtmlThemeClass("light");

    await settingsPage.selectCurrency("USD");
    await settingsPage.expectCurrencySelected("USD");
    await settingsPage.selectCurrency("INR");
    await settingsPage.expectCurrencySelected("INR");
  });

  test("notification preferences: toggling one off then back on @regression", async ({ settingsPage }) => {
    await settingsPage.gotoNotificationPrefs();
    await expect(settingsPage.notifToggle("budgets")).toHaveAttribute("aria-checked", "true");

    await settingsPage.toggleNotifPref("budgets");
    await expect(settingsPage.notifToggle("budgets")).toHaveAttribute("aria-checked", "false");

    await settingsPage.toggleNotifPref("budgets");
    await expect(settingsPage.notifToggle("budgets")).toHaveAttribute("aria-checked", "true");
  });
});
