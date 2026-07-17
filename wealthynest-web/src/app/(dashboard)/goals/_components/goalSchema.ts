import { z } from "zod";

export const goalSchema = z.object({
  name:         z.string().min(1, "Name is required").max(100),
  targetAmount: z.coerce.number().positive("Must be a positive amount"),
  savedAmount:  z.coerce.number().min(0, "Cannot be negative").default(0),
  targetDate:   z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.savedAmount > 0 && v.savedAmount > v.targetAmount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Saved amount cannot exceed the target amount", path: ["savedAmount"] });
  }
});
// The form's pre-submit shape (z.input, not z.infer/output) — targetAmount/savedAmount are
// `z.coerce.number()`, so their input type allows undefined/"" for a genuinely blank field on a
// new goal, while zodResolver still coerces and validates to plain numbers on submit.
export type GoalFormValues = z.input<typeof goalSchema>;
