import {expect, test} from "../../fixtures";
import {markAdmin, provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {AdminPage} from "../../pages/AdminPage";
import type {BrowserContext, Page} from "@playwright/test";

// Serial — see debts.spec.ts's comment. Admin is ADMIN-role-gated (admin/page.tsx redirects
// anyone else to /dashboard), and there's no self-service or API path to that role (see
// markAdmin's comment) — so this file provisions and promotes its own dedicated admin user
// rather than reusing regressionUser/e2eUser, and builds its own AdminPage from that user's own
// page/context rather than the shared authedPage fixture. Using the fixture-provided page objects
// here would silently drive regressionUser's session instead of the admin's — the exact bug the
// smoke test hit earlier when its page objects were wired to the wrong user (see README).
test.describe.configure({ mode: "serial" });

test.describe("Admin", () => {
  let adminContext: BrowserContext;
  let adminBrowserPage: Page;
  let adminPage: AdminPage;
  let adminAccessToken: string;

  // A second, disposable non-admin user this file creates and manages entirely on its own —
  // exists purely so the Users tab has a real row to toggle active/inactive on, without touching
  // regressionUser or e2eUser (which every other regression file depends on staying untouched).
  let targetEmail: string;
  let targetAccessToken: string;

  test.beforeAll(async ({ browser }) => {
    const admin = await provisionE2EUser();
    await markAdmin(admin.email);
    adminAccessToken = admin.auth.accessToken;

    adminContext = await browser.newContext();
    adminBrowserPage = await adminContext.newPage();
    const login = new LoginPage(adminBrowserPage);
    await login.goto();
    // Re-login after markAdmin — the token from provisionE2EUser's own login predates the role
    // change, and role is baked into the JWT at issuance.
    await login.loginWithPassword(admin.email, admin.password);
    await login.expectRedirectedToHome();
    adminPage = new AdminPage(adminBrowserPage);

    const target = await provisionE2EUser();
    targetEmail = target.email;
    targetAccessToken = target.auth.accessToken;
  });

  test.afterAll(async () => {
    await api.closeAccount(targetAccessToken).catch(() => {});
    await api.closeAccount(adminAccessToken).catch(() => {});
    await adminContext.close();
  });

  test("a non-admin visiting /admin is redirected to home @regression", async ({ authedPage }) => {
    await authedPage.goto("/admin");
    await expect(authedPage).toHaveURL(/\/home$/);
  });

  test("an admin sees the Overview tab with stats @regression", async () => {
    await adminPage.gotoAdmin();
    await adminPage.expectLoaded();
    await expect(adminBrowserPage.getByText("Total users")).toBeVisible();
  });

  test("Users tab: search finds the target user and toggling active status works @regression", async () => {
    await adminPage.selectTab("users");
    await expect(adminBrowserPage.getByText("All Users")).toBeVisible();

    await adminPage.searchUsers(targetEmail);
    await expect(adminPage.userRow(targetEmail)).toBeVisible();
    await adminPage.expectUserActive(targetEmail, true);

    await adminPage.toggleUserActive(targetEmail);
    await adminPage.expectUserActive(targetEmail, false);

    await adminPage.toggleUserActive(targetEmail);
    await adminPage.expectUserActive(targetEmail, true);
  });

  test("Tickets, Audit, and Jobs tabs load without error @regression", async () => {
    await adminPage.selectTab("tickets");
    await expect(adminBrowserPage.getByPlaceholder("Search by subject, name, or email…")).toBeVisible();

    await adminPage.selectTab("audit");
    await expect(adminBrowserPage.getByRole("heading", { name: "Audit Log" })).toBeVisible();

    await adminPage.selectTab("jobs");
    await expect(adminBrowserPage.getByRole("heading", { name: "Scheduled Jobs" })).toBeVisible();
  });
});
