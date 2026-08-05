import { describe, it, expect } from "vitest";
import { createAccountSchema, blankToUndef } from "./account.schema";

describe("blankToUndef", () => {
  it("converts an empty string to undefined", () => {
    expect(blankToUndef("")).toBeUndefined();
  });

  it("converts null to undefined", () => {
    expect(blankToUndef(null)).toBeUndefined();
  });

  it("leaves other values untouched", () => {
    expect(blankToUndef(0)).toBe(0);
    expect(blankToUndef("500")).toBe("500");
    expect(blankToUndef(undefined)).toBeUndefined();
  });
});

describe("createAccountSchema", () => {
  const baseCashWallet = {
    accountType: "CASH_WALLET" as const,
    name: "Wallet",
    openingBalance: 1000,
  };

  it("accepts a minimal valid cash wallet", () => {
    expect(createAccountSchema.safeParse(baseCashWallet).success).toBe(true);
  });

  it("rejects a blank name", () => {
    expect(createAccountSchema.safeParse({ ...baseCashWallet, name: "" }).success).toBe(false);
  });

  it("rejects a negative opening balance", () => {
    expect(createAccountSchema.safeParse({ ...baseCashWallet, openingBalance: -1 }).success).toBe(false);
  });

  it("accepts a zero opening balance", () => {
    expect(createAccountSchema.safeParse({ ...baseCashWallet, openingBalance: 0 }).success).toBe(true);
  });

  it("rejects an unrecognized accountType", () => {
    const result = createAccountSchema.safeParse({ ...baseCashWallet, accountType: "CRYPTO" });
    expect(result.success).toBe(false);
  });

  // The exact bug documented in feedback_frontend_form_gotchas: the API returns null (not
  // undefined) for unset optional fields, so an edit-mode form pre-filled from a real API
  // response must not fail validation just because accountNumber/bankName/etc. came back null.
  it("treats a null bankName/accountNumber (as returned by the API for an unset field) as absent, not invalid", () => {
    const result = createAccountSchema.safeParse({ ...baseCashWallet, bankName: null, accountNumber: null });
    expect(result.success).toBe(true);
  });

  it("treats an empty-string numeric field (a blanked-out native number input) as absent, not zero", () => {
    // Without blankToUndef preprocessing, "" would coerce to 0 and silently fail .positive().
    const result = createAccountSchema.safeParse({ ...baseCashWallet, creditLimit: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.creditLimit).toBeUndefined();
  });

  it("rejects a creditLimit of 0 when one is actually provided (must be positive)", () => {
    const result = createAccountSchema.safeParse({ ...baseCashWallet, creditLimit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a statementDay/paymentDueDay outside 1-28", () => {
    expect(createAccountSchema.safeParse({ ...baseCashWallet, statementDay: 0 }).success).toBe(false);
    expect(createAccountSchema.safeParse({ ...baseCashWallet, statementDay: 29 }).success).toBe(false);
    expect(createAccountSchema.safeParse({ ...baseCashWallet, statementDay: 15 }).success).toBe(true);
  });

  it("rejects an apr outside 0-100", () => {
    expect(createAccountSchema.safeParse({ ...baseCashWallet, apr: -1 }).success).toBe(false);
    expect(createAccountSchema.safeParse({ ...baseCashWallet, apr: 101 }).success).toBe(false);
  });

  describe("LOAN-specific superRefine: loanType is required only for LOAN accounts", () => {
    const baseLoan = {
      accountType: "LOAN" as const,
      name: "Car Loan",
      openingBalance: 500000,
    };

    it("rejects a LOAN account with no loanType", () => {
      const result = createAccountSchema.safeParse(baseLoan);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.loanType).toContain("Loan type is required");
      }
    });

    it("accepts a LOAN account once loanType is set", () => {
      const result = createAccountSchema.safeParse({ ...baseLoan, loanType: "CAR_LOAN" });
      expect(result.success).toBe(true);
    });

    it("does not require loanType for a non-LOAN account type", () => {
      expect(createAccountSchema.safeParse(baseCashWallet).success).toBe(true);
    });

    it("treats a blanked-out (empty string) loanType on a LOAN account the same as missing", () => {
      const result = createAccountSchema.safeParse({ ...baseLoan, loanType: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("purpose superRefine", () => {
    const baseBank = { accountType: "BANK_ACCOUNT" as const, name: "Savings", openingBalance: 1000 };

    it("accepts a purpose on a BANK_ACCOUNT", () => {
      expect(createAccountSchema.safeParse({ ...baseBank, purpose: "EMERGENCY_FUND" }).success).toBe(true);
    });

    it("rejects a purpose on a non-BANK_ACCOUNT type", () => {
      const result = createAccountSchema.safeParse({ ...baseCashWallet, purpose: "EMERGENCY_FUND" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.purpose).toContain("Purpose can only be set on a Bank Account");
      }
    });

    it("rejects CUSTOM purpose with no label", () => {
      const result = createAccountSchema.safeParse({ ...baseBank, purpose: "CUSTOM" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.purposeLabel).toContain("A custom purpose needs a short label");
      }
    });

    it("accepts CUSTOM purpose once a label is provided", () => {
      const result = createAccountSchema.safeParse({ ...baseBank, purpose: "CUSTOM", purposeLabel: "Sabbatical" });
      expect(result.success).toBe(true);
    });

    it("treats a null purpose (as returned by the API for an unset field) as absent, not invalid", () => {
      const result = createAccountSchema.safeParse({ ...baseBank, purpose: null });
      expect(result.success).toBe(true);
    });
  });
});
