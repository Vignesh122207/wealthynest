import {z} from "zod";

export const expenseSchema = z.object({
  categoryId:  z.string().uuid("Select a category"),
  accountId:   z.string().uuid("Select an account"),
  amount:      z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(255).optional(),
  // Backend-supported but unbounded there too (CreateExpenseRequest.notes has no @Size) — matches
  // Asset/Liability's own free-text notes field.
  notes:       z.string().optional(),
  expenseDate: z.string().min(1, "Date is required"),
  // Opt-in — set only when the user taps "Add current location" in the form (browser Geolocation
  // API), never captured automatically. Raw coordinates only, no reverse geocoding/embedded map.
  latitude:    z.number().min(-90).max(90).optional(),
  longitude:   z.number().min(-180).max(180).optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
