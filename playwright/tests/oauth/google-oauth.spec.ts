import {expect, test} from "../../fixtures";
import {api} from "../../helpers/api.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {HomePage} from "../../pages/HomePage";
import type {BrowserContext, Page} from "@playwright/test";

// A real Google Sign-In round trip, closing the one gap webauthn.spec.ts's own comment used to
// name as out of scope ("no CDP-level virtual OAuth provider the way WebAuthn has one"). Rather
// than a live test Google account (flaky, real-account overhead, subject to Google's own
// bot-detection) or leaving this boundary-only forever, the backend now exposes a narrow,
// profile-gated test double: TestGoogleIdentityService (Java) mints/verifies ID tokens against an
// in-memory RSA key pair instead of Google's real certs, active ONLY when the API runs with the
// `e2e-oauth-test` Spring profile — see AuthServiceImpl/GoogleAuthConfig/GoogleIdTokenValidator
// for the production-path refactor this needed (extracted the previously-inline
// GoogleIdTokenVerifier construction into an injectable bean so the test bean could swap in
// cleanly, with the real Google-backed verifier remaining the unconditional default everywhere
// else). This file drives the REAL frontend code path end to end — GoogleSignInButton's
// initialize/callback wiring, the real POST /auth/google-login request, the real backend
// verification (against the test key, not a stub bypassing verification) — with only Google's own
// third-party gsi/client script replaced by a minimal stand-in, the same "mock the network
// boundary, keep everything else real" approach investments.spec.ts already uses for NSE/BSE
// LiveSearch (see Phase 18).
//
// REQUIRES an opt-in restart: `APP_ENV=prod,e2e-oauth-test docker compose up -d --build
// wealthynest-api` before running this file, then restore the default (`APP_ENV=prod` or just
// unset) afterward for every other suite. The skip-guard below makes running this file without
// that restart a clean skip, not a confusing failure — same shape as responsive.spec.ts's
// project-name skip-guard, just gated on API reachability instead of a Playwright project.
test.describe.configure({ mode: "serial" });

// GoogleSignInButton.tsx renders its own real, fully-custom button now (see that file's own
// comment for why — GIS's rendered iframe button couldn't be made to match this app's other
// buttons) and calls google.accounts.id.prompt() on click instead of relying on a GIS-rendered
// widget to receive the real click. The mock only needs to stand in for initialize()/prompt(),
// not renderButton() — the button under test is our own real element
// (data-testid="google-signin-web-button"), not an injected stand-in.
const MOCK_GIS_SCRIPT = `
window.google = {
  accounts: {
    id: {
      initialize(config) { window.__wnGoogleCallback = config.callback; },
      prompt(momentListener) {
        if (window.__wnGoogleCallback && window.__wnTestIdToken) {
          window.__wnGoogleCallback({ credential: window.__wnTestIdToken });
        }
        if (momentListener) {
          momentListener({
            isNotDisplayed: function () { return false; },
            isSkippedMoment: function () { return false; },
            isDismissedMoment: function () { return true; },
          });
        }
      },
    },
  },
};
`;

test.describe("Google OAuth (real round trip via backend test double)", () => {
  let context: BrowserContext;
  let page: Page;
  let cleanupAccessToken: string | undefined;

  test.beforeEach(async () => {
    cleanupAccessToken = undefined;
    const active = await api.isOAuthTestModeActive();
    test.skip(!active, "API isn't running with the e2e-oauth-test profile — see this file's own comment for the required restart");
  });

  test.afterEach(async () => {
    if (cleanupAccessToken) await api.closeAccount(cleanupAccessToken).catch(() => {});
    await context?.close();
  });

  test("a first-time Google sign-in creates a real account and lands on the dashboard @oauth", async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.route("https://accounts.google.com/gsi/client", (route) =>
      route.fulfill({ contentType: "application/javascript", body: MOCK_GIS_SCRIPT })
    );

    const email = `google-oauth-${Date.now()}-${Math.floor(Math.random() * 10000)}@wealthynest.test`;
    const idToken = await api.issueTestGoogleIdToken({ email, name: "Google Test User" });

    const login = new LoginPage(page);
    await login.goto();
    await expect(login.googleButton).toBeVisible();
    await page.evaluate((token) => { (window as unknown as { __wnTestIdToken: string }).__wnTestIdToken = token; }, idToken);
    await login.googleButton.click();

    await login.expectRedirectedToHome();
    await new HomePage(page).expectLoaded();

    // Re-mint a fresh token for the same email to fetch a cleanup accessToken directly via the API
    // (an ID token backs a single sign-in event conceptually; minting a new one for teardown is
    // cleaner than reaching into localStorage for the token the UI flow already has) — this also
    // exercises the "existing Google-linked user signs in again" path the backend's own
    // AuthServiceImpl.googleLogin comment describes (find-or-create by email).
    const second = await api.googleLogin(await api.issueTestGoogleIdToken({ email }));
    cleanupAccessToken = second.accessToken;
    expect(second.user.email).toBe(email);
  });

  test("an invalid (garbage) ID token is rejected, not silently signed in @oauth", async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.route("https://accounts.google.com/gsi/client", (route) =>
      route.fulfill({ contentType: "application/javascript", body: MOCK_GIS_SCRIPT })
    );

    const login = new LoginPage(page);
    await login.goto();
    await expect(login.googleButton).toBeVisible();
    await page.evaluate(() => { (window as unknown as { __wnTestIdToken: string }).__wnTestIdToken = "not-a-real-jwt"; });
    await login.googleButton.click();

    await login.expectStillOnLogin();
  });
});
