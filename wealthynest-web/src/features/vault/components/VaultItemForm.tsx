"use client";

import {useState} from "react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Check, Copy, Eye, EyeOff, FileText, KeyRound, Sparkles} from "lucide-react";
import {toast} from "sonner";
import {FormInput} from "@/components/forms/FormInput";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {cn} from "@/lib/utils";
import {resolveVaultIcon, VAULT_ICON_OPTIONS} from "@/lib/categoryMeta";
import {type VaultItemFormValues, vaultItemSchema} from "../schemas/vault.schema";
import {estimatePasswordStrength} from "../lib/passwordStrength";
import {PasswordGeneratorPanel} from "./PasswordGeneratorPanel";

const VAULT_TO = "#64748b";

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
  const [showSecret, setShowSecret]         = useState(isCreate);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showGenerator, setShowGenerator]   = useState(false);
  const [totpRemoved, setTotpRemoved]       = useState(false);
  const [customCategory, setCustomCategory] = useState(
    !!defaultValues?.category && !CATEGORY_PRESETS.includes(defaultValues.category)
  );

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
  const strength = estimatePasswordStrength(secret);
  const previewIcon = resolveVaultIcon({ itemType, icon });

  const handleCopySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    toast.success("Password copied to clipboard");
  };

  return (
    <TransactionModalOverlay onDismiss={onCancel}>
      <FormModalShell accent="from-[#334155] to-[#64748b]">
        <FormModalHeader icon={previewIcon} hex={accentColor} title={isCreate ? "Add to Vault" : "Edit Item"}
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
                    ? "bg-gradient-to-r from-[#334155] to-[#64748b] text-white shadow-lg shadow-[#64748b]/25"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* Title + icon picker */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Title</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowIconPicker(v => !v)} title="Change icon"
                className="shrink-0 rounded-2xl transition-all hover:ring-2 hover:ring-[#64748b]/40">
                <PremiumIcon icon={previewIcon} hex={accentColor} size="sm" />
              </button>
              <input placeholder="e.g. Gmail, HDFC NetBanking" data-testid="vault-title-input"
                className="flex-1 h-10 px-3 rounded-xl bg-muted/60 border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-[#64748b] transition-colors"
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
                    <button type="button" onClick={() => form.setValue("icon", undefined)}
                      className="text-[11px] font-medium" style={{ color: VAULT_TO }}>
                      Use automatic
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {VAULT_ICON_OPTIONS.map(({ key, icon: OptIcon }) => (
                    <button key={key} type="button" onClick={() => form.setValue("icon", key)}
                      className={cn("rounded-lg transition-all", icon === key ? "ring-2 ring-offset-2 ring-offset-card" : "opacity-70 hover:opacity-100")}
                      style={icon === key ? { boxShadow: `0 0 0 2px ${VAULT_TO}` } : undefined}>
                      <PremiumIcon icon={OptIcon} hex={accentColor} size="xs" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isLogin && (
            <div className="grid sm:grid-cols-2 gap-4">
              <FormInput label="Username / Email" placeholder="you@example.com"
                {...form.register("username")} />
              <FormInput label="Website (optional)" placeholder="https://example.com"
                {...form.register("url")} />
            </div>
          )}

          {/* Category — quick-pick chips, same template as Budgets' custom-category chips */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Category (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_PRESETS.map(c => (
                <button key={c} type="button"
                  onClick={() => { setCustomCategory(false); form.setValue("category", c, { shouldValidate: true }); }}
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-medium transition-all",
                    !customCategory && category === c
                      ? "text-white" : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  style={!customCategory && category === c ? { backgroundColor: VAULT_TO } : undefined}>
                  {c}
                </button>
              ))}
              <button type="button"
                onClick={() => { setCustomCategory(true); form.setValue("category", "", { shouldValidate: true }); }}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-medium transition-all",
                  customCategory ? "text-white" : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                style={customCategory ? { backgroundColor: VAULT_TO } : undefined}>
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
                <label className="block text-sm font-medium text-muted-foreground">
                  Password{isCreate ? "" : " (leave blank to keep unchanged)"}
                </label>
                <button type="button" onClick={() => setShowGenerator(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium transition-colors" style={{ color: VAULT_TO }}>
                  <Sparkles className="w-3.5 h-3.5" /> Generate
                </button>
              </div>
              {showGenerator && (
                <PasswordGeneratorPanel onGenerate={(value) => {
                  form.setValue("secret", value, { shouldValidate: true, shouldDirty: true });
                  setShowSecret(true);
                }} />
              )}
              <FormInput type={showSecret ? "text" : "password"} placeholder={isCreate ? "Enter or generate a password" : "••••••••"}
                data-testid="vault-secret-input" autoComplete="new-password" className="pr-16"
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
              {secret.length > 0 && (
                <div className="space-y-1">
                  <div className="h-1 bg-muted/60 rounded-full overflow-hidden flex gap-0.5">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={cn("h-full flex-1 rounded-full transition-colors", i > strength.level && "bg-transparent")}
                        style={{ backgroundColor: i <= strength.level ? strength.color : undefined }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground">
                  Two-factor code (TOTP, optional)
                </label>
                {showTotpAsSet ? (
                  <div className="flex items-center justify-between px-3 h-10 rounded-xl bg-muted/60 border border-border text-sm text-muted-foreground">
                    <span>2FA is set up for this item</span>
                    <button type="button" onClick={handleRemoveTotp} className="text-xs font-medium text-red-500 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                ) : (
                  <FormInput placeholder="Paste base32 secret (e.g. JBSWY3DPEHPK3PXP)"
                    data-testid="vault-totp-input" autoComplete="off"
                    error={form.formState.errors.totpSecret?.message}
                    {...form.register("totpSecret")} />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="vault-note-body" className="block text-sm font-medium text-muted-foreground">
                Note{isCreate ? "" : " (leave blank to keep unchanged)"}
              </label>
              <Controller control={form.control} name="secret" render={({ field }) => (
                <textarea id="vault-note-body" rows={5} placeholder="Secure note content…"
                  className="w-full px-3 py-2 rounded-xl text-sm transition-all outline-none resize-none
                    bg-background border border-border text-foreground placeholder:text-muted-foreground
                    focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/20"
                  value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              )} />
              {form.formState.errors.secret?.message && (
                <p className="text-xs text-red-500 dark:text-red-400">{form.formState.errors.secret.message}</p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="gradient" loading={isPending} data-testid="vault-form-submit"
              className="flex-1 bg-gradient-to-r from-[#334155] to-[#64748b] hover:opacity-90 shadow-[#64748b]/25 disabled:shadow-none">
              <Check className="w-4 h-4" /> {isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
