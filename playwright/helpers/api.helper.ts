import axios, {type AxiosInstance} from "axios";
import {env} from "../config/env";

// Thin direct-to-API client for test setup/teardown (provisioning the E2E user, seeding a
// category the Expense/Budget forms need to have any option to pick) — deliberately bypasses the
// UI for things that aren't what a given test is actually verifying. Mirrors the shapes in
// wealthynest-web/src/features/*/api/*.api.ts and features/auth/types/auth.types.ts.

// No refreshToken field — it travels only as an httpOnly Set-Cookie header (RefreshCookieService
// on the backend), never in the JSON body. See extractRefreshTokenCookie/AuthResult below for how
// test setup that needs it (seeding a pre-authenticated Playwright storageState) gets it instead.
export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: "ADMIN" | "FAMILY_ADMIN" | "MEMBER";
    familyId?: string;
    active: boolean;
    pinEnabled: boolean;
  };
}

export interface AuthResult extends AuthResponse {
  refreshTokenCookie: string;
}

export const REFRESH_COOKIE_NAME = "wn_refresh_token";

/** Node's axios (unlike a browser) never applies Set-Cookie anywhere — it just surfaces the raw
 * header on the response, unparsed. Pulls the httpOnly refresh-token cookie's value out of that,
 * for the one thing a Node-side test helper needs it for: seeding a real cookie into a Playwright
 * storageState/browser context so a provisioned user starts a test already authenticated (see
 * setUpFixtureUser). */
function extractRefreshTokenCookie(setCookieHeaders: string[] | undefined): string {
  const raw = setCookieHeaders?.find((h) => h.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!raw) throw new Error(`Expected a ${REFRESH_COOKIE_NAME} Set-Cookie header, got none`);
  return decodeURIComponent(raw.slice(REFRESH_COOKIE_NAME.length + 1).split(";")[0]);
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
}

function client(): AxiosInstance {
  return axios.create({ baseURL: env.apiUrl, headers: { "Content-Type": "application/json" } });
}

