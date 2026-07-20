import {expect, test} from "../../fixtures";
import {ROUTES} from "../../constants/routes";

test.describe("Auth — Logout", () => {
  test("signs out from the sidebar and returns to login @smoke", async ({ authenticatedPage }) => {
    // Page-object fixtures (homePage, etc.) bind to the default `page` fixture, not
    // authenticatedPage — this test drives authenticatedPage directly since it needs the
    // pre-authenticated context storageState provides.
    await authenticatedPage.goto(ROUTES.home);
    await expect(authenticatedPage).toHaveURL(new RegExp(`${ROUTES.home}$`));

    await authenticatedPage.getByTestId("nav-logout").click();
    await expect(authenticatedPage).toHaveURL(new RegExp(`${ROUTES.login}$`));

    // Logged-out state must actually stick — reloading a protected route shouldn't silently
    // let a stale in-memory reference back in.
    await authenticatedPage.goto(ROUTES.home);
    await expect(authenticatedPage).toHaveURL(new RegExp(`${ROUTES.login}$`));
  });
});
