export interface LifecycleStatusMetaEntry {
  label: string;
  chipClass: string;
}

// ACTIVE renders no badge at all (the default, unremarkable state) — CLOSED and ARCHIVED are the
// two states worth calling out on an account/investment card.
export const LIFECYCLE_STATUS_META: Record<string, LifecycleStatusMetaEntry> = {
  CLOSED:   { label: "Closed",   chipClass: "text-muted-foreground bg-muted border border-border" },
  ARCHIVED: { label: "Archived", chipClass: "text-muted-foreground bg-muted border border-border" },
};

/** Null for ACTIVE (or an unrecognized/missing status) — nothing to badge. */
export function getLifecycleStatusMeta(status: string | null | undefined): LifecycleStatusMetaEntry | null {
  if (!status || status === "ACTIVE") return null;
  return LIFECYCLE_STATUS_META[status] ?? null;
}
