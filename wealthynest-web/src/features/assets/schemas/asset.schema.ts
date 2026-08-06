import {z} from "zod";

export const ASSET_TYPE_VALUES = [
  "BANK_ACCOUNT", "CASH", "STOCK", "MUTUAL_FUND", "BOND", "GOLD",
  "REAL_ESTATE", "VEHICLE", "GOLD_JEWELRY", "BUSINESS_EQUITY", "EPF_PPF", "RECEIVABLES", "OTHER",
] as const;

export const assetSchema = z.object({
  name:          z.string().min(1, "Name is required").max(100),
  assetType:     z.enum(ASSET_TYPE_VALUES, { errorMap: () => ({ message: "Type is required" }) }),
  currentValue:  z.coerce.number().min(0, "Value must be 0 or more"),
  institution:   z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  notes:         z.string().optional(),
  asOfDate:      z.string().optional(),
});

export type AssetFormValues = z.infer<typeof assetSchema>;
