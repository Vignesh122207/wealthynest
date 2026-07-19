import path from "path";
import {expect, test} from "../../fixtures";
import {uniqueSuffix} from "../../test-data/factory";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/.
test.describe.configure({ mode: "serial" });

const SAMPLE_CAS_PDF = path.resolve(__dirname, "../../test-data/files/sample-cas-statement.pdf");

// Password-protected sibling of SAMPLE_CAS_PDF — see generate-sample-cas-statement-locked.py.
const LOCKED_CAS_PDF = path.resolve(__dirname, "../../test-data/files/sample-cas-statement-locked.pdf");
const LOCKED_CAS_PDF_PASSWORD = "cas2026secure";

test.describe("CAS Import (PDF)", () => {
  test("imports a mutual fund holding from a CAS PDF @regression", async ({ investmentsPage }) => {
    await investmentsPage.gotoInvestments();
    await investmentsPage.importFromCas(SAMPLE_CAS_PDF);

    await investmentsPage.gotoTab("mf");
    await investmentsPage.expectInvestmentVisible("E2E Growth Fund Direct Plan Growth");
  });

  test("imports a password-protected CAS PDF after unlocking it @regression", async ({ investmentsPage }) => {
    await investmentsPage.gotoInvestments();
    await investmentsPage.importFromCasWithPassword(LOCKED_CAS_PDF, LOCKED_CAS_PDF_PASSWORD);

    await investmentsPage.gotoTab("mf");
    await investmentsPage.expectInvestmentVisible("E2E Secure Equity Fund Direct Plan Growth");
  });

  // Exercises the two paths the parser's own doc comment cites as its main answer to admittedly
  // imperfect real-world accuracy: manually fixing a row the parser got wrong (here, simulated by
  // clearing a required field on the one row SAMPLE_CAS_PDF parses cleanly) and manually adding a
  // scheme the parser missed entirely ("Add missed scheme").
  test("supports fixing an incomplete parsed row and adding a manually-entered missed scheme @regression", async ({ investmentsPage }) => {
    const manualSchemeName = `E2E Manually Added Fund ${uniqueSuffix()}`;

    await investmentsPage.gotoInvestments();
    await investmentsPage.uploadCasForReview(SAMPLE_CAS_PDF);

    // The one parsed row starts fully valid (current value auto-derived from units × NAV) —
    // clearing "Current value" makes it incomplete and should disable Import.
    await investmentsPage.casRowField(0, "value").fill("");
    await expect(investmentsPage.rawPage.getByText("Scheme name, units, NAV, and current value are all required")).toBeVisible();
    await expect(investmentsPage.rawPage.getByTestId("import-cas-confirm")).toBeDisabled();

    // Manually fix it back.
    await investmentsPage.fillCasRow(0, { value: 5000 });
    await expect(investmentsPage.rawPage.getByTestId("import-cas-confirm")).toBeEnabled();

    // Add a second holding entirely by hand, as if the parser had missed it.
    await investmentsPage.addCasManualRow();
    await investmentsPage.fillCasRow(-1, { scheme: manualSchemeName, units: 50, nav: 100, value: 5000 });
    await expect(investmentsPage.rawPage.getByTestId("import-cas-confirm")).toBeEnabled();

    await investmentsPage.confirmCasImport();

    await investmentsPage.gotoTab("mf");
    await investmentsPage.expectInvestmentVisible("E2E Growth Fund Direct Plan Growth");
    await investmentsPage.expectInvestmentVisible(manualSchemeName);
  });
});
