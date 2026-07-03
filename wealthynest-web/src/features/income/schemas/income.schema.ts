import { z } from "zod";

export const incomeSchema = z.object({
  source:      z.enum(["SALARY","FREELANCE","BUSINESS","RENTAL","BONUS","INTEREST","DIVIDEND","OTHER"]),
  paymentMode: z.enum(["CASH","BANK_ACCOUNT"]).default("BANK_ACCOUNT"),
  amount:      z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(255).optional(),
  incomeDate:  z.string().min(1, "Date is required"),
  periodMonth: z.coerce.number().min(1).max(12),
  periodYear:  z.coerce.number().min(2020),
});

export type IncomeFormValues = z.infer<typeof incomeSchema>;
