import {expect, test} from "../../fixtures";
import {provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {addVirtualAuthenticator} from "../../helpers/webauthn.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {SettingsPage} from "../../pages/SettingsPage";
import {HomePage} from "../../pages/HomePage";
import {AppLockScreen} from "../../pages/AppLockScreen";

// Its own file, its own single dedicated disposable user (see security.spec.ts's comment on why
// this used to live there and got moved) — keeping this file's total auth-endpoint traffic to
// exactly one provision + one password login + one passkey login (options+verify) is what makes
// it reliably stay under the 10 req/min limit; combined with another file's own auth traffic in
// the same ~30-60s window, it wasn't.
//
// Google OAuth also now gets a real round trip (see tests/oauth/google-oauth.spec.ts) — unlike
// WebAuthn, there's no CDP-level "virtual OAuth provider" Chromium exposes, so that suite takes a
// different path: a backend test double (TestGoogleIdentityService, e2e-oauth-test profile) mints
// and verifies ID tokens against a local key pair instead of Google's real certs, letting the real
// frontend GoogleSignInButton flow run end to end without a live Google account. WebAuthn's virtual
// authenticator remains the simpler, first-class Chromium feature for this file's own flow.
//
// Deliberately its own context pointed at TUNNEL_BASE_URL, not localhost like every other test in
// this suite: WebAuthn is origin-bound — the browser rejects
// navigator.credentials.create()/get() unless the server's advertised rpId is the current page's
// own domain (or a registrable suffix of it). This deployment's WebAuthnConfig derives rpId from
// FRONTEND_URL, which the root .env sets to the public https://wealthynest.in tunnel domain (not
// localhost:3000, which is only this suite's own BASE_URL default for browser navigation) —
// confirmed by inspecting WebAuthnConfig.getRpId() and the root .env directly, not guessed.
// Registering/logging in against localhost:3000 therefore fails with a SecurityError no matter how
// correctly a virtual authenticator is configured; it isn't a test bug. The `tunnel` service
// (docker-compose.yml) is already part of this suite's assumed `docker compose up -d` stack, so
// this isn't a materially new dependency — just the first test to actually need the tunnel to be
// live rather than only the local container ports.
test.describe.configure({ mode: "serial" });

test.describe("WebAuthn / Passkeys", () => {
  // Passkey has no full-login entry point anymore (see LoginPage.ts's own comment) — it's scoped
  // entirely to the app-lock screen's returning-device unlock, which the next test below covers.
  // This test is registration only.
  test("registers a passkey @regression", async ({ browser }) => {
    const TUNNEL_BASE_URL = "https://wealthynest.in";
    const user = await provisionE2EUser();
    const tunnelContext = await browser.newContext({ baseURL: TUNNEL_BASE_URL });
    const tunnelPage = await tunnelContext.newPage();

    try {
      const login = new LoginPage(tunnelPage);
      await login.loginWithPassword(user.email, user.password);
      await login.expectRedirectedToHome();

      await addVirtualAuthenticator(tunnelPage);
      const settings = new SettingsPage(tunnelPage);
      const nickname = `E2E Passkey ${Date.now()}`;

      await settings.gotoSecurity();
      await settings.addPasskey(nickname);
      await settings.expectPasskeyVisible(nickname);
    } finally {
      await api.closeAccount(user.auth.accessToken).catch(() => {});
      await tunnelContext.close();
    }
  });

  // Its own provisioned user/context rather than continuing the test above's — that test's user
  // and tunnelContext are local to its own function scope (a deliberate try/finally per-test
  // pattern, not a shared beforeAll), and restructuring it to share state risked the very
  // rate-limit tuning this file's own comment above describes fixing. Self-contained costs a
  // second provision + password login, but zero of the passkey *registration* traffic
  // (POST /users/me/webauthn/register/*) counts against the tight 10/min /auth/ bucket the file
  // comment is protecting — only the app-lock unlock's own options+verify calls do, same as the
  // pair the first test already spends on its own passkey login.
  test("the app-lock screen's passkey unlock works @regression", async ({ browser }) => {
    // useAppLockTrigger's BACKGROUND_GRACE_MS is 90s, so this test needs a real wait past that —
    // well over Playwright's own 30s default test timeout, hence test.slow() (triples it).
    test.slow();
    const TUNNEL_BASE_URL = "https://wealthynest.in";
    const user = await provisionE2EUser();
    const tunnelContext = await browser.newContext({ baseURL: TUNNEL_BASE_URL });
    const tunnelPage = await tunnelContext.newPage();

    try {
      const login = new LoginPage(tunnelPage);
      await login.loginWithPassword(user.email, user.password);
      await login.expectRedirectedToHome();

      await addVirtualAuthenticator(tunnelPage);
      const settings = new SettingsPage(tunnelPage);
      await settings.gotoSecurity();
      await settings.addPasskey(`E2E App-Lock Passkey ${Date.now()}`);

      const home = new HomePage(tunnelPage);
      const appLock = new AppLockScreen(tunnelPage);
      // gotoHome() is a real page.goto() (hard navigation), which remounts DashboardLayout fresh —
      // useAppLockTrigger's own usePasskeys() call has to refetch from scratch, and it's what
      // decides whether the trigger arms at all. Proceeding straight to goBackground() without
      // giving that fetch time to land is exactly what used to make this test flaky: backgrounding
      // could fire while the app still thought this account had zero passkeys and never armed.
      await home.gotoHome();
      await home.expectLoaded();
      // Tracking the specific GET /webauthn/passkeys response across this navigation proved
      // fragile in practice (Playwright's response tracking doesn't reliably survive a hard
      // page.goto() boundary — confirmed by hitting "No resource with given identifier found"
      // while trying to read one). A short settle wait after the fresh page has already rendered
      // is simpler and just as effective: useAppLockTrigger's own usePasskeys() call fires on
      // mount and this is comfortably more than a same-region GET needs to complete.
      await tunnelPage.waitForTimeout(2000);

      await appLock.goBackground();
      await tunnelPage.waitForTimeout(91_000); // > useAppLockTrigger's 90s BACKGROUND_GRACE_MS
      await appLock.goForeground();
      await appLock.expectVisible();

      await appLock.fingerprintButton.click();
      await appLock.expectNotVisible();
      await expect(tunnelPage).toHaveURL(/\/home$/); // stayed put — no login-flow redirect fired
    } finally {
      await api.closeAccount(user.auth.accessToken).catch(() => {});
      await tunnelContext.close();
    }
  });
});
