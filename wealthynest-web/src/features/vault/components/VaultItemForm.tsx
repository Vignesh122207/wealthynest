"use client";

import {useState} from "react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Check, ChevronDown, Copy, Eye, EyeOff, FileText, KeyRound, Lock, MoreHorizontal, ShieldCheck, Sparkles} from "lucide-react";
import {toast} from "sonner";
import {FormInput} from "@/components/forms/FormInput";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {badgeTextColor, PremiumIcon} from "@/components/icons/PremiumIcon";
import {cn} from "@/lib/utils";
import {useIsDark} from "@/hooks/useIsDark";
import {getVaultCategoryColor, resolveVaultIcon, VAULT_CATEGORY_META, VAULT_ICON_OPTIONS} from "@/lib/categoryMeta";
import {type VaultItemFormValues, VAULT_SECRET_MAX_LENGTH, vaultItemSchema} from "../schemas/vault.schema";
import {estimatePasswordStrength, isNumericPin} from "../lib/passwordStrength";
import {PasswordGeneratorPanel} from "./PasswordGeneratorPanel";
import {VaultModalHeader} from "./VaultModalHeader";

// Vault's own brass/graphite accent — see VaultHealthCard's "vault door" hero for the full
// treatment this echoes. VAULT_BRASS colors icon fills/borders/small text accents (PremiumIcon
// builds its own gradient + white glyph from a hex); VAULT_BRASS_LIGHT/_DEEP are the two gradient
// stops every solid "brass" control (Save, active segments/chips) uses, paired with
// VAULT_BRASS_TEXT — a near-black brown reads better on a light gold gradient than white does.
const VAULT_BRASS = "#d4a72c";
const VAULT_BRASS_LIGHT = "#f6d776";
const VAULT_BRASS_DEEP = "#a9791a";
const VAULT_BRASS_TEXT = "#241705";

const TYPE_TABS = [
  { key: "LOGIN" as const,       label: "Login",       icon: KeyRound },
  { key: "SECURE_NOTE" as const, label: "Secure Note", icon: FileText },
];

const CATEGORY_PRESETS = ["Banking", "Work", "Social", "Email", "Shopping", "Entertainment", "Utilities"];

