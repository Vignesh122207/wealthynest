import { describe, it, expect } from "vitest";
import { stockSchema, mfSchema, goldSchema, fdSchema, bondSchema, sipSchema, stockTxnSchema } from "./investment.schema";

describe("stockSchema", () => {
  const base = { units: 10, avgBuyPrice: 2500, purchaseDate: "2026-01-01" };

  it("accepts a minimal valid stock", () => {
    expect(stockSchema.safeParse(base).success).toBe(true);
  });

  it("rejects non-positive units or avgBuyPrice", () => {
    expect(stockSchema.safeParse({ ...base, units: 0 }).success).toBe(false);
    expect(stockSchema.safeParse({ ...base, avgBuyPrice: 0 }).success).toBe(false);
  });

  it("rejects a blank purchaseDate", () => {
    expect(stockSchema.safeParse({ ...base, purchaseDate: "" }).success).toBe(false);
  });

  it("rejects a negative brokerage", () => {
    expect(stockSchema.safeParse({ ...base, brokerage: -1 }).success).toBe(false);
  });
});

describe("mfSchema", () => {
  const base = { units: 100, avgBuyPrice: 25.5, purchaseDate: "2026-01-01" };

  it("accepts a minimal valid mutual fund", () => {
    expect(mfSchema.safeParse(base).success).toBe(true);
  });

  it("rejects non-positive units", () => {
    expect(mfSchema.safeParse({ ...base, units: 0 }).success).toBe(false);
  });

  it("treats an empty-string sipAmount as absent, not 0 (which would fail .positive())", () => {
    const result = mfSchema.safeParse({ ...base, sipAmount: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sipAmount).toBeUndefined();
  });

  it("rejects a non-positive sipAmount when provided", () => {
    expect(mfSchema.safeParse({ ...base, sipAmount: 0 }).success).toBe(false);
  });

  it("treats an empty-string sipDay as absent, not 0 (which would fail .min(1))", () => {
    const result = mfSchema.safeParse({ ...base, sipDay: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sipDay).toBeUndefined();
  });
});

describe("goldSchema", () => {
  const base = {
    companyName: "Local Jeweller",
    quantityGrams: 10,
    goldKarat: 22,
    avgBuyPrice: 6000,
    purchaseDate: "2026-01-01",
  };

  it("accepts a minimal valid gold entry", () => {
    expect(goldSchema.safeParse(base).success).toBe(true);
  });

  it("accepts 18K, 22K, and 24K", () => {
    expect(goldSchema.safeParse({ ...base, goldKarat: 18 }).success).toBe(true);
    expect(goldSchema.safeParse({ ...base, goldKarat: 24 }).success).toBe(true);
  });

  it("rejects a karat outside 18/22/24", () => {
    expect(goldSchema.safeParse({ ...base, goldKarat: 20 }).success).toBe(false);
  });

  it("rejects a blank companyName", () => {
    expect(goldSchema.safeParse({ ...base, companyName: "" }).success).toBe(false);
  });
});

describe("fdSchema", () => {
  const base = {
    bankName: "HDFC",
    investedAmount: 100000,
    couponRate: 7,
    purchaseDate: "2026-01-01",
    maturityDate: "2027-01-01",
  };

  it("accepts a minimal valid FD, defaulting compoundingFrequency to QUARTERLY", () => {
    const result = fdSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.compoundingFrequency).toBe("QUARTERLY");
  });

  it("rejects a couponRate above 50", () => {
    expect(fdSchema.safeParse({ ...base, couponRate: 51 }).success).toBe(false);
  });

  it("rejects a non-positive investedAmount", () => {
    expect(fdSchema.safeParse({ ...base, investedAmount: 0 }).success).toBe(false);
  });

  it("rejects a blank maturityDate", () => {
    expect(fdSchema.safeParse({ ...base, maturityDate: "" }).success).toBe(false);
  });
});

describe("bondSchema", () => {
  const base = {
    companyName: "Test Bond Ltd",
    faceValuePerBond: 1000,
    quantity: 10,
    totalInvested: 10000,
    couponRate: 8,
    purchaseDate: "2026-01-01",
  };

  it("accepts a minimal valid bond, defaulting couponFrequency to HALF_YEARLY", () => {
    const result = bondSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponFrequency).toBe("HALF_YEARLY");
  });

  it("rejects a couponRate above 30", () => {
    expect(bondSchema.safeParse({ ...base, couponRate: 31 }).success).toBe(false);
  });

  it("treats an empty-string couponCreditDay as absent, not 0 (which would fail .min(1))", () => {
    const result = bondSchema.safeParse({ ...base, couponCreditDay: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponCreditDay).toBeUndefined();
  });

  it("rejects a couponCreditDay outside 1-31 when provided", () => {
    expect(bondSchema.safeParse({ ...base, couponCreditDay: 32 }).success).toBe(false);
    expect(bondSchema.safeParse({ ...base, couponCreditDay: 0 }).success).toBe(false);
  });

  it("rejects a tdsRate outside 0-30", () => {
    expect(bondSchema.safeParse({ ...base, tdsRate: 31 }).success).toBe(false);
  });
});

describe("sipSchema", () => {
  it("accepts a minimal valid SIP transaction", () => {
    expect(sipSchema.safeParse({ transactionDate: "2026-01-01", amount: 5000 }).success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(sipSchema.safeParse({ transactionDate: "2026-01-01", amount: 0 }).success).toBe(false);
  });
});

describe("stockTxnSchema", () => {
  const base = { transactionDate: "2026-01-01", quantity: 5, pricePerShare: 2500 };

  it("isBuy=true: accepts any positive quantity regardless of maxQty", () => {
    expect(stockTxnSchema(true, 3).safeParse(base).success).toBe(true);
  });

  it("isBuy=false: rejects a sell quantity exceeding maxQty held", () => {
    const result = stockTxnSchema(false, 3).safeParse(base);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.quantity?.[0]).toContain("Cannot sell more than");
    }
  });

  it("isBuy=false: accepts a sell quantity within maxQty held", () => {
    expect(stockTxnSchema(false, 10).safeParse(base).success).toBe(true);
  });

  it("isBuy=false with no maxQty specified: any positive quantity is accepted", () => {
    expect(stockTxnSchema(false, undefined).safeParse(base).success).toBe(true);
  });

  it("rejects a non-positive quantity or pricePerShare", () => {
    expect(stockTxnSchema(true).safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(stockTxnSchema(true).safeParse({ ...base, pricePerShare: 0 }).success).toBe(false);
  });
});
