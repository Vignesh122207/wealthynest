import {expect, test} from "../../fixtures";
import {env} from "../../config/env";
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
// Deliberately its own context pointed at env.webauthnOriginUrl, not this suite's usual BASE_URL:
// WebAuthn is origin-bound — the browser rejects navigator.credentials.create()/get() unless the
// server's advertised rpId is the current page's own domain (or a registrable suffix of it). The
// backend's WebAuthnConfig.getRpId() derives rpId from FRONTEND_URL (falling back to
// http://localhost:3000, same as env.webauthnOriginUrl's own fallback) — an EARLIER version of
// this comment claimed the root .env always sets that to the public https://wealthynest.in tunnel
// domain, which is stale: the actual current root .env value (verified directly, not assumed) is
// plain http://localhost:3000, same as CI's e2e-nightly.yml override, and BASE_URL was already
// http://localhost:3000 too — so this test was silently navigating to the real public production
// site (https://wealthynest.in has real DNS, real Cloudflare, real prod), registering a passkey
// there against a user that only exists in *this run's* local/CI database, and then failing to log
// back in with it. Reading env.webauthnOriginUrl instead of a hardcoded domain means this always
// matches whatever the backend's own rpId actually resolves to, in any environment — including the
// rarer case where a developer's root .env genuinely does point FRONTEND_URL at a live tunnel.
test.describe.configure({ mode: "serial" });

test.describe("WebAuthn / Passkeys", () => {
  // Passkey has no full-login entry point anymore (see LoginPage.ts's own comment) — it's scoped
  // entirely to the app-lock screen's returning-device unlock, which the next test below covers.
  // This test is registration only.
  test("registers a passkey @regression", async ({ browser }) => {
    const user = await provisionE2EUser();
    const webauthnContext = await browser.newContext({ baseURL: env.webauthnOriginUrl });
    const webauthnPage = await webauthnContext.newPage();

    try {
      const login = new LoginPage(webauthnPage);
      await login.loginWithPassword(user.email, user.password);
      await login.expectRedirectedToHome();

      await addVirtualAuthenticator(webauthnPage);
      const settings = new SettingsPage(webauthnPage);
      const nickname = `E2E Passkey ${Date.now()}`;

      await settings.gotoSecurity();
      await settings.addPasskey(nickname);
      await settings.expectPasskeyVisible(nickname);
    } finally {
      await api.closeAccount(user.auth.accessToken).catch(() => {});
      await webauthnContext.close();
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
    // useAppLockTrigger's BACKGROUND_GRACE_MS is 90s, so this test needs a real 91s wait past
    // that — test.slow()'s 3x multiplier applies to whatever the base per-test timeout happens to
    // be configured as (30s locally, or CI's own value), and 30s*3=90000ms is *less* than the 91s
    // wait alone, before any of this test's other steps (login, passkey registration, navigation)
    // — mathematically guaranteed to time out regardless of environment or speed. This went
    // unnoticed because tests/describe.configure({mode:"serial"}) above skips every test after the
    // first failure in the file, and the first test here had its own separate bug (see the file's
    // top comment) that always failed first. Explicit fixed timeout instead of a multiplier of an
    // ambient config value neither this test nor its 91s requirement actually depends on.
    test.setTimeout(150_000);
    const user = await provisionE2EUser();
    const webauthnContext = await browser.newContext({ baseURL: env.webauthnOriginUrl });
    const webauthnPage = await webauthnContext.newPage();

    try {
      const login = new LoginPage(webauthnPage);
      await login.loginWithPassword(user.email, user.password);
      await login.expectRedirectedToHome();

      await addVirtualAuthenticator(webauthnPage);
      const settings = new SettingsPage(webauthnPage);
      await settings.gotoSecurity();
      await settings.addPasskey(`E2E App-Lock Passkey ${Date.now()}`);

      const home = new HomePage(webauthnPage);
      const appLock = new AppLockScreen(webauthnPage);
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
      await webauthnPage.waitForTimeout(2000);

      await appLock.goBackground();
      await webauthnPage.waitForTimeout(91_000); // > useAppLockTrigger's 90s BACKGROUND_GRACE_MS
      await appLock.goForeground();
      await appLock.expectVisible();

      await appLock.fingerprintButton.click();
      await appLock.expectNotVisible();
      await expect(webauthnPage).toHaveURL(/\/home$/); // stayed put — no login-flow redirect fired
    } finally {
      await api.closeAccount(user.auth.accessToken).catch(() => {});
      await webauthnContext.close();
    }
  });
});
