import {z} from "zod";

/** A factory, not a static schema — a linked goal's savedAmount is a snapshot of the linked
 * account's live balance (see GoalServiceImpl's own matching comment), not a user-typed figure,
 * and that balance can perfectly validly already exceed the target (the goal simply starts
 * complete). `isLinked` skips the cap for exactly that case; an unlinked, manually-tracked goal
 * still gets the instant client-side check. GoalForm calls this fresh on every render with its
 * current accountId state, so zodResolver always validates against the right variant. */
export function goalSchema(isLinked: boolean) {
  return z.object({
    name:         z.string().min(1, "Name is required").max(100),
    targetAmount: z.coerce.number().positive("Must be a positive amount"),
    savedAmount:  z.coerce.number().min(0, "Cannot be negative").default(0),
    targetDate:   z.string().optional(),
  }).superRefine((v, ctx) => {
    if (!isLinked && v.savedAmount > 0 && v.savedAmount > v.targetAmount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Saved amount cannot exceed the target amount", path: ["savedAmount"] });
    }
  });
}
// The form's pre-submit shape (z.input, not z.infer/output) — targetAmount/savedAmount are
// `z.coerce.number()`, so their input type allows undefined/"" for a genuinely blank field on a
// new goal, while zodResolver still coerces and validates to plain numbers on submit. Both
// isLinked variants share the same field shape, so either one is fine as the type source.
export type GoalFormValues = z.input<ReturnType<typeof goalSchema>>;
