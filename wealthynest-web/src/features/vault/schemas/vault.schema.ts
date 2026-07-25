import {z} from "zod";

export const VAULT_ITEM_TYPE_VALUES = ["LOGIN", "SECURE_NOTE"] as const;

const baseVaultItemSchema = z.object({
  itemType: z.enum(VAULT_ITEM_TYPE_VALUES, { errorMap: () => ({ message: "Type is required" }) }),
  title:    z.string().min(1, "Title is required").max(150),
  username: z.string().max(150).optional(),
  url:      z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  icon:     z.string().max(30).optional(),
  secret:   z.string().max(2000).optional(),
  totpSecret: z.string().max(200).optional(),
});

/** `requireSecret` is true when creating (a fresh item must have a value) and false when
 * editing (leaving the field blank keeps the existing encrypted secret unchanged). */
export function vaultItemSchema(requireSecret: boolean) {
  return baseVaultItemSchema.refine(
    (v) => !requireSecret || !!v.secret,
    { message: "A password or note value is required", path: ["secret"] }
  );
}

export type VaultItemFormValues = z.infer<typeof baseVaultItemSchema>;

// Discriminated on `method` so a single form/resolver can validate either shape depending on which
// step-up credential the user picked — password (always available) or PIN (only offered when the
// account has one enabled). Native biometric deliberately has no place here: see VaultServiceImpl's
// class comment for why it isn't accepted as a vault step-up credential at all.
export const revealSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("password"), currentPassword: z.string().min(1, "Enter your account password") }),
  z.object({ method: z.literal("pin"), pin: z.string().regex(/^[0-9]{4}$/, "Enter your 4-digit PIN") }),
]);

export type RevealFormValues = z.infer<typeof revealSchema>;
