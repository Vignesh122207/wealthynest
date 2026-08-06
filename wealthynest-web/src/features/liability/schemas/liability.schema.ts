import {z} from "zod";

export const LIABILITY_TYPE_VALUES = [
  "HOME_LOAN", "CAR_LOAN", "PERSONAL_LOAN", "CREDIT_CARD", "EDUCATION_LOAN", "GOLD_LOAN", "BUSINESS_LOAN", "OTHER",
] as const;

// Native number inputs yield "" (not undefined) when left blank, which z.coerce.number() turns
// into 0 — silently passing an optional field's validation as "0" instead of "not provided". See
// account.schema.ts's blankToUndef (same helper, duplicated here to avoid a cross-feature import).
const blankToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

export const liabilitySchema = z.object({
  name:              z.string().min(1, "Name is required").max(100),
  liabilityType:     z.enum(LIABILITY_TYPE_VALUES, { errorMap: () => ({ message: "Type is required" }) }),
  // .positive(), not .min(0): a blank input coerces to 0, which needs to fail here so the error
  // lands on this field — previously it passed silently and the outstandingAmount<=principalAmount
  // refine below blamed outstandingAmount instead, even though the user never touched it.
  principalAmount:   z.coerce.number().positive("Original loan amount is required"),
  outstandingAmount: z.coerce.number().min(0, "Must be 0 or more"),
  interestRate:      z.preprocess(blankToUndef, z.coerce.number().min(0).max(100).optional()),
  lenderName:        z.string().max(100).optional(),
  emiAmount:         z.preprocess(blankToUndef, z.coerce.number().min(0).optional()),
  startDate:         z.string().optional(),
  endDate:           z.string().optional(),
  notes:             z.string().optional(),
}).refine(
  d => Number(d.outstandingAmount) <= Number(d.principalAmount),
  { message: "Cannot exceed original loan amount", path: ["outstandingAmount"] },
);

export type LiabilityFormValues = z.infer<typeof liabilitySchema>;
