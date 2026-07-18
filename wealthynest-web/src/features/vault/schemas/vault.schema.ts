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

export const revealSchema = z.object({
  currentPassword: z.string().min(1, "Enter your account password"),
});

export type RevealFormValues = z.infer<typeof revealSchema>;
