import {expect, test} from "../../fixtures";

test.describe("Auth — Login", () => {
  // No "Welcome back" toast on login — landing on /home (which greets you by name in its own
  // GreetingBanner) is already the confirmation; see useAuth.ts's useLogin comment.
  test("logs in with valid email + password and lands on home @smoke", async ({ loginPage, homePage, e2eUser }) => {
    await loginPage.loginWithPassword(e2eUser.email, e2eUser.password);
    await homePage.expectLoaded();
  });

  test("Google sign-in button renders when a client ID is configured", async ({ page, loginPage }) => {
    await loginPage.goto();
    // A real custom button now (see GoogleSignInButton.tsx) — no GIS-rendered iframe to wait on,
    // just our own element mounting once the GIS script itself has been requested. The full round
    // trip is covered separately in tests/oauth/google-oauth.spec.ts, which mocks the GIS script
    // itself and drives the real callback against a backend test double, since doing that here
    // would need the same e2e-oauth-test API profile this file's default run doesn't have active.
    const googleScript = page.waitForResponse((res) => res.url().includes("accounts.google.com/gsi/client"), { timeout: 5000 }).catch(() => null);
    await googleScript;
    await expect(loginPage.googleButton).toBeVisible();
  });

  test("the combined email+password step shows the password field, and back returns to the choose-method screen", async ({ loginPage, e2eUser }) => {
    await loginPage.goto();
    await loginPage.continueWithEmail();
    await loginPage.passwordStepEmailInput.fill(e2eUser.email);
    await expect(loginPage.passwordStepPasswordInput).toBeVisible();
    await loginPage.backButton.click();
    await expect(loginPage.continueWithEmailButton).toBeVisible();
  });
});
