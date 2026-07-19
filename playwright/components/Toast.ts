import {expect, type Page} from "@playwright/test";
import {toastLocator} from "../helpers/wait.helper";

/** Wraps sonner's toast container (see ThemedToaster.tsx) — every toast it renders carries
 * `data-sonner-toast` on its own, so no custom data-testid was needed on the app side.
 *
 * Reliable for the *first* toast in a test (e.g. tests/auth/'s "Welcome back" / login-failure
 * toasts) — unreliable for a LATER toast in a multi-step flow. Confirmed by direct observation:
 * sonner's auto-dismiss timer appears to never fire in this headless environment, so the first
 * toast of a session just sits in the DOM indefinitely and keeps occupying the only slot
 * `.first()` will find — a later toast (e.g. "Account created" several steps into
 * critical-business-flow.spec.ts) never rendered at all in that state, even though the action it
 * was for genuinely succeeded. Prefer asserting on the actual resulting state (the row/card/value
 * now visible) over a toast for anything after the first user action in a test. */
export class Toast {
  constructor(private readonly page: Page) {}

  async expectVisible(text: string | RegExp): Promise<void> {
    await expect(toastLocator(this.page, text).first()).toBeVisible();
  }

  async expectNone(): Promise<void> {
    await expect(toastLocator(this.page)).toHaveCount(0);
  }
}
