import path from "path";
import {test} from "../../fixtures";
import {randomBankAccount} from "../../test-data/factory";
import {readRegressionUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/. Seeds a bank account directly (this file may run in isolation, where
// regressionUser starts with zero accounts — same rationale as transactions.spec.ts's own
// beforeAll comment and expense-split.spec.ts's).
test.describe.configure({ mode: "serial" });

// Uses column headers StatementImportServiceImpl auto-detects (Date/Description/Debit/Credit —
// see its *_ALIASES sets) so the import flow skips the mapping step entirely: one DEBIT row
// (imports as an expense) and one CREDIT row (imports as income).
const SAMPLE_CSV = path.resolve(__dirname, "../../test-data/files/sample-bank-statement.csv");

// Headers ("Entry Time"/"Info"/"Out"/"In") deliberately normalize to strings not in any of
// StatementImportServiceImpl's *_ALIASES sets, so autoDetect returns null and the preview
// response comes back needsMapping: true.
const UNMAPPED_CSV = path.resolve(__dirname, "../../test-data/files/sample-bank-statement-unmapped.csv");

// Five DEBIT/CREDIT rows for exercising toggle-include, bulk-categorize, and individual
// reassignment — see generate-sample-bank-statement-pdf.py's sibling comment for why the merchant
// names ("Nimbus Traders", "Halcyon Foods", "Terra Supplies") are invented rather than reused —
// they must not accidentally contain regressionUser's randomly-generated category name, which
// would give them a suggestedCategoryId and make them ineligible for bulk-select.
const MULTIROW_CSV = path.resolve(__dirname, "../../test-data/files/sample-bank-statement-multirow.csv");

// Password-protected PDF — see generate-sample-bank-statement-pdf.py. Two single-line
// transactions (date+narration+withdrawal+deposit+balance all on one line), matching
// parsePdfLines' simplest supported layout.
const LOCKED_PDF = path.resolve(__dirname, "../../test-data/files/sample-bank-statement-locked.pdf");
const LOCKED_PDF_PASSWORD = "e2etest123";

test.describe("Statement Import (CSV)", () => {
  let accountId: string;

  test.beforeAll(async ({}, testInfo) => {
    const user = readRegressionUser(testInfo.project.name);
    const auth = await api.login({ email: user.email, password: user.password });
    const bank = randomBankAccount();
    const account = await api.createAccount(auth.accessToken, {
      accountType: "BANK_ACCOUNT", name: bank.bankName, bankName: bank.bankName, openingBalance: bank.openingBalance,
    });
    accountId = account.id;
  });

  test("imports a CSV bank statement's debit and credit rows @regression", async ({ transactionsPage }) => {
    await transactionsPage.gotoTransactions();
    await transactionsPage.importStatementCsv({ accountId, filePath: SAMPLE_CSV });

    // The sample CSV's rows are dated in the past — outside the default "Month" (current month
    // only) filter — so switch to "All" before asserting they're there.
    await transactionsPage.showAllDates();
    await transactionsPage.expectRowVisible("E2E Grocery Store");
    await transactionsPage.expectRowVisible("E2E Salary Credit");
  });

  test("imports a CSV whose headers need manual column mapping @regression", async ({ transactionsPage }) => {
    await transactionsPage.gotoTransactions();
    await transactionsPage.importStatementWithMapping({
      accountId, filePath: UNMAPPED_CSV,
      mapping: { date: 0, description: 1, debit: 2, credit: 3 },
    });

    await transactionsPage.showAllDates();
    await transactionsPage.expectRowVisible("E2E Unmapped Debit Row");
    await transactionsPage.expectRowVisible("E2E Unmapped Credit Row");
  });

  test("imports a password-protected PDF statement after unlocking it @regression", async ({ transactionsPage }) => {
    await transactionsPage.gotoTransactions();
    await transactionsPage.importStatementWithPassword({
      accountId, filePath: LOCKED_PDF, password: LOCKED_PDF_PASSWORD,
    });

    await transactionsPage.showAllDates();
    await transactionsPage.expectRowVisible("Zeta Mart Purchase");
    await transactionsPage.expectRowVisible("Salary Credit");
  });

  test("supports toggling row inclusion, bulk-categorizing, and individually reassigning a category before confirming @regression", async ({ transactionsPage }, testInfo) => {
    const user = readRegressionUser(testInfo.project.name);
    await transactionsPage.gotoTransactions();
    await transactionsPage.uploadStatementForReview({ accountId, filePath: MULTIROW_CSV });

    // Row 2 ("E2E Toggle Off Row") — exclude it from the import entirely.
    await transactionsPage.toggleImportRowIncluded(2);

    // Rows 0 and 1 ("Nimbus Traders Purchase", "Halcyon Foods Order") have no suggested category
    // (their descriptions don't match any existing category name), so both are bulk-selectable —
    // select both and apply one category to them at once.
    await transactionsPage.selectImportRowForBulk(0);
    await transactionsPage.selectImportRowForBulk(1);
    await transactionsPage.applyBulkImportCategory(user.expenseCategoryName);

    // Row 4 ("Terra Supplies Order") — reassign its category individually, not via bulk.
    await transactionsPage.setImportRowCategory(4, user.expenseCategoryName);

    await transactionsPage.confirmStatementImport();

    await transactionsPage.showAllDates();
    await transactionsPage.expectRowVisible("Nimbus Traders Purchase");
    await transactionsPage.expectRowVisible("Halcyon Foods Order");
    await transactionsPage.expectRowVisible("E2E Freelance Payment");
    await transactionsPage.expectRowVisible("Terra Supplies Order");
    await transactionsPage.expectRowNotVisible("E2E Toggle Off Row");
  });
});
