import { z } from "zod";

export const expenseSchema = z.object({
  categoryId:  z.string().uuid("Select a category"),
  accountId:   z.string().uuid("Select an account"),
  amount:      z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(255).optional(),
  expenseDate: z.string().min(1, "Date is required"),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
