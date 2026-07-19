import {test} from "../../fixtures";
import {faker} from "@faker-js/faker";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/.
test.describe.configure({ mode: "serial" });

test.describe("Support", () => {
  test("creates a support ticket and it appears in My Tickets @regression", async ({ supportPage }) => {
    const subject = `E2E ticket ${faker.string.alphanumeric(6)}`;
    await supportPage.gotoNewTicket();
    await supportPage.createTicket({ subject, description: faker.lorem.sentence(12) });
    await supportPage.expectTicketVisible(subject);

    await supportPage.gotoTickets();
    await supportPage.expectTicketVisible(subject);
  });

  test("FAQ accordion expands to reveal an answer @regression", async ({ supportPage }) => {
    await supportPage.gotoFaq();
    await supportPage.toggleFaq("How do I add a family member?");
    await supportPage.expectFaqAnswerVisible(/unique invite code/);
  });

  test("Contact page links to FAQ and My Tickets @regression", async ({ supportPage }) => {
    await supportPage.gotoContact();
    await supportPage.expectEmailVisible("support@wealthynest.in");
    await supportPage.clickFaqLink();
  });
});
