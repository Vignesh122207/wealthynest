import {expect, test} from "../../fixtures";
import {ROUTES} from "../../constants/routes";
import {SignupPage} from "../../pages/auth/SignupPage";

// Deliberately narrow scope: only pages with no per-run-dynamic content (real dollar amounts,
// dates, user-specific data) are screenshotted — a dashboard/accounts screenshot would diff on
// every run purely from regressionUser's ever-growing transaction history, which is noise, not a
// real visual regression. Login, Signup, FAQ, and Contact are static enough to be worth pinning —
// Contact in particular has no per-user content at all (a fixed support email + two static nav
// links, see settings/support/contact/page.tsx), same shape as FAQ.
//
// Baselines (tests/visual/visual.spec.ts-snapshots/) are pixel-rendered on whatever OS/GPU
// generates them — Playwright's own docs are explicit that screenshot assertions are only
// reliable when captured and compared on the same platform. These were generated on this
// machine (macOS); running this suite on a different OS (a Linux CI runner, for instance) will
// fail on font-rendering/anti-aliasing differences alone and need its own baseline, not a real
// regression. Treat a mismatch as "check visually, then regenerate with --update-snapshots on
// that platform" before assuming a real bug.
test.describe.configure({ mode: "serial" });

test.describe("Visual regression (static pages only)", () => {
  test("login page @visual", async ({ page }) => {
    await page.goto(ROUTES.login);
    await expect(page).toHaveScreenshot("login.png", { maxDiffPixelRatio: 0.02 });
  });

  test("signup page @visual", async ({ page }) => {
    await new SignupPage(page).goto();
    await expect(page).toHaveScreenshot("signup.png", { maxDiffPixelRatio: 0.02 });
  });

  test("FAQ page @visual", async ({ supportPage }) => {
    await supportPage.gotoFaq();
    await expect(supportPage.rawPage).toHaveScreenshot("faq.png", { maxDiffPixelRatio: 0.02 });
  });

  test("Contact page @visual", async ({ supportPage }) => {
    await supportPage.gotoContact();
    await expect(supportPage.rawPage).toHaveScreenshot("contact.png", { maxDiffPixelRatio: 0.02 });
  });
});
