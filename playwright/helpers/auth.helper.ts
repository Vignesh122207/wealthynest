import fs from "fs";
import path from "path";
import {Client} from "pg";
import {env} from "../config/env";
import {api, type AuthResponse} from "./api.helper";
import {randomCategoryName} from "../test-data/factory";

export interface E2EUserFixtureData {
  fullName: string;
  email: string;
  password: string;
  expenseCategoryId: string;
  expenseCategoryName: string;
}

export const E2E_USER_FILE = path.resolve(__dirname, "../.auth/e2e-user.json");
export const REGRESSION_USER_FILE = path.resolve(__dirname, "../.auth/regression-e2e-user.json");

/** Same per-project sharing/suffixing as config/env.ts's storageStatePathFor — "chromium",
 * "mobile-chrome", and "tablet" all keep the original unsuffixed filename (see that function's own
 * comment for why); every other project gets its own. */
const SHARED_STORAGE_PROJECTS = new Set(["chromium", "mobile-chrome", "tablet"]);

export function e2eUserFileFor(project: string): string {
  return SHARED_STORAGE_PROJECTS.has(project) ? E2E_USER_FILE : path.resolve(__dirname, `../.auth/e2e-user.${project}.json`);
}
export function regressionUserFileFor(project: string): string {
  return SHARED_STORAGE_PROJECTS.has(project)
    ? REGRESSION_USER_FILE
    : path.resolve(__dirname, `../.auth/regression-e2e-user.${project}.json`);
}

/** Reads the user global-setup provisioned — call from tests/fixtures, not from global-setup
 * itself. `project` defaults to "chromium" (every regression file's own direct call site, none of
 * which pass one, since `test:regression` etc. are chromium-only today); pass
 * `testInfo.project.name` explicitly for a spec that might run under another project. */
export function readE2EUser(project = "chromium"): E2EUserFixtureData {
  return JSON.parse(fs.readFileSync(e2eUserFileFor(project), "utf-8"));
}

/** Reads the dedicated tests/regression/ user global-setup provisioned. See readE2EUser's own
 * comment on the `project` param. */
export function readRegressionUser(project = "chromium"): E2EUserFixtureData {
  return JSON.parse(fs.readFileSync(regressionUserFileFor(project), "utf-8"));
}

// wealthynest-api/.../AuthServiceImpl#register always creates users with emailVerified=false
// (see V8__users.sql — the column defaults to true at the DB level, but register() explicitly
// overrides it) and login() rejects with EMAIL_NOT_VERIFIED until that flag flips. There's no
// SMTP inbox to click a verification link from in this suite, so this connects straight to the
// docker-compose postgres (bound to 127.0.0.1:5432, see docker-compose.yml) and flips the flag —
// touches one row of test data, not a migration or the schema.
export async function markEmailVerified(email: string): Promise<void> {
  const client = new Client({
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
  });
  await client.connect();
  try {
    await client.query("UPDATE users SET email_verified = true WHERE email = $1", [email]);
  } finally {
    await client.end();
  }
}

// There's no self-service or API path to ADMIN — it's an operator-only role (see
// V8__users.sql's CHECK constraint: ADMIN | FAMILY_ADMIN | MEMBER, and every registration flow
// hardcodes MEMBER). tests/regression/admin.spec.ts's dedicated admin user is promoted the same
// direct-DB way markEmailVerified bypasses the email-click requirement above — one row, not a
// migration or schema change.
export async function markAdmin(email: string): Promise<void> {
  const client = new Client({
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
  });
  await client.connect();
  try {
    await client.query("UPDATE users SET role = 'ADMIN' WHERE email = $1", [email]);
  } finally {
    await client.end();
  }
}

// NseCorporateAction (see InvestmentServiceImpl.getDividendSuggestions) is populated by a
// scheduled job pulling real NSE corporate-action data — there's no create/seed API for it, and
// depending on that job actually having fetched a real upcoming dividend for whatever stock this
// suite happens to hold would be exactly the kind of live-external-data flakiness this suite
// deliberately avoids elsewhere (see investments.spec.ts's mocked LiveSearch, cas-import's
// hand-built PDF). Same direct-DB approach as markEmailVerified/markAdmin above — inserts one row
// of test data, not a migration. `ON CONFLICT` makes reruns against the same symbol/date safe.
export async function seedDividendCorporateAction(input: { symbol: string; exDate: string; dividendPerShare: number }): Promise<void> {
  const client = new Client({
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
  });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO nse_corporate_actions (symbol, action_type, ex_date, dividend_per_share)
       VALUES ($1, 'DIVIDEND', $2, $3)
       ON CONFLICT (symbol, action_type, ex_date) DO UPDATE SET dividend_per_share = EXCLUDED.dividend_per_share`,
      [input.symbol, input.exDate, input.dividendPerShare]
    );
  } finally {
    await client.end();
  }
}

export interface E2EUser {
  fullName: string;
  email: string;
  password: string;
  auth: AuthResponse;
}

/** Registers a fresh user via the API, verifies their email directly in the DB, then logs in. */
export async function provisionE2EUser(overrides?: Partial<{ fullName: string; email: string; password: string }>): Promise<E2EUser> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = overrides?.email ?? `${env.e2eUser.emailPrefix}-${suffix}@wealthynest.test`;
  const password = overrides?.password ?? env.e2eUser.password;
  const fullName = overrides?.fullName ?? "E2E Test User";

  await api.register({ fullName, email, password });
  await markEmailVerified(email);
  const auth = await api.login({ email, password });

  return { fullName, email, password, auth };
}

/** Provisions a user + one EXPENSE category, then writes both a Playwright storageState file and
 * a plain JSON fixture file (read back via readE2EUser/readRegressionUser) — the shared plumbing
 * behind global-setup's two provisioned users. */
export async function setUpFixtureUser(storageStatePath: string, userFilePath: string): Promise<void> {
  const user = await provisionE2EUser();
  const category = await api.createCategory(user.auth.accessToken, {
    name: randomCategoryName(),
    type: "EXPENSE",
  });

  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  fs.writeFileSync(
    storageStatePath,
    JSON.stringify({
      cookies: [],
      origins: [{
        origin: env.baseUrl,
        localStorage: [{ name: "wealthynest-auth", value: authStoreLocalStorageValue(user.auth) }],
      }],
    })
  );

  fs.writeFileSync(
    userFilePath,
    JSON.stringify({
      fullName: user.fullName,
      email: user.email,
      password: user.password,
      expenseCategoryId: category.id,
      expenseCategoryName: category.name,
    })
  );
}

/** Shape zustand's `persist` middleware writes to localStorage — see
 * wealthynest-web/src/features/auth/store/auth.store.ts. axios.ts reads accessToken from exactly
 * this path, so a storageState pre-populated with it starts a test already authenticated. */
export function authStoreLocalStorageValue(auth: AuthResponse): string {
  return JSON.stringify({
    state: {
      user: auth.user,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      isAuthenticated: true,
    },
    version: 0,
  });
}
