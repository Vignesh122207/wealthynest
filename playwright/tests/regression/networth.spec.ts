import {test} from "../../fixtures";
import {randomAsset, randomLiability} from "../../test-data/factory";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/.
test.describe.configure({ mode: "serial" });

test.describe("Net Worth", () => {
  test("creates an asset and edits its value @regression", async ({ netWorthPage }) => {
    const asset = randomAsset();
    await netWorthPage.gotoNetWorth();
    await netWorthPage.createAsset({ name: asset.name, assetType: "REAL_ESTATE", currentValue: asset.currentValue });
    await netWorthPage.expectAssetVisible(asset.name);

    await netWorthPage.editAssetValue(asset.name, asset.currentValue + 100000);
    await netWorthPage.expectAssetVisible(asset.name);
  });

  test("deletes an asset @regression", async ({ netWorthPage }) => {
    const asset = randomAsset();
    await netWorthPage.gotoNetWorth();
    await netWorthPage.createAsset({ name: asset.name, assetType: "GOLD_JEWELRY", currentValue: asset.currentValue });
    await netWorthPage.expectAssetVisible(asset.name);

    await netWorthPage.deleteAsset(asset.name);
    await netWorthPage.expectAssetNotVisible(asset.name);
  });

  test("creates a liability and deletes it @regression", async ({ netWorthPage }) => {
    const liability = randomLiability();
    await netWorthPage.gotoNetWorth();
    await netWorthPage.createLiability({
      name: liability.name, liabilityType: "PERSONAL_LOAN",
      outstandingAmount: liability.outstandingAmount, principalAmount: liability.principalAmount,
    });
    await netWorthPage.expectLiabilityVisible(liability.name);

    await netWorthPage.deleteLiability(liability.name);
    await netWorthPage.expectLiabilityNotVisible(liability.name);
  });
});
