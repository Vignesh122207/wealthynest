import {expect, test} from "../../fixtures";
import {provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {SettingsPage} from "../../pages/SettingsPage";
import type {BrowserContext, Page} from "@playwright/test";

// A real password-change round trip needs its own dedicated, disposable user — regressionUser is
// shared by every other file in tests/regression/, and changing its password mid-run would break
// every other file's ability to log in for the rest of the pass. See admin.spec.ts's own comment
// for the same "don't touch the shared user, build your own context" pattern. Serial for the same
// reason as debts.spec.ts (though this file doesn't touch regressionUser at all).
//
// The WebAuthn/passkey round trip used to live here too (same "dedicated disposable user"
// rationale), but pairing it with this file's own auth traffic (one provision + three logins)
// reliably tipped the combined file over the /auth endpoint's 10 req/min limit. Moved to its own
// file (webauthn.spec.ts) with its own single dedicated user instead — see that file's comment.
test.describe.configure({ mode: "serial" });

test.describe("Security — password change", () => {
  let context: BrowserContext;
  let page: Page;
  let email: string;
  let originalPassword: string;
  let currentAccessToken: string;

  test.beforeAll(async ({ browser }) => {
    const user = await provisionE2EUser();
    email = user.email;
    originalPassword = user.password;
    currentAccessToken = user.auth.accessToken;

    context = await browser.newContext();
    page = await context.newPage();
    const login = new LoginPage(page);
    await login.loginWithPassword(email, originalPassword);
    await login.expectRedirectedToDashboard();
  });

  test.afterAll(async () => {
    await api.closeAccount(currentAccessToken).catch(() => {});
    await context.close();
  });

  test("changing the password lets you sign back in with the new one @regression", async () => {
    const settings = new SettingsPage(page);
    const newPassword = "NewE2ePassword456!";

    await settings.gotoSecurity();
    await settings.changePassword(originalPassword, newPassword);
    await settings.expectTextVisible("Password updated successfully!");

    await settings.logout();
    await expect(page).toHaveURL(/\/login$/);

    const login = new LoginPage(page);
    await login.loginWithPassword(email, newPassword);
    await login.expectRedirectedToDashboard();

    // Re-login to get a token minted after the change — the old accessToken predates it and
    // markAdmin's own comment documents the same "role/credential baked in at issuance" gotcha.
    currentAccessToken = (await api.login({ email, password: newPassword })).accessToken;
  });
});