export const api = {
  async health(): Promise<boolean> {
    try {
      const res = await axios.get(`${env.apiUrl.replace(/\/api\/v1$/, "")}/actuator/health`, { timeout: 5000 });
      return res.data?.status === "UP";
    } catch {
      return false;
    }
  },

  // No cookie to extract — AuthServiceImpl#register always returns null/zero tokens regardless of
  // outcome (a fresh account isn't email-verified yet, and the response is enumeration-safe either
  // way); the actual authenticated session used by callers here always comes from a later login().
  async register(input: { fullName: string; email: string; password: string }): Promise<AuthResponse> {
    const { data } = await client().post("/auth/register", input);
    return data.data;
  },

  async login(input: { email: string; password: string; rememberMe?: boolean }): Promise<AuthResult> {
    const res = await client().post("/auth/login", input);
    return { ...res.data.data, refreshTokenCookie: extractRefreshTokenCookie(res.headers["set-cookie"]) };
  },

  async googleLogin(idToken: string): Promise<AuthResult> {
    const res = await client().post("/auth/google-login", { idToken, rememberMe: false });
    return { ...res.data.data, refreshTokenCookie: extractRefreshTokenCookie(res.headers["set-cookie"]) };
  },

  async createCategory(
    accessToken: string,
    input: { name: string; icon?: string; color?: string; type: "EXPENSE" | "INCOME" | "TRANSFER" }
  ): Promise<Category> {
    const { data } = await client().post("/categories", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  async getCategories(accessToken: string): Promise<Category[]> {
    const { data } = await client().get("/categories", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Direct account creation for test setup that isn't itself exercising the Accounts UI (e.g.
   * seeding one shared account a whole spec file's tests transact against) — skips the ~7 GET
   * requests a real `/accounts` page load fires, which matters given the API's 200 req/min general
   * rate limit once a regression file has more than a couple of tests. */
  async createAccount(accessToken: string, input: Record<string, unknown>): Promise<{ id: string; name: string }> {
    const { data } = await client().post("/accounts", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Joins a family directly by invite code — for specs (e.g. expense-split) that need a second
   * family member to exist but aren't themselves testing the join flow (see family.spec.ts for
   * that). Skips a whole extra UI login per member, which matters given the auth endpoint's
   * tight 10 req/min rate limit — a spec provisioning more than one extra member hits it fast if
   * each one also logs in through the UI just to click Join. */
  async joinFamily(accessToken: string, inviteCode: string): Promise<{ id: string; name: string }> {
    const { data } = await client().post("/families/join", { inviteCode }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Seeds an expense directly — used by specs (e.g. analytics) that need real spending history
   * to exist but aren't themselves testing the Add Expense flow. */
  async createExpense(accessToken: string, input: Record<string, unknown>): Promise<{ id: string }> {
    const { data } = await client().post("/expenses", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Seeds an income entry directly — same rationale as createExpense. */
  async createIncome(accessToken: string, input: Record<string, unknown>): Promise<{ id: string }> {
    const { data } = await client().post("/income", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Seeds a goal directly — used by specs (e.g. recurring-rules) that need an existing goal to
   * attach to but aren't themselves testing Goal creation. */
  async createGoal(accessToken: string, input: Record<string, unknown>): Promise<{ id: string; name: string }> {
    const { data } = await client().post("/goals", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Closes (deactivates) a test-provisioned user's account directly — for one-off users a spec
   * provisions itself (outside global-setup/global-teardown's own cleanup), e.g. family.spec.ts's
   * second member. */
  async closeAccount(accessToken: string): Promise<void> {
    await client().delete("/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
  },

  /** Enables PIN quick-unlock directly — for app-lock.spec.ts, which is testing what happens
   * *after* PIN is already set up, not the Settings enable-PIN form itself. Under /users/me/, not
   * /auth/, so it counts against the general 200 req/min limit, not the tighter 10/min auth one. */
  async enablePin(accessToken: string, currentPassword: string, pin: string): Promise<void> {
    await client().post("/users/me/pin/enable", { currentPassword, pin }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  /** Mints a Google-ID-token-shaped JWT via the backend's `e2e-oauth-test`-profile-only test
   * double (see TestGoogleAuthController) — only reachable when the API is running with that
   * profile active. Used by google-oauth.spec.ts to drive a real Google Sign-In round trip
   * without a live Google test account; see that file's own comment for the full design. */
  async issueTestGoogleIdToken(input: { email: string; name?: string; emailVerified?: boolean }): Promise<string> {
    const { data } = await client().post("/auth/test/google-issue-token", input);
    return data.data.idToken;
  },

  /** True only when the API is running with the `e2e-oauth-test` profile active. Checks for an
   * actual well-formed token back, not just "not an error" — TestGoogleAuthController isn't
   * registered as a bean in the default profile, so the request falls through to
   * GlobalExceptionHandler's catch-all and comes back as a generic 500, not a clean 404; a
   * non-2xx status alone isn't a reliable "inactive" signal, but a real idToken in the body is a
   * reliable "active" one. Used to skip google-oauth.spec.ts cleanly rather than fail confusingly
   * against a normally-configured API. */
  async isOAuthTestModeActive(): Promise<boolean> {
    try {
      const { data } = await client().post("/auth/test/google-issue-token", { email: "oauth-test-mode-check@wealthynest.test" });
      return typeof data?.data?.idToken === "string" && data.data.idToken.length > 0;
    } catch {
      return false;
    }
  },

  /** Used to assert exact per-participant shareAmount values after a split (custom-amount UI
   * assertions would otherwise depend on parsing locale-formatted currency text) — see
   * expense-split.spec.ts. */
  async getMySplits(accessToken: string): Promise<{
    balances: { counterpartUserId: string; counterpartName: string; netAmount: number }[];
    pending: { id: string; participantUserId: string; shareAmount: number; status: "PENDING" | "SETTLED" }[];
  }> {
    const { data } = await client().get("/expense-splits/my-splits", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** POST /expense-splits/{id}/settle (settle a single split) has no UI surface anywhere in the
   * app — SplitsCard.tsx only ever calls settle-with/{counterpartId} (settle every split with one
   * person at once). Called directly here so this endpoint has at least some coverage; see
   * expense-split.spec.ts's own comment on the finding. */
  async settleSplit(accessToken: string, id: string): Promise<void> {
    await client().post(`/expense-splits/${id}/settle`, {}, { headers: { Authorization: `Bearer ${accessToken}` } });
  },
};
