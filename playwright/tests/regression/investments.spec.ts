import {test} from "../../fixtures";
import {randomFixedDeposit, randomBond} from "../../test-data/factory";
import {faker} from "@faker-js/faker";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/.
test.describe.configure({ mode: "serial" });

test.describe("Investments", () => {
  test("creates a Fixed Deposit @regression", async ({ investmentsPage }) => {
    const today = new Date().toISOString().split("T")[0];
    const fd = randomFixedDeposit(today);
    await investmentsPage.gotoInvestments();
    await investmentsPage.createFixedDeposit(fd);
    await investmentsPage.expectInvestmentVisible(fd.bankName);
  });

  test("creates a Gold investment @regression", async ({ investmentsPage }) => {
    const today = new Date().toISOString().split("T")[0];
    const description = `E2E Gold ${faker.string.alphanumeric(6)}`;
    await investmentsPage.gotoInvestments();
    await investmentsPage.createGold({
      description, quantityGrams: 10, buyPricePerGram: 6200, purchaseDate: today,
    });
    await investmentsPage.expectInvestmentVisible(description);
  });

  test("deletes an investment @regression", async ({ investmentsPage }) => {
    const today = new Date().toISOString().split("T")[0];
    const description = `E2E Gold Delete ${faker.string.alphanumeric(6)}`;
    await investmentsPage.gotoInvestments();
    await investmentsPage.createGold({
      description, quantityGrams: 5, buyPricePerGram: 6200, purchaseDate: today,
    });
    await investmentsPage.expectInvestmentVisible(description);

    await investmentsPage.deleteInvestment(description);
    await investmentsPage.expectInvestmentNotVisible(description);
  });

  test("Gold tab shows only gold investments @regression", async ({ investmentsPage }) => {
    const today = new Date().toISOString().split("T")[0];
    const description = `E2E Gold Tab ${faker.string.alphanumeric(6)}`;
    await investmentsPage.gotoInvestments();
    await investmentsPage.createGold({
      description, quantityGrams: 8, buyPricePerGram: 6200, purchaseDate: today,
    });

    await investmentsPage.gotoTab("gold");
    await investmentsPage.expectInvestmentVisible(description);
  });

  test("creates a Bond investment @regression", async ({ investmentsPage }) => {
    const today = new Date().toISOString().split("T")[0];
    const bond = randomBond(today);
    await investmentsPage.gotoInvestments();
    await investmentsPage.createBond(bond);
    await investmentsPage.expectInvestmentVisible(bond.companyName);
  });

  test("Bonds tab shows only bond investments @regression", async ({ investmentsPage }) => {
    const today = new Date().toISOString().split("T")[0];
    const bond = randomBond(today);
    await investmentsPage.gotoInvestments();
    await investmentsPage.createBond(bond);

    await investmentsPage.gotoTab("bonds");
    await investmentsPage.expectInvestmentVisible(bond.companyName);
  });

  // Stock/MF creation goes through LiveSearch, which queries real NSE/BSE (stocks) or MFAPI (MF)
  // data via the backend — a genuine flaky-in-CI risk (result availability/matching isn't under
  // this suite's control), which is why this coverage was skipped for a long time (see the
  // README's "Known gaps"). Sidestepped here the same way CAS Import sidesteps PDF-parsing
  // flakiness: intercept the network call itself (mockStockSearch/mockMfSearch) with a canned,
  // deterministic result instead of depending on a real external service being up and returning
  // a matching result for whatever query string this test happens to send.
  test("creates a Stock investment via a mocked live search result @regression", async ({ investmentsPage }) => {
    const today = new Date().toISOString().split("T")[0];
    const name = `E2E Test Stock ${faker.string.alphanumeric(6)}`;
    const symbol = `E2E${faker.string.alphanumeric(4).toUpperCase()}`;
    await investmentsPage.gotoInvestments();
    await investmentsPage.mockStockSearch([{ symbol, name, exchange: "NSE" }]);
    await investmentsPage.createStock({ searchQuery: name, units: 10, avgBuyPrice: 250, purchaseDate: today });
    await investmentsPage.expectInvestmentVisible(name);
  });

  test("creates a Mutual Fund investment via a mocked live search result @regression", async ({ investmentsPage }) => {
    const today = new Date().toISOString().split("T")[0];
    const name = `E2E Test Fund ${faker.string.alphanumeric(6)} Direct Growth`;
    const schemeCode = faker.string.numeric(6);
    await investmentsPage.gotoInvestments();
    await investmentsPage.mockMfSearch([{ name, schemeCode }]);
    await investmentsPage.createMutualFund({ searchQuery: name, units: 100, avgBuyPrice: 45, purchaseDate: today });
    await investmentsPage.expectInvestmentVisible(name);
  });
});
