import {expect, type Locator, type Page} from "@playwright/test";
import {TEST_IDS} from "../../constants/testIds";
import {ROUTES} from "../../constants/routes";
import {toastLocator} from "../../helpers/wait.helper";

/** Models wealthynest-web/src/features/auth/components/LoginForm.tsx — a multi-step flow
 * (email screen -> password/passkey/Google/PIN step), not a single flat form. */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.login);
  }

  get emailInput(): Locator {
    return this.page.getByTestId(TEST_IDS.login.emailInput);
  }
  get rememberMeCheckbox(): Locator {
    return this.page.getByTestId(TEST_IDS.login.rememberMe);
  }
  get usePasswordButton(): Locator {
    return this.page.getByTestId(TEST_IDS.login.usePasswordButton);
  }
  get googleContainer(): Locator {
    return this.page.getByTestId(TEST_IDS.login.googleContainer);
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
  get passkeyButton(): Locator {
    return this.page.getByTestId(TEST_IDS.login.passkeyButton);
  }

  /** Full password-path login: email screen -> "Sign in with password" -> password step -> submit. */
  async loginWithPassword(email: string, password: string, opts?: { rememberMe?: boolean }): Promise<void> {
    await this.goto();
    await this.emailInput.fill(email);
    if (opts?.rememberMe) await this.rememberMeCheckbox.check();
    await this.usePasswordButton.click();
    await this.passwordStepEmailInput.fill(email);
    await this.passwordStepPasswordInput.fill(password);
    await this.passwordSubmitButton.click();
  }

  /** Requires a CDP virtual authenticator already attached to this page (see
   * helpers/webauthn.helper.ts) — otherwise `navigator.credentials.get()` hangs waiting for a
   * real device prompt that never comes. */
  async loginWithPasskey(email: string): Promise<void> {
    await this.goto();
    await this.emailInput.fill(email);
    await this.passkeyButton.click();
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
