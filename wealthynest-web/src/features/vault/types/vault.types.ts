export type VaultItemType = "LOGIN" | "SECURE_NOTE";

export interface VaultItem {
  id:              string;
  itemType:        VaultItemType;
  title:           string;
  username?:       string;
  url?:            string;
  category?:       string;
  icon?:           string;
  favorite:        boolean;
  hasTotp:         boolean;
  lastRevealedAt?: string;
  createdAt:       string;
  updatedAt:       string;
}

export interface VaultItemPayload {
  itemType: VaultItemType;
  title:    string;
  username?: string;
  url?:      string;
  category?: string;
  icon?:     string;
  /** Plaintext password/note. Required when creating; omit on update to keep the existing secret. */
  secret?:   string;
  /** Base32 TOTP secret. Omit to leave unchanged; "" removes it; non-blank sets/replaces it. */
  totpSecret?: string;
}

export interface VaultItemSecret {
  id:          string;
  secret:      string;
  totpSecret?: string;
  /** Short-lived opt-in "trust this device" token — see useVaultTrustStore. */
  stepUpToken?: string;
}

export interface VaultHealthItemSummary {
  id:       string;
  title:    string;
  itemType: VaultItemType;
  icon?:    string;
}

export interface VaultHealthSummary {
  totalItems:    number;
  reusedCount:   number;
  weakCount:     number;
  breachedCount: number;
  reusedItems:   VaultHealthItemSummary[];
  weakItems:     VaultHealthItemSummary[];
  breachedItems: VaultHealthItemSummary[];
}
