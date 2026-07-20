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
            refreshToken: "not-a-real-refresh-token",
            isAuthenticated: true,
          },
          version: 0,
        })
      );
    });
    const page = await context.newPage();
    await page.goto(ROUTES.home);
    // DashboardLayout's getMe() call 401s immediately; axios.ts's interceptor tries /auth/refresh
    // with the (also fake) refresh token, that fails too, and it force-logs-out to /login.
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`), { timeout: 15000 });
    await context.close();
  });

  test("remember-me sends rememberMe: true to the login API", async ({ page, loginPage, e2eUser }) => {
    await loginPage.goto();
    await loginPage.emailInput.fill(e2eUser.email);
    await loginPage.rememberMeCheckbox.check();
    await loginPage.usePasswordButton.click();
    await loginPage.passwordStepPasswordInput.fill(e2eUser.password);

    const [response] = await Promise.all([
      waitForApiResponse(page, "/auth/login", "POST"),
      loginPage.passwordSubmitButton.click(),
    ]);
    const body = response.request().postDataJSON();
    expect(body.rememberMe).toBe(true);
  });
});
