import path from "path";
import dotenv from "dotenv";

// Load this package's own .env first, then fall back to the repo root .env for anything still
// unset (DB_PASSWORD in particular — it's already defined there for docker-compose, no reason to
// duplicate the real value into a second file that could drift or get committed by mistake).
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var: ${name} (set it in playwright/.env)`);
  return value;
}

export const env = {
  baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
  apiUrl:  process.env.API_URL ?? "http://localhost:8080/api/v1",
  // Same var + same default the backend's WebAuthnConfig.getRpId() derives the relying-party ID
  // from (see wealthynest-api's WebAuthnConfig.java) — WebAuthn strictly requires the page's own
  // origin to match that rpId, so webauthn.spec.ts must navigate to whatever this actually
  // resolves to per environment, not a hardcoded domain that only matches one specific setup.
  webauthnOriginUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",

  db: {
    host:     process.env.DB_HOST ?? "127.0.0.1",
    port:     Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? "wealthynest",
    user:     process.env.DB_USER ?? "wealthynest",
    password: required("DB_PASSWORD"),
  },

  e2eUser: {
    emailPrefix: process.env.E2E_USER_EMAIL_PREFIX ?? "e2e-test-user",
    password:    process.env.E2E_USER_PASSWORD ?? "E2eTestPassword1",
  },

  isCI: !!process.env.CI,
};

export const STORAGE_STATE_PATH = path.resolve(__dirname, "../.auth/user.json");

// A second, separate user for tests/regression/ — kept apart from STORAGE_STATE_PATH's user (used
// by tests/auth/ and tests/smoke/) so that suite and this one never mutate the same account/debt/
// budget rows concurrently. Provisioned once in global-setup, not per-worker: registering a fresh
// user per worker multiplied auth-endpoint calls past the API's 10 req/min rate limit (see
// RateLimitConfig) once several workers all started up within the same minute.
export const REGRESSION_STORAGE_STATE_PATH = path.resolve(__dirname, "../.auth/regression-user.json");

// "chromium", "mobile-chrome", "tablet", "tablet-portrait", and "narrow-desktop" all share the one
// original unsuffixed storageState file — this was already true before per-project provisioning
// existed (test:responsive's mobile-chrome project has always reused chromium's regressionUser
// storageState) and stays true: none of these ever run tests/regression/'s *mutating* specs
// concurrently with each other (they only run the read-only responsive/a11y/performance/visual
// suites), so the backend-singleton collision (Cash Wallet, Emergency Fund — see README's
// "chromium only, on purpose") that per-project isolation exists for never applies to them. Only a
// project that might actually run tests/regression/'s mutating specs — firefox, webkit, or any
// future addition, via E2E_PROJECTS — gets its own suffixed file.
const SHARED_STORAGE_PROJECTS = new Set(["chromium", "mobile-chrome", "tablet", "tablet-portrait", "narrow-desktop"]);

export function storageStatePathFor(project: string): string {
  return SHARED_STORAGE_PROJECTS.has(project) ? STORAGE_STATE_PATH : path.resolve(__dirname, `../.auth/user.${project}.json`);
}
export function regressionStorageStatePathFor(project: string): string {
  return SHARED_STORAGE_PROJECTS.has(project)
    ? REGRESSION_STORAGE_STATE_PATH
    : path.resolve(__dirname, `../.auth/regression-user.${project}.json`);
}

// Which projects global-setup/global-teardown provision a user pair for. Defaults to chromium
// only (today's behavior, unchanged) — set E2E_PROJECTS (comma-separated) to provision more, e.g.
// `E2E_PROJECTS=chromium,firefox,webkit npx playwright test tests/regression --project=firefox`.
// Provisioning every project unconditionally on every run would multiply global-setup's own
// auth-endpoint calls (2 users × 2 calls each, per project) past the 10 req/min limit for the
// common chromium-only case, so this stays opt-in rather than automatic.
export const PROJECTS_TO_PROVISION = (process.env.E2E_PROJECTS ?? "chromium")
  .split(",").map((p) => p.trim()).filter(Boolean);
