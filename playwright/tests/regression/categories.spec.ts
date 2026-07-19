import {test} from "../../fixtures";
import {randomCategoryName} from "../../test-data/factory";

// Serial — see debts.spec.ts's comment.
test.describe.configure({ mode: "serial" });

test.describe("Settings — Categories", () => {
  test("creates a custom expense category and deletes it @regression", async ({ categoriesPage }) => {
    const name = randomCategoryName();
    await categoriesPage.gotoCategories();
    await categoriesPage.switchTab("EXPENSE");
    await categoriesPage.createCategory("EXPENSE", name);
    await categoriesPage.expectCategoryVisible(name);

    await categoriesPage.deleteCategory(name);
    await categoriesPage.expectCategoryNotVisible(name);
  });

  test("creates a custom income category and deletes it @regression", async ({ categoriesPage }) => {
    const name = randomCategoryName();
    await categoriesPage.gotoCategories();
    await categoriesPage.switchTab("INCOME");
    await categoriesPage.createCategory("INCOME", name);
    await categoriesPage.expectCategoryVisible(name);

    await categoriesPage.deleteCategory(name);
    await categoriesPage.expectCategoryNotVisible(name);
  });
});
