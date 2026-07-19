import {test} from "../../fixtures";
import {faker} from "@faker-js/faker";
import {seedDividendCorporateAction} from "../../helpers/auth.helper";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/.
//
// Dividend suggestions (InvestmentServiceImpl.getDividendSuggestions) need an NseCorporateAction
// row for a symbol the user actually holds, with an ex-date after the stock's purchase date and a
// positive dividend-per-share — that table is normally populated by a scheduled job pulling real
// NSE data, with no create/seed API, so this seeds one directly via seedDividendCorporateAction
// (see its own comment on why direct DB access, not a live dependency, is the right call here —
// same reasoning as investments.spec.ts's mocked LiveSearch results). The stock itself is created
// through the same mocked-LiveSearch path investments.spec.ts uses, so this file doesn't depend on
// real NSE/BSE search data either.
function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

test.describe.configure({ mode: "serial" });

test.describe("Dividend suggestions", () => {
  test("shows a dividend suggestion for a held stock and logs it as income @regression", async ({ investmentsPage }) => {
    const symbol = `E2EDIV${faker.string.alphanumeric(4).toUpperCase()}`;
    const name = `E2E Dividend Stock ${faker.string.alphanumeric(6)}`;
    const purchaseDate = pastDate(30);
    const exDate = pastDate(1);

    await investmentsPage.gotoInvestments();
    await investmentsPage.mockStockSearch([{ symbol, name, exchange: "NSE" }]);
    await investmentsPage.createStock({ searchQuery: name, units: 10, avgBuyPrice: 200, purchaseDate });

    await seedDividendCorporateAction({ symbol, exDate, dividendPerShare: 5 });

    // Fresh navigation so useDividendSuggestions' query fires after the corp-action row landed —
    // it isn't invalidated by the direct-DB insert above (the client has no way to know).
    await investmentsPage.gotoInvestments();
    await investmentsPage.gotoTab("stocks");
    await investmentsPage.expectDividendSuggestionVisible(symbol);

    await investmentsPage.logDividendSuggestion(symbol);
    await investmentsPage.expectDividendSuggestionNotVisible(symbol);
  });

  test("dismisses a dividend suggestion permanently @regression", async ({ investmentsPage }) => {
    const symbol = `E2EDIV${faker.string.alphanumeric(4).toUpperCase()}`;
    const name = `E2E Dividend Dismiss Stock ${faker.string.alphanumeric(6)}`;
    const purchaseDate = pastDate(30);
    const exDate = pastDate(1);

    await investmentsPage.gotoInvestments();
    await investmentsPage.mockStockSearch([{ symbol, name, exchange: "NSE" }]);
    await investmentsPage.createStock({ searchQuery: name, units: 5, avgBuyPrice: 300, purchaseDate });

    await seedDividendCorporateAction({ symbol, exDate, dividendPerShare: 8 });

    await investmentsPage.gotoInvestments();
    await investmentsPage.gotoTab("stocks");
    await investmentsPage.expectDividendSuggestionVisible(symbol);

    await investmentsPage.dismissDividendSuggestion(symbol);
    await investmentsPage.expectDividendSuggestionNotVisible(symbol);

    // Dismissal is permanent (DismissedDividendRepository), not just a client-side hide — a
    // fresh reload must not bring the suggestion back.
    await investmentsPage.gotoInvestments();
    await investmentsPage.gotoTab("stocks");
    await investmentsPage.expectDividendSuggestionNotVisible(symbol);
  });
});
