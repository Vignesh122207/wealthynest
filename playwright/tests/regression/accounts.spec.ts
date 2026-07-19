import {test} from "../../fixtures";
import {faker} from "@faker-js/faker";

// accountsPage is backed by `authedPage`, a fresh context using this worker's own dedicated user
// (see fixtures/index.ts's `workerUser`) — parallel workers never see each other's accounts.

// Serial — see debts.spec.ts's comment: every regression test shares one backend user
// (regressionUser), and this file's tests mutate the same account list concurrently otherwise.
test.describe.configure({ mode: "serial" });

test.describe("Accounts", () => {
  test("creates a bank account and edits its balance @regression", async ({ accountsPage }) => {
    const bankName = faker.company.name() + " Bank";
    await accountsPage.gotoAccounts();
    await accountsPage.createBankAccount({ bankName, openingBalance: 20000 });
    await accountsPage.expectAccountVisible(bankName);

    await accountsPage.reconcileBalance(bankName, 25000);
    await accountsPage.expectAccountVisible(/25,000/);
  });

  test("only one Cash Wallet is allowed — the type button disables once one exists @regression", async ({ accountsPage }) => {
    await accountsPage.gotoAccounts();
    await accountsPage.createCashWalletAccount(500);
    await accountsPage.expectAccountVisible("Cash Wallet");

    await accountsPage.openCreateModal();
    await accountsPage.expectTypeButtonDisabled("CASH_WALLET");
  });

  test("Loan requires a loan type before it can be created @regression", async ({ accountsPage }) => {
    const bankName = faker.company.name();
    await accountsPage.gotoAccounts();
    await accountsPage.attemptCreateLoanWithoutType(bankName, 150000);
    await accountsPage.expectValidationError("Loan type is required");
  });

  test("creates a Loan with a type and it appears in the list @regression", async ({ accountsPage }) => {
    const bankName = faker.company.name();
    await accountsPage.gotoAccounts();
    await accountsPage.createLoan({ bankName, loanType: "Home Loan", outstanding: 2500000 });
    await accountsPage.expectAccountVisible(new RegExp(bankName));
  });

  test("creates a Credit Card with a credit limit @regression", async ({ accountsPage }) => {
    const bankName = faker.company.name();
    await accountsPage.gotoAccounts();
    await accountsPage.createCreditCard({ bankName, creditLimit: 100000, outstanding: 5000 });
    await accountsPage.expectAccountVisible(new RegExp(`${bankName} Card`));
  });

  test("creates an Emergency Fund account @regression", async ({ accountsPage }) => {
    await accountsPage.gotoAccounts();
    await accountsPage.createEmergencyFundAccount(10000);
    await accountsPage.expectAccountVisible("Emergency Fund");
  });

  test("archives then permanently deletes an account @regression", async ({ accountsPage }) => {
    const bankName = faker.company.name() + " Bank";
    await accountsPage.gotoAccounts();
    await accountsPage.createBankAccount({ bankName, openingBalance: 1000 });
    await accountsPage.expectAccountVisible(bankName);

    await accountsPage.deleteAccount(bankName, { alsoDeleteTransactions: true });
    await accountsPage.expectAccountNotVisible(bankName);
  });
});
