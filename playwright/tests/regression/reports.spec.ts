import {expect, test} from "../../fixtures";

// Serial — see debts.spec.ts's comment. Every action here is a client-side blob download,
// CSV or PDF alike (see ReportsPage.ts) — no mutations, so cross-test data isolation isn't
// a concern the way it is for the CRUD-heavy regression files.
test.describe.configure({ mode: "serial" });

test.describe("Reports", () => {
  test("Monthly tab downloads a CSV named for the selected period @regression", async ({ reportsPage }) => {
    await reportsPage.gotoReports();
    await reportsPage.expectLoaded();
    const download = await reportsPage.downloadMonthlyCsv();
    expect(download.suggestedFilename()).toMatch(/^WealthyNest-\d{4}-\d{2}-Monthly\.csv$/);
  });

  test("Monthly tab's PDF button downloads a PDF named for the selected period @regression", async ({ reportsPage }) => {
    await reportsPage.gotoReports();
    const download = await reportsPage.downloadMonthlyPdf();
    expect(download.suggestedFilename()).toMatch(/^WealthyNest-\d{4}-\d{2}-Monthly\.pdf$/);
  });

  test("Annual tab downloads a CSV named for the selected year @regression", async ({ reportsPage }) => {
    await reportsPage.gotoReports();
    await reportsPage.selectTab("annual");
    const download = await reportsPage.downloadAnnualCsv();
    expect(download.suggestedFilename()).toMatch(/^WealthyNest-\d{4}-Annual\.csv$/);
  });

  test("Export Data tab downloads a raw expenses CSV @regression", async ({ reportsPage }) => {
    await reportsPage.gotoReports();
    await reportsPage.selectTab("export");
    const download = await reportsPage.downloadExport("expenses");
    expect(download.suggestedFilename()).toMatch(/^expenses-\d{4}\.csv$/);
  });
});
