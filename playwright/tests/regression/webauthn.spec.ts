import {expect, test} from "../../fixtures";
import {provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {addVirtualAuthenticator} from "../../helpers/webauthn.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {SettingsPage} from "../../pages/SettingsPage";

// Its own file, its own single dedicated disposable user (see security.spec.ts's comment on why
// this used to live there and got moved) — keeping this file's total auth-endpoint traffic to
// exactly one provision + one password login + one passkey login (options+verify) is what makes
// it reliably stay under the 10 req/min limit; combined with another file's own auth traffic in
// the same ~30-60s window, it wasn't.
//
// Google OAuth's full round trip stays boundary-only (button renders, correct request fires) —
// unlike WebAuthn, there's no CDP-level "virtual OAuth provider" Chromium exposes; a real round
// trip would need either a live test Google account (flaky, account-management overhead, and
// arguably out of scope for a local E2E suite) or backend test doubles for Google's token
// endpoint, which is a bigger infra project than this pass. WebAuthn's virtual authenticator is a
// first-class, purpose-built Chromium testing feature, which is exactly why this one — and not
// OAuth — gets real coverage here.
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
  test("registers a passkey and signs back in with it @regression", async ({ browser }) => {
    const TUNNEL_BASE_URL = "https://wealthynest.in";
    const user = await provisionE2EUser();
    const tunnelContext = await browser.newContext({ baseURL: TUNNEL_BASE_URL });
    const tunnelPage = await tunnelContext.newPage();

    try {
      const login = new LoginPage(tunnelPage);
      await login.loginWithPassword(user.email, user.password);
      await login.expectRedirectedToDashboard();

      await addVirtualAuthenticator(tunnelPage);
      const settings = new SettingsPage(tunnelPage);
      const nickname = `E2E Passkey ${Date.now()}`;

      await settings.gotoSecurity();
      await settings.addPasskey(nickname);
      await settings.expectPasskeyVisible(nickname);

      await settings.logout();
      await expect(tunnelPage).toHaveURL(/\/login$/);

      await login.loginWithPasskey(user.email);
      await login.expectRedirectedToDashboard();
    } finally {
      await api.closeAccount(user.auth.accessToken).catch(() => {});
      await tunnelContext.close();
    }
  });
});
