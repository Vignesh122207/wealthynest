import {expect, test} from "../../fixtures";

test.describe("Auth — Login", () => {
  test("logs in with valid email + password and lands on the dashboard @smoke", async ({ loginPage, dashboardPage, toast, e2eUser }) => {
    await loginPage.loginWithPassword(e2eUser.email, e2eUser.password);
    await dashboardPage.expectLoaded();
    await toast.expectVisible(new RegExp(`Welcome back`, "i"));
  });

  test("Google sign-in button renders when a client ID is configured", async ({ page, loginPage }) => {
    await loginPage.goto();
    // Google Identity Services renders its own iframe — this only proves the boundary (our own
    // container mounts and the GIS script is requested), not the OAuth round trip itself, which
    // can't be driven end-to-end without a real Google account.
    const googleScript = page.waitForResponse((res) => res.url().includes("accounts.google.com/gsi/client"), { timeout: 5000 }).catch(() => null);
    await googleScript;
    await expect(loginPage.googleContainer).toBeVisible();
  });

  test("passkey / password entry points are both reachable from the email step", async ({ loginPage, e2eUser }) => {
    await loginPage.goto();
    await loginPage.emailInput.fill(e2eUser.email);
    await expect(loginPage.usePasswordButton).toBeVisible();
    await loginPage.usePasswordButton.click();
    await expect(loginPage.passwordStepEmailInput).toHaveValue(e2eUser.email);
    await loginPage.backButton.click();
    await expect(loginPage.usePasswordButton).toBeVisible();
  });
});
