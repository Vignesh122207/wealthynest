import {z} from "zod";

const blankToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

// Shared across all 5 investment-type forms — broker/purpose are purely descriptive metadata,
// never affecting funding math, so the same optional fields + CUSTOM-requires-label rule apply
// identically regardless of investment type.
const purposeFields = {
  broker:       z.preprocess(blankToUndef, z.string().max(50).optional()),
  purpose:      z.preprocess(blankToUndef, z.enum([
    "EMERGENCY_FUND", "RETIREMENT", "EDUCATION", "HOUSE_PURCHASE", "VEHICLE_PURCHASE",
    "VACATION", "CHILD_FUTURE", "TAX_SAVINGS", "INVESTMENT", "GENERAL_SAVINGS",
    "WEDDING", "MEDICAL", "DEBT_PAYOFF", "HOME_RENOVATION", "DAILY_SPENDING", "CUSTOM",
  ]).optional()),
  purposeLabel: z.preprocess(blankToUndef, z.string().max(100).optional()),
};

function requireCustomPurposeLabel(data: { purpose?: string; purposeLabel?: string }, ctx: z.RefinementCtx) {
  if (data.purpose === "CUSTOM" && !data.purposeLabel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["purposeLabel"], message: "A custom purpose needs a short label" });
  }
}

export const stockSchema = z.object({
  units:           z.coerce.number().positive("Quantity must be > 0"),
  avgBuyPrice:     z.coerce.number().positive("Buy price must be > 0"),
  purchaseDate:    z.string().min(1, "Purchase date required"),
  brokerage:       z.coerce.number().min(0).optional(),
  linkedAccountId: z.string().optional(),
  debitAccountId:  z.string().optional(),
  ...purposeFields,
}).superRefine(requireCustomPurposeLabel);
export type StockFormValues = z.infer<typeof stockSchema>;

export const mfSchema = z.object({
  units:           z.coerce.number().positive("Units required"),
  avgBuyPrice:     z.coerce.number().positive("Buy NAV required"),
  purchaseDate:    z.string().min(1, "Date required"),
  linkedAccountId: z.string().optional(),
  debitAccountId:  z.string().optional(),
  // Both optional fields below hit the same "" -> 0 -> fails positive()/.min(1)
  // silent-block-submit gotcha as BondForm's couponCreditDay (see that field's own comment) —
  // preprocess "" to undefined before coercion so leaving them blank actually validates as absent.
  sipAmount:       z.preprocess(v => (v === "" ? undefined : v), z.coerce.number().positive("SIP amount must be positive").optional()),
  sipDay:          z.preprocess(v => (v === "" ? undefined : v), z.coerce.number().min(1).max(31).optional()),
  ...purposeFields,
}).superRefine(requireCustomPurposeLabel);
export type MFFormValues = z.infer<typeof mfSchema>;

export const goldSchema = z.object({
  companyName:    z.string().min(1, "Name required"),
  quantityGrams:  z.coerce.number().positive("Must be > 0"),
  goldKarat:      z.coerce.number().int().refine(v => [18, 22, 24].includes(v), "Select 18K, 22K, or 24K"),
  avgBuyPrice:    z.coerce.number().positive("Buy price per gram required"),
  purchaseDate:   z.string().min(1, "Date required"),
  debitAccountId: z.string().optional(),
  ...purposeFields,
}).superRefine(requireCustomPurposeLabel);
export type GoldFormValues = z.infer<typeof goldSchema>;

export const fdSchema = z.object({
  bankName:             z.string().min(1, "Bank name required"),
  investedAmount:       z.coerce.number().positive("Principal required"),
  couponRate:           z.coerce.number().positive("Rate required").max(50),
  purchaseDate:         z.string().min(1, "Start date required"),
  maturityDate:         z.string().min(1, "Maturity date required"),
  compoundingFrequency: z.string().default("QUARTERLY"),
  linkedAccountId:      z.string().optional(),
  debitAccountId:       z.string().optional(),
  ...purposeFields,
}).superRefine(requireCustomPurposeLabel);
export type FDFormValues = z.infer<typeof fdSchema>;

export const bondSchema = z.object({
  companyName:      z.string().min(1, "Bond name required"),
  faceValuePerBond: z.coerce.number().positive("Face value required"),
  quantity:         z.coerce.number().positive("Quantity required"),
  totalInvested:    z.coerce.number().positive("Total invested required"),
  couponRate:       z.coerce.number().positive("Rate required").max(30),
  couponFrequency:  z.string().default("HALF_YEARLY"),
  // Empty input on this optional field arrives as "" from the uncontrolled register; plain
  // z.coerce.number() would turn that into 0, which fails .min(1) and silently blocks submit
  // (BondForm doesn't render an error for this field). Preprocess "" to undefined first.
  couponCreditDay:  z.preprocess(v => (v === "" ? undefined : v), z.coerce.number().min(1).max(31).optional()),
  tdsRate:          z.coerce.number().min(0).max(30).optional(),
  purchaseDate:     z.string().min(1, "Purchase date required"),
  maturityDate:     z.string().optional(),
  linkedAccountId:  z.string().optional(),
  debitAccountId:   z.string().optional(),
  ...purposeFields,
}).superRefine(requireCustomPurposeLabel);
export type BondFormValues = z.infer<typeof bondSchema>;

export const sipSchema = z.object({
  transactionDate: z.string().min(1, "Date required"),
  amount:          z.coerce.number().positive("Amount required"),
  units:           z.string().optional(),
  nav:             z.string().optional(),
});
export type SipFormValues = z.infer<typeof sipSchema>;

export const stockTxnSchema = (isBuy: boolean, maxQty?: number) => z.object({
  transactionDate: z.string().min(1, "Date required"),
  quantity:        z.coerce.number().positive("Must be > 0")
                     .refine(v => isBuy || maxQty == null || v <= maxQty,
                       { message: `Cannot sell more than ${maxQty?.toFixed(2)} shares held` }),
  pricePerShare:   z.coerce.number().positive("Must be > 0"),
  brokerage:       z.coerce.number().min(0).optional(),
  accountId:       z.string().optional(),
});
export type StockTxnFormValues = z.infer<ReturnType<typeof stockTxnSchema>>;
