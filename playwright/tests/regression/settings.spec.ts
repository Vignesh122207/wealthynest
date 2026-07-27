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

  // Sign out / Close account moved from Settings home to Profile (next to the identity they
  // affect) — this only exercises the client-side dialog behavior, never the real destructive
  // mutations, since both would break every other regression file's ability to log in/act as
  // the shared regressionUser for the rest of the run (same reasoning as the password-change
  // test above).
  test("profile: danger zone opens sign-out and close-account confirm dialogs @regression", async ({ settingsPage }) => {
    await settingsPage.gotoProfile();
    await settingsPage.expectTextVisible("Danger Zone");

    await settingsPage.openSignOutDialog();
    await settingsPage.expectTextVisible("Sign out?");
    await settingsPage.cancelConfirmDialog();

    await settingsPage.openCloseAccountDialog();
    await settingsPage.expectTextVisible("Close your account?");
    // Type-to-confirm gate — the button stays disabled until "CLOSE" is typed exactly.
    await expect(settingsPage.confirmDialogConfirmButton).toBeDisabled();
    await settingsPage.cancelConfirmDialog();
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
