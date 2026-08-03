import { describe, it, expect } from "vitest";
import { transferFormSchema, transferEditSchema } from "./TransferFormModal";

// Regression coverage for a real bug: a "Balance Adjustment" (or debt) transfer is stored
// one-sided on the backend — adjustBalance() sets fromAccountId or toAccountId to null — which
// the edit form defaulted to "" client-side. The edit modal never renders account pickers (accounts
// can't be changed there), so that empty string had no field left to fix it. Validating
// fromAccountId/toAccountId as required in edit mode silently blocked every edit — even changing
// just the date or description — with no visible error.
describe("transferFormSchema (create)", () => {
  const valid = {
    fromAccountId: "acc-1",
    toAccountId:   "acc-2",
    amount:        100,
    transferDate:  "2026-07-15",
    description:   "",
  };

  it("accepts a fully-specified transfer", () => {
    expect(transferFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty fromAccountId", () => {
    expect(transferFormSchema.safeParse({ ...valid, fromAccountId: "" }).success).toBe(false);
  });

  it("rejects an empty toAccountId", () => {
    expect(transferFormSchema.safeParse({ ...valid, toAccountId: "" }).success).toBe(false);
  });
});

describe("transferEditSchema (edit)", () => {
  const oneSidedAdjustment = {
    fromAccountId: "",
    toAccountId:   "acc-2",
    amount:        100,
    transferDate:  "2026-07-15",
    description:   "Balance Adjustment",
  };

  it("accepts a one-sided balance-adjustment transfer with an empty fromAccountId", () => {
    expect(transferEditSchema.safeParse(oneSidedAdjustment).success).toBe(true);
  });

  it("accepts a one-sided transfer with an empty toAccountId", () => {
    expect(transferEditSchema.safeParse({ ...oneSidedAdjustment, fromAccountId: "acc-1", toAccountId: "" }).success).toBe(true);
  });

  it("still requires a transfer date", () => {
    expect(transferEditSchema.safeParse({ ...oneSidedAdjustment, transferDate: "" }).success).toBe(false);
  });

  it("still requires a positive amount", () => {
    expect(transferEditSchema.safeParse({ ...oneSidedAdjustment, amount: 0 }).success).toBe(false);
  });
});
