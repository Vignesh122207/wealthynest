import {expect, test} from "../../fixtures";
import {ROUTES} from "../../constants/routes";
import {waitForApiResponse} from "../../helpers/wait.helper";

test.describe("Auth — Session handling", () => {
  test("visiting a protected route while logged out redirects to /login @smoke", async ({ page }) => {
    // Deliberately the plain `page` fixture (no storageState) — a genuinely unauthenticated
    // context, exercising DashboardLayout's client-side guard (app/(dashboard)/layout.tsx).
    await page.goto(ROUTES.home);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
  });

  test("a corrupted access token forces a redirect back to /login on the next API call", async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.localStorage.setItem(
        "wealthynest-auth",
        JSON.stringify({
          state: {
            user: { id: "00000000-0000-0000-0000-000000000000", fullName: "Ghost", email: "ghost@example.com", role: "MEMBER", active: true, pinEnabled: false },
            accessToken: "not-a-real-jwt",
            isAuthenticated: true,
          },
          version: 0,
        })
      );
    });
    const page = await context.newPage();
    await page.goto(ROUTES.home);
    // DashboardLayout's getMe() call 401s immediately; axios.ts's interceptor tries /auth/refresh —
    // this fresh context has no wn_refresh_token cookie at all, so that fails too, and it
    // force-logs-out to /login.
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`), { timeout: 15000 });
    await context.close();
  });

  // No "remember me" checkbox — see LoginForm.tsx/useLogin's own comments for why: the
  // PIN/fingerprint/passkey lock screen is what actually gates a returning device, the same
  // pattern real banking apps use, so every login always requests the long-lived session.
  test("every login sends rememberMe: true to the login API, with no user choice involved", async ({ page, loginPage, e2eUser }) => {
    await loginPage.goto();
    await loginPage.continueWithEmail();
    await loginPage.passwordStepEmailInput.fill(e2eUser.email);
    await loginPage.passwordStepPasswordInput.fill(e2eUser.password);

    const [response] = await Promise.all([
      waitForApiResponse(page, "/auth/login", "POST"),
      loginPage.passwordSubmitButton.click(),
    ]);
    const body = response.request().postDataJSON();
    expect(body.rememberMe).toBe(true);
  });
});
