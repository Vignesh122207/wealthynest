import { z } from "zod";

export const budgetSchema = z.object({
  categoryId:     z.string().uuid("Select a category"),
  amount:         z.coerce.number().positive("Amount must be positive"),
  budgetType:     z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  alertThreshold: z.coerce.number().min(1).max(100).optional(),
});

export type BudgetFormValues = z.infer<typeof budgetSchema>;

export const editBudgetSchema = z.object({
  amount:         z.coerce.number().positive("Amount must be positive"),
  alertThreshold: z.coerce.number().min(1).max(100).optional(),
});

export type EditBudgetFormValues = z.infer<typeof editBudgetSchema>;
