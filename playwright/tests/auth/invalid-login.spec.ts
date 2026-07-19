import {expect, test} from "../../fixtures";
import {faker} from "@faker-js/faker";

test.describe("Auth — Invalid login", () => {
  test("wrong password shows an error toast and does not navigate away @smoke", async ({ loginPage, e2eUser }) => {
    await loginPage.loginWithPassword(e2eUser.email, "TotallyWrongPassword1");
    await loginPage.expectLoginFailedToast();
    await loginPage.expectStillOnLogin();
  });

  test("unregistered email shows an error toast", async ({ loginPage }) => {
    await loginPage.loginWithPassword(faker.internet.email(), "SomePassword1");
    await loginPage.expectLoginFailedToast();
    await loginPage.expectStillOnLogin();
  });

  test("malformed email is rejected client-side before any request fires", async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.emailInput.fill("not-an-email");
    await loginPage.usePasswordButton.click();
    // The password step's email input is type="email" — the browser's own constraint validation
    // intercepts the submit event before React Hook Form's zod resolver ever runs, so neither its
    // inline error paragraph nor a network request fires for this case. That's correct behavior,
    // just enforced one layer earlier (native) than the schema-level validation this suite exercises
    // via loginPage.emailInput elsewhere (an empty-string case, which the native check doesn't
    // reject the same way) — assert against what actually intercepts it here.
    let requestFired = false;
    page.on("request", (req) => { if (req.url().includes("/auth/login")) requestFired = true; });
    await loginPage.passwordStepPasswordInput.fill("SomePassword1");
    await loginPage.passwordSubmitButton.click();
    await expect(loginPage.passwordStepEmailInput).toHaveJSProperty("validity.valid", false);
    expect(requestFired).toBe(false);
    await loginPage.expectStillOnLogin();
  });
});
