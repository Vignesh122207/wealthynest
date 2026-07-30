import {defineConfig, devices} from "@playwright/test";
import {env} from "./config/env";

// Assumes `docker compose up -d` is already running (per the repo's documented workflow) —
// global-setup health-checks the API and fails fast with a clear message if it isn't reachable,
// rather than this config trying to shell out to docker-compose itself.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 2 : 0,
  workers: env.isCI ? 4 : undefined,
  reportSlowTests: { max: 10, threshold: 30000 },

  // Playwright's own default (unset = 5000ms) governs every `expect(locator).toBeVisible()`-style
  // assertion — a separate knob from actionTimeout/navigationTimeout below, and the one actually
  // behind several of the CI-only flakes this file's own comment describes (e.g. family.spec.ts's
  // "element(s) not found... Timeout: 5000ms" on getByTestId("family-create-card")).
  expect: { timeout: env.isCI ? 10000 : 5000 },

  // Playwright's own per-test default (unset = 30000ms) caps the whole test regardless of any
  // individual step's own timeout — bumping actionTimeout/navigationTimeout to 30-35s in CI below
  // without also raising this just moves the failure mode to "Target page, context or browser has
  // been closed" mid-wait once the overall budget runs out first. Give CI enough headroom above
  // the longest individual step timeout (35s) for one slow step to actually resolve.
  timeout: env.isCI ? 60000 : 30000,

  globalSetup: require.resolve("./global-setup"),
  globalTeardown: require.resolve("./global-teardown"),

  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],

  use: {
    baseURL: env.baseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Flat 15s/20s locally is plenty (one worker, no contention). In CI, 4 workers share a
    // 2-vCPU runner — confirmed by reproducing the exact CI flake set locally (app-lock's PIN
    // submit not re-enabling, investments' live-search result not resolving, a transfer-delete
    // response, webauthn's redirect) purely by adding worker contention with an otherwise-correct
    // (rate-limit-matched) local env; every one of them was a timeout landing right at the old
    // ceiling, not a real assertion failure. Not a rate-limit or app bug — see README's "Real rate
    // limits" section, already solved for CI via RATE_LIMIT_*_PER_MINUTE in e2e-nightly.yml.
    actionTimeout: env.isCI ? 30000 : 15000,
    navigationTimeout: env.isCI ? 35000 : 20000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    // 1080x810 — comfortably above Tailwind's default `lg` breakpoint (1024px, unmodified in
    // tailwind.config.ts), so this exercises the *desktop* layout (sidebar visible, not the mobile
    // overlay) at a narrower-than-typical desktop width, distinct from mobile-chrome's phone-width
    // coverage. See tests/responsive/tablet.spec.ts.
    { name: "tablet", use: { ...devices["iPad (gen 7) landscape"] } },
    // 810x1080 — iPad's own portrait dimensions, *below* the `lg` breakpoint (unlike the landscape
    // "tablet" project above), so this exercises the mobile nav overlay at a materially wider,
    // taller viewport than mobile-chrome's phone width — a genuinely different aspect ratio/DPI
    // combination, not a duplicate of either existing project. See tests/responsive/tablet-portrait.spec.ts.
    { name: "tablet-portrait", use: { ...devices["iPad (gen 7)"] } },
    // 1152x720 — a plain desktop UA (not a touch device, unlike the two tablet projects), just above
    // `lg` but well below a typical full-size monitor — proves the desktop layout doesn't just work
    // at "tablet" width but also at a genuinely narrow desktop/laptop width. See
    // tests/responsive/narrow-desktop.spec.ts.
    { name: "narrow-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1152, height: 720 } } },
  ],
});
