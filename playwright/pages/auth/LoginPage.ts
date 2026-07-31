import {expect, type Locator, type Page} from "@playwright/test";
import {TEST_IDS} from "../../constants/testIds";
import {ROUTES} from "../../constants/routes";
import {toastLocator} from "../../helpers/wait.helper";

/** Models wealthynest-web/src/features/auth/components/LoginForm.tsx — a multi-step flow
 * (choose-method screen -> combined email+password/PIN step, or Google straight from the
 * choose-method screen), not a single flat form. No passkey option here — passkey is scoped
 * entirely to AppLockScreen's returning-device unlock (see AppLockScreen.ts's fingerprintButton),
 * not a full-login alternative. */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.login);
  }

  get continueWithEmailButton(): Locator {
    return this.page.getByTestId(TEST_IDS.login.continueWithEmailButton);
  }
  get googleButton(): Locator {
    return this.page.getByTestId(TEST_IDS.login.googleButton);
  }
  get passwordStepEmailInput(): Locator {
    return this.page.getByTestId(TEST_IDS.login.passwordStepEmail);
  }
  get passwordStepPasswordInput(): Locator {
    return this.page.getByTestId(TEST_IDS.login.passwordStepPassword);
  }
  get passwordSubmitButton(): Locator {
    return this.page.getByTestId(TEST_IDS.login.passwordSubmit);
  }
  get backButton(): Locator {
    return this.page.getByTestId(TEST_IDS.login.backButton);
  }
  get emailError(): Locator {
    return this.page.getByTestId(TEST_IDS.login.emailError);
  }
  get pinInput(): Locator {
    return this.page.getByTestId(TEST_IDS.login.pinInput);
  }
  get pinSubmit(): Locator {
    return this.page.getByTestId(TEST_IDS.login.pinSubmit);
  }

  /** Only ever shown when the persisted auth store already has pinEnabled set from a prior login
   * on this device (see LoginForm.tsx's pinCandidate check) — call loginWithPassword (or otherwise
   * arrive at that state) before this, not instead of it.
   *
   * Fills the PIN and lets PinLoginStep's own effect auto-submit the moment the 4th digit lands,
   * matching a real user's flow — same reasoning as AppLockScreen.unlockWithPin, which this
   * mirrors: an explicit click() after fill() races that auto-submit and can hang on a disabled
   * button until its 30s timeout. */
  async loginWithPin(pin: string): Promise<void> {
    await this.pinInput.fill(pin);
  }

  /** Moves from the choose-method screen (Google / "Continue with email") into the combined
   * email+password step where passwordStepEmailInput/passwordStepPasswordInput/passkeyButton
   * live. Call after goto(), before touching any of those — they don't exist on the choose-method
   * screen itself. */
  async continueWithEmail(): Promise<void> {
    await this.continueWithEmailButton.click();
  }

  /** Full password-path login: choose-method screen -> "Continue with email" -> combined
   * email+password step -> submit. No "remember me" option — every login always requests the
   * long-lived session (see LoginForm.tsx/useLogin's own comments for why: the
   * PIN/fingerprint/passkey lock screen is what actually gates a returning device, not a shorter
   * token). */
  async loginWithPassword(email: string, password: string): Promise<void> {
    await this.goto();
    await this.continueWithEmail();
    await this.passwordStepEmailInput.fill(email);
    await this.passwordStepPasswordInput.fill(password);
    await this.passwordSubmitButton.click();
  }

  async expectRedirectedToHome(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${ROUTES.home}$`));
  }

  async expectStillOnLogin(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${ROUTES.login}$`));
  }

  /** useLogin's onError path (features/auth/hooks/useAuth.ts) surfaces failures as a toast, not
   * an inline field error — there is nothing under the password field to assert against. */
  async expectLoginFailedToast(): Promise<void> {
    await expect(toastLocator(this.page).first()).toBeVisible();
  }
}
