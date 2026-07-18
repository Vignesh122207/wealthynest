import {z} from "zod";

export const debtSchema = z.object({
  contactName:  z.string().min(1, "Name is required").max(100),
  contactPhone: z.string().max(20).optional().or(z.literal("")),
  amount:       z.coerce.number().positive("Amount must be positive"),
  description:  z.string().max(200).optional().or(z.literal("")),
  debtDate:     z.string().min(1, "Date is required"),
  dueDate:      z.string().optional().or(z.literal("")),
}).superRefine((v, ctx) => {
  if (v.dueDate && new Date(v.dueDate) < new Date(v.debtDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date can't be before the debt date", path: ["dueDate"] });
  }
});

// z.input (pre-coercion), not z.infer (output): `amount` is z.coerce.number(), and the form
// needs to allow a genuinely blank field on a new debt rather than a stray `0` default.
export type DebtFormValues = z.input<typeof debtSchema>;