export function VaultItemForm({ isCreate, accentColor, defaultValues, hasExistingTotp, onSubmit, onCancel, onDelete, isPending }: {
  isCreate:       boolean;
  /** Cycled per-item by the parent page (same approach as GoalForm's goalColor) so a new
   * item's icon preview already matches the color its row will get once saved. */
  accentColor:    string;
  defaultValues?: Partial<VaultItemFormValues>;
  /** Whether the item being edited already has a TOTP secret set — drives the "Remove" affordance. */
  hasExistingTotp?: boolean;
  onSubmit:       (v: VaultItemFormValues) => void;
  onCancel:       () => void;
  onDelete?:      () => void;
  isPending:      boolean;
}) {
  const isDark = useIsDark();
  const [showSecret, setShowSecret]         = useState(isCreate);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showGenerator, setShowGenerator]   = useState(false);
  const [totpRemoved, setTotpRemoved]       = useState(false);
  const [customCategory, setCustomCategory] = useState(
    !!defaultValues?.category && !CATEGORY_PRESETS.includes(defaultValues.category)
  );
  // Tracks whether the current icon came from an explicit user pick (icon picker) rather than a
  // category's auto-derived default, so re-selecting/changing category doesn't silently overwrite
  // a choice the user actually made. An item that already has an icon when this form opens is
  // treated as "manual" too — we can't tell in general whether it was auto-derived or picked, and
  // preserving it is the safer default of the two.
  const [iconManuallySet, setIconManuallySet] = useState(!!defaultValues?.icon);

  const form = useForm<VaultItemFormValues>({
    resolver: zodResolver(vaultItemSchema(isCreate)),
    defaultValues: { itemType: "LOGIN", ...defaultValues },
  });

  const itemType = form.watch("itemType");
  const icon     = form.watch("icon");
  const category = form.watch("category");
  const secret   = form.watch("secret") ?? "";
  const isLogin  = itemType === "LOGIN";
  const showTotpAsSet = hasExistingTotp && !totpRemoved;

  const handleRemoveTotp = () => {
    setTotpRemoved(true);
    form.setValue("totpSecret", "", { shouldDirty: true });
  };
  const title    = form.watch("title");
  const strength = estimatePasswordStrength(secret);
  const previewIcon = resolveVaultIcon({ itemType, icon });
  // Recolors live as the category changes, so what's picked here already previews the color
  // this item's row will get — falls back to the parent's cycled accentColor for custom/blank
  // categories, same as VaultItemRow/page.tsx's own colorFor.
  const previewColor = getVaultCategoryColor(category, accentColor);

  const handleCopySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    toast.success("Password copied to clipboard");
  };

  return (
    <TransactionModalOverlay onDismiss={onCancel}>
      {/* no accent strip — VaultModalHeader's own banner covers this real estate; a visible
          accent line here would just be a redundant gold hairline peeking above the banner. */}
      <FormModalShell accent="none">
        <VaultModalHeader icon={previewIcon} hex={previewColor}
          title={title || (isCreate ? "New item" : "Untitled")}
          subtitle={isCreate ? "Add to vault" : "Edit item"}
          onDelete={onDelete} onClose={onCancel} />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

          {/* Type — segmented switcher, same solid-fill pill template as AccountFilterTabs */}
          <div className="flex gap-1.5">
            {TYPE_TABS.map(t => (
              <button key={t.key} type="button"
                onClick={() => form.setValue("itemType", t.key, { shouldValidate: true })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium transition-all",
                  itemType === t.key
                    ? "bg-gradient-to-br from-[#f6d776] to-[#a9791a] text-[#241705] shadow-lg shadow-[#a9791a]/30"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* Title + icon picker */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">Title</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowIconPicker(v => !v)} title="Change icon"
                className="shrink-0 rounded-2xl transition-all hover:ring-2 hover:ring-[#d4a72c]/40">
                <PremiumIcon icon={previewIcon} hex={previewColor} size="sm" />
              </button>
              <input placeholder="e.g. Gmail, HDFC NetBanking" data-testid="vault-title-input"
                aria-invalid={!!form.formState.errors.title || undefined}
                className={cn(
                  "flex-1 h-10 px-3 rounded-xl bg-muted/60 border text-sm text-foreground placeholder-muted-foreground focus:outline-none transition-colors",
                  form.formState.errors.title
                    ? "border-red-500/60 focus:border-red-500"
                    : "border-border focus:border-[#d4a72c]"
                )}
                {...form.register("title")} />
            </div>
            {form.formState.errors.title && (
              <p className="text-xs text-red-500 mt-1">{form.formState.errors.title.message}</p>
            )}
            {showIconPicker && (
              <div className="mt-2 p-3 bg-muted/40 border border-border rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Choose an icon</p>
                  {icon && (
                    <button type="button" onClick={() => { form.setValue("icon", undefined); setIconManuallySet(false); }}
                      className="text-[11px] font-medium" style={{ color: VAULT_BRASS }}>
                      Use automatic
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {VAULT_ICON_OPTIONS.map(({ key, icon: OptIcon }) => (
                    <button key={key} type="button" onClick={() => { form.setValue("icon", key); setIconManuallySet(true); }}
                      className={cn("rounded-lg transition-all", icon === key ? "ring-2 ring-offset-2 ring-offset-card" : "opacity-70 hover:opacity-100")}
                      style={icon === key ? { boxShadow: `0 0 0 2px ${VAULT_BRASS}` } : undefined}>
                      <PremiumIcon icon={OptIcon} hex={previewColor} size="xs" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isLogin && (
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Hand-rolled label (not FormInput's built-in one) so it can match the bold, full-
                  contrast field-label style used throughout this form — `htmlFor`/`id` keep the
                  same "Username / Email" accessible name the E2E suite's getByLabel relies on. */}
              <div>
                <label htmlFor="vault-username-input" className="block text-xs font-bold text-foreground mb-1.5">Username / Email</label>
                <FormInput id="vault-username-input" placeholder="you@example.com" {...form.register("username")} />
              </div>
              <div>
                <label htmlFor="vault-url-input" className="flex items-center justify-between text-xs font-bold text-foreground mb-1.5">
                  Website <span className="text-[11px] font-medium text-muted-foreground">optional</span>
                </label>
                <FormInput id="vault-url-input" placeholder="https://example.com" {...form.register("url")} />
              </div>
            </div>
          )}

          {/* Category — quick-pick chips, same template as Budgets' custom-category chips */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-foreground">
              Category <span className="text-[11px] font-medium text-muted-foreground">optional</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_PRESETS.map(c => {
                const active = !customCategory && category === c;
                const meta = VAULT_CATEGORY_META[c];
                return (
                  <button key={c} type="button"
                    onClick={() => {
                      setCustomCategory(false);
                      form.setValue("category", c, { shouldValidate: true });
                      // Only auto-apply the category's default icon when the user hasn't
                      // explicitly picked one themselves — otherwise re-selecting/changing
                      // category would silently discard that choice.
                      if (meta && !iconManuallySet) form.setValue("icon", meta.iconKey, { shouldValidate: true });
                    }}
                    className={cn(
                      "h-9 pl-1.5 pr-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 shrink-0",
                      !active && "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    style={active ? { backgroundColor: meta.color + "1c", color: badgeTextColor(meta.color, isDark), boxShadow: `inset 0 0 0 1.5px ${meta.color}` } : undefined}>
                    <PremiumIcon icon={meta.icon} hex={meta.color} size="xs" />
                    {c}
                  </button>
                );
              })}
              <button type="button"
                onClick={() => { setCustomCategory(true); form.setValue("category", "", { shouldValidate: true }); }}
                className={cn(
                  "h-9 pl-1.5 pr-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 shrink-0",
                  !customCategory && "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                style={customCategory ? { background: `linear-gradient(135deg, ${VAULT_BRASS_LIGHT}, ${VAULT_BRASS_DEEP})`, color: VAULT_BRASS_TEXT } : undefined}>
                <PremiumIcon icon={MoreHorizontal} tone="gray" size="xs" />
                Custom
              </button>
            </div>
            {customCategory && (
              <FormInput placeholder="e.g. Freelance Clients" {...form.register("category")} />
            )}
          </div>

          {isLogin ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  Password
                  {!isCreate && <span className="text-[11px] font-medium text-muted-foreground">leave blank to keep unchanged</span>}
                </label>
                <button type="button" onClick={() => setShowGenerator(v => !v)}
                  className="flex items-center gap-1 text-[11.5px] font-bold transition-colors" style={{ color: VAULT_BRASS_DEEP }}>
                  <Sparkles className="w-3.5 h-3.5" /> Generate
                </button>
              </div>
              {showGenerator && (
                <PasswordGeneratorPanel onUse={(value) => {
                  form.setValue("secret", value, { shouldValidate: true, shouldDirty: true });
                  setShowSecret(true);
                  setShowGenerator(false);
                }} />
              )}
              <FormInput type={showSecret ? "text" : "password"} placeholder={isCreate ? "Enter or generate a password" : "••••••••"}
                data-testid="vault-secret-input" autoComplete="new-password" className="pr-16 font-mono tracking-wide"
                error={form.formState.errors.secret?.message}
                endAdornment={
                  <div className="flex items-center gap-2.5">
                    <button type="button" onClick={handleCopySecret} disabled={!secret} aria-label="Copy password"
                      className="text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted-foreground/60">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setShowSecret(v => !v)} aria-label={showSecret ? "Hide password" : "Show password"}
                      className="text-muted-foreground/60 hover:text-foreground transition-colors">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                }
                {...form.register("secret")} />
              <p className="text-[11px] text-muted-foreground text-right -mt-0.5">{secret.length}/{VAULT_SECRET_MAX_LENGTH}</p>
              {secret.length > 0 && (
                <div className="space-y-1">
                  <div className="h-1 bg-muted/60 rounded-full overflow-hidden flex gap-0.5">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className={cn("h-full flex-1 rounded-full transition-colors", i > strength.level && "bg-transparent")}
                        style={{ backgroundColor: i <= strength.level ? strength.color : undefined }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                  {isNumericPin(secret) && (
                    <p className="text-[11px] text-muted-foreground">
                      Rated as a PIN — not directly comparable to a password&apos;s strength.
                    </p>
                  )}
                </div>
              )}

              {showTotpAsSet ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">
                    Two-factor code (TOTP)
                  </label>
                  <div className="flex items-center justify-between px-3 h-10 rounded-xl bg-muted/60 border border-border text-sm text-muted-foreground">
                    <span>2FA is set up for this item</span>
                    <button type="button" onClick={handleRemoveTotp} className="text-xs font-medium text-red-500 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                // Collapsed by default — most items never need a TOTP secret, so keeping this a
                // disclosure rather than an always-visible field keeps the common-case form short.
                <details className="group border border-dashed border-border rounded-xl px-3.5 py-3">
                  <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-bold text-foreground">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" style={{ color: VAULT_BRASS }} />
                      Add a 2FA code (TOTP)
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 space-y-2">
                    <FormInput placeholder="Paste base32 secret (e.g. JBSWY3DPEHPK3PXP)"
                      data-testid="vault-totp-input" autoComplete="off"
                      error={form.formState.errors.totpSecret?.message}
                      {...form.register("totpSecret")} />
                    <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                      WealthyNest generates live 6-digit codes when you reveal this item — no separate authenticator app needed.
                    </p>
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="vault-note-body" className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                Note
                {!isCreate && <span className="text-[11px] font-medium text-muted-foreground">leave blank to keep unchanged</span>}
              </label>
              <Controller control={form.control} name="secret" render={({ field }) => (
                <textarea id="vault-note-body" rows={5} placeholder="Secure note content…"
                  className="w-full px-3 py-2 rounded-xl text-sm transition-all outline-none resize-none
                    bg-background border border-border text-foreground placeholder:text-muted-foreground
                    focus:border-[#d4a72c] focus:ring-2 focus:ring-[#d4a72c]/20"
                  value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              )} />
              <p className="text-[11px] text-muted-foreground text-right -mt-1">{secret.length}/{VAULT_SECRET_MAX_LENGTH}</p>
              {form.formState.errors.secret?.message && (
                <p className="text-xs text-red-500 dark:text-red-400">{form.formState.errors.secret.message}</p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="gradient" loading={isPending} data-testid="vault-form-submit"
              className="flex-1 bg-gradient-to-br from-[#f6d776] to-[#a9791a] text-[#241705] hover:brightness-105 shadow-lg shadow-[#a9791a]/30 disabled:shadow-none">
              <Check className="w-4 h-4" /> {isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
