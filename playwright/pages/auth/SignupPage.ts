import {type Locator, type Page} from "@playwright/test";
import {TEST_IDS} from "../../constants/testIds";
import {ROUTES} from "../../constants/routes";

export class SignupPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.signup);
  }

  get fullNameInput(): Locator {
    return this.page.getByTestId(TEST_IDS.signup.fullNameInput);
  }
  get emailInput(): Locator {
    return this.page.getByTestId(TEST_IDS.signup.emailInput);
  }
  get passwordInput(): Locator {
    return this.page.getByTestId(TEST_IDS.signup.passwordInput);
  }
  get confirmPasswordInput(): Locator {
    return this.page.getByTestId(TEST_IDS.signup.confirmPasswordInput);
  }
  get submitButton(): Locator {
    return this.page.getByTestId(TEST_IDS.signup.submit);
  }

  async register(input: { fullName: string; email: string; password: string }): Promise<void> {
    await this.goto();
    await this.fullNameInput.fill(input.fullName);
    await this.emailInput.fill(input.email);
    await this.passwordInput.fill(input.password);
    await this.confirmPasswordInput.fill(input.password);
    await this.submitButton.click();
  }
}
