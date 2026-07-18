import {z} from "zod";

export const LIABILITY_TYPE_VALUES = [
  "HOME_LOAN", "CAR_LOAN", "PERSONAL_LOAN", "CREDIT_CARD", "EDUCATION_LOAN", "GOLD_LOAN", "BUSINESS_LOAN", "OTHER",
] as const;

export const liabilitySchema = z.object({
  name:              z.string().min(1, "Name is required").max(100),
  liabilityType:     z.enum(LIABILITY_TYPE_VALUES, { errorMap: () => ({ message: "Type is required" }) }),
  principalAmount:   z.coerce.number().min(0, "Must be 0 or more"),
  outstandingAmount: z.coerce.number().min(0, "Must be 0 or more"),
  interestRate:      z.coerce.number().min(0).max(100).optional(),
  lenderName:        z.string().max(100).optional(),
  emiAmount:         z.coerce.number().min(0).optional(),
  startDate:         z.string().optional(),
  endDate:           z.string().optional(),
  notes:             z.string().optional(),
}).refine(
  d => Number(d.outstandingAmount) <= Number(d.principalAmount),
  { message: "Cannot exceed original loan amount", path: ["outstandingAmount"] },
);

export type LiabilityFormValues = z.infer<typeof liabilitySchema>;
