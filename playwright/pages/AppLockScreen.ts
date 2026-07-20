import {expect, type Locator, type Page} from "@playwright/test";
import {TEST_IDS} from "../constants/testIds";

/** Models wealthynest-web/src/features/auth/components/AppLockScreen.tsx — the overlay that
 * appears on top of the dashboard (any route, not a route of its own) after
 * useAppLockTrigger.ts decides the tab has been backgrounded past its grace period or idle past
 * its limit. Not a BasePage subclass: this can appear over any dashboard page, so its own
 * identity isn't tied to one route the way the rest of pages/ is. */
export class AppLockScreen {
  constructor(private readonly page: Page) {}

  /** The overlay itself, not tied to which unlock method(s) it offers — AppLockScreen only
   * renders the PIN form when the account has a PIN configured and the passkey button when it has
   * a registered passkey, so a passkey-only (or PIN-only) account never shows both. Asserting
   * against this instead of e.g. pinInput is what makes expectVisible/expectNotVisible correct
   * for every account shape, not just PIN-enabled ones. */
  get dialog(): Locator {
    return this.page.getByRole("dialog", { name: "Unlock WealthyNest" });
  }
  get pinInput(): Locator {
    return this.page.getByTestId(TEST_IDS.appLock.pinInput);
  }
  get pinSubmit(): Locator {
    return this.page.getByTestId(TEST_IDS.appLock.pinSubmit);
  }
  get passkeyButton(): Locator {
    return this.page.getByTestId(TEST_IDS.appLock.passkeyButton);
  }
  get signOutButton(): Locator {
    return this.page.getByTestId(TEST_IDS.appLock.signOut);
  }

  async expectVisible(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }
  async expectNotVisible(): Promise<void> {
    await expect(this.dialog).not.toBeVisible();
  }

  async unlockWithPin(pin: string): Promise<void> {
    await this.pinInput.fill(pin);
    await this.pinSubmit.click();
  }

  /** Directly manipulates document.visibilityState + fires the real event
   * useAppLockTrigger.ts listens for — this is what a tab losing focus, a PWA being backgrounded,
   * or (on mobile) the device screen locking all actually look like from the page's own
   * perspective; there's no higher-fidelity way to simulate it from outside the browser engine
   * itself. String-literal evaluate() bodies, not function references: passing a closure here hits
   * a tsx/esbuild quirk (an injected `__name` helper that doesn't exist in the page's own
   * context) that a plain string body sidesteps — confirmed while building this, not a guess. */
  async goBackground(): Promise<void> {
    await this.page.evaluate(
      "Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});" +
      "document.dispatchEvent(new Event('visibilitychange'));"
    );
  }

  async goForeground(): Promise<void> {
    await this.page.evaluate(
      "Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});" +
      "document.dispatchEvent(new Event('visibilitychange'));"
    );
  }
}
