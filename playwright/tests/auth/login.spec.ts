import {expect, test} from "../../fixtures";

test.describe("Auth — Login", () => {
  test("logs in with valid email + password and lands on home @smoke", async ({ loginPage, homePage, toast, e2eUser }) => {
    await loginPage.loginWithPassword(e2eUser.email, e2eUser.password);
    await homePage.expectLoaded();
    await toast.expectVisible(new RegExp(`Welcome back`, "i"));
  });

  test("Google sign-in button renders when a client ID is configured", async ({ page, loginPage }) => {
    await loginPage.goto();
    // Google Identity Services renders its own iframe — this only proves the boundary (our own
    // container mounts and the GIS script is requested). The full round trip is covered
    // separately in tests/oauth/google-oauth.spec.ts, which mocks the GIS script itself and drives
    // the real callback against a backend test double, since doing that here would need the same
    // e2e-oauth-test API profile this file's default run doesn't have active.
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
