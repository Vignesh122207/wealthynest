"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import type {UseFormRegisterReturn} from "react-hook-form";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {
    ChevronRight,
    Eye,
    EyeOff,
    Fingerprint,
    KeyRound,
    Loader2,
    Mail,
    Monitor,
    Smartphone,
    Trash2,
    X
} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {InfoTooltip} from "@/components/ui/Tooltip";
import {FormInput} from "@/components/forms/FormInput";
import {Toggle} from "@/components/ui/Toggle";
import {
    useChangeEmail,
    useChangePassword,
    useDeletePasskey,
    usePasskeys,
    useRegisterPasskey,
    useRevokeOtherSessions,
    useRevokeSession,
    useSessions,
} from "@/features/auth/hooks/useAuth";
import {
    useDisableBiometricUnlock,
    useEnableBiometricUnlock,
    useIsNativePlatform,
    useNativeBiometricStatus,
} from "@/features/auth/hooks/useNativeBiometric";
import {PinSetupModal} from "@/features/auth/components/PinSetupModal";
import {PinVerifyModal} from "@/features/auth/components/PinVerifyModal";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useWebAuthnSupport} from "@/features/auth/hooks/useWebAuthnSupport";
import {cn, formatDate} from "@/lib/utils";
import {isMobileUserAgent, parseUserAgent} from "@/lib/parseUserAgent";

const PASSWORD_TIPS = [
  "At least 8 characters",
  "Mix letters, numbers, and symbols",
  "Avoid reusing passwords from other sites",
  "Never share your password, even with support",
];

const schema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword:     z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string().min(1, "Required"),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
});
type Values = z.infer<typeof schema>;

function PasswordField({ label, reg, error, placeholder, testId }: {
  label?: string;
  reg: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
  testId?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <FormInput
      {...reg}
      label={label}
      error={error}
      data-testid={testId}
      type={show ? "text" : "password"}
      placeholder={placeholder ?? "••••••••"}
      className="h-auto py-2.5"
      endAdornment={
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      }
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">{children}</p>;
}

// Row-level status pill — same on/off convention as the hero's StatusChip, but sized for a card row.
function StatusPill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={cn(
      "text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
      on ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
    )}>
      {children}
    </span>
  );
}

// ─── Unlock this device — PIN + fingerprint/passkey merged into one card ────
// These used to be up to three separate always-rendered-or-null cards (PIN, web passkeys, native
// biometric). On any given device only one of the latter two can ever actually render — a phone
// gets native biometric, a browser gets passkeys, never both — so the old 3-card layout was
// scaffolding for a case that never happens on screen. Grouping them (and putting this ahead of
// the password form) puts the thing a phone user actually taps daily first.

function PinRow() {
  const { user } = useAuthStore();
  const router = useRouter();
  const isNative = useIsNativePlatform();
  const enabled = !!user?.pinEnabled;
  const [showSetup, setShowSetup] = useState(false);
  const [showVerify, setShowVerify] = useState(false);

  // Mirrors NativeBiometricRow/PasskeyRow's own toggle below — PIN used to be a tap-through link
  // when off and an always-on switch when on, the one unlock method here that didn't behave like
  // its neighbors. Flipping it on can't just flip a boolean (a PIN has to actually be chosen), so
  // "on" opens the setup flow instead of enabling directly. Flipping it off no longer disables
  // immediately either — it opens PinVerifyModal first (see AuthServiceImpl#disablePin's own
  // comment on why turning protection OFF needs proving the current PIN, unlike turning it on).
  const handleChange = (next: boolean) => {
    if (!next) { setShowVerify(true); return; }
    if (isNative) router.push("/settings/security/pin");
    else setShowSetup(true);
  };

  return (
    <div className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
      <PremiumIcon icon={KeyRound} tone="indigo" size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
          PIN unlock
          <StatusPill on={enabled}>{enabled ? "ENABLED" : "NOT SET UP"}</StatusPill>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Quick 4-digit unlock for this device</p>
      </div>
      <Toggle
        checked={enabled}
        onChange={handleChange}
        testId={enabled ? "security-pin-disable-toggle" : "security-pin-enable-toggle"}
      />
      {showSetup && (
        <PinSetupModal onClose={() => setShowSetup(false)} onSuccess={() => setShowSetup(false)} />
      )}
      {showVerify && (
        <PinVerifyModal onClose={() => setShowVerify(false)} onVerified={() => setShowVerify(false)} />
      )}
    </div>
  );
}

// Native only — a bare fingerprint/face toggle with nothing stored behind it (see the original
// NativeBiometricSection's own reasoning, preserved here: this is a local re-proof on an
// already-valid session, not a remote credential, so "enable" just confirms the device can pass a
// biometric check and remembers that preference).
function NativeBiometricRow() {
  const { data, isLoading } = useNativeBiometricStatus();
  const { mutate: enable, isPending: enabling } = useEnableBiometricUnlock();
  const { mutate: disable, isPending: disabling } = useDisableBiometricUnlock();

  if (isLoading || !data?.available) return null;

  return (
    <div className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
      <PremiumIcon icon={Fingerprint} tone={data.enabled ? "green" : "gray"} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
          Fingerprint &amp; face unlock
          <StatusPill on={data.enabled}>{data.enabled ? "ENABLED" : "NOT SET UP"}</StatusPill>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Unlock instantly — no typing needed</p>
      </div>
      <Toggle
        checked={data.enabled}
        disabled={enabling || disabling}
        onChange={(v) => (v ? enable() : disable())}
        testId={data.enabled ? "security-biometric-disable" : "security-biometric-enable-toggle"}
      />
    </div>
  );
}

// Web/desktop only — WebAuthn passkeys, potentially several (one per enrolled device), so unlike
// the native row above this can't collapse to a single on/off switch: each entry needs its own
// remove action and there's a real "add another" flow. Kept expanded by default (matches the
// original PasskeysSection) rather than gated behind a second click, since fingerprint/face is
// exactly the feature this redesign is meant to promote, not bury further.
function PasskeyRow() {
  const { data: passkeys = [], isLoading } = usePasskeys();
  const { mutate: registerPasskey, isPending: registering } = useRegisterPasskey();
  const { mutate: deletePasskey } = useDeletePasskey();
  const [nickname, setNickname] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const enabled = passkeys.length > 0;

  const handleAdd = () => {
    registerPasskey(nickname.trim() || "This device", { onSuccess: () => { setNickname(""); setShowAdd(false); } });
  };

  return (
    <div>
      {/* px-4 py-4 min-h-[64px] on this row itself (not an outer wrapper) — same reasoning as
          EmailRow's own matching comment: padding and min-height need to live on the same element
          for the row to come out the same 64px PIN/Biometric rows use for their Toggle. */}
      <div className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
        <PremiumIcon icon={Fingerprint} tone={enabled ? "green" : "gray"} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
            Passkey unlock
            <StatusPill on={enabled}>{enabled ? `${passkeys.length} DEVICE${passkeys.length === 1 ? "" : "S"}` : "NOT SET UP"}</StatusPill>
            {passkeys.length > 0 && (
              <InfoTooltip content={
                <p>
                  Each entry below is tied to one specific device — a passkey added on your laptop
                  won&apos;t offer to unlock this account on your phone, even though both are listed
                  here. Add a passkey separately on each device you want fast unlock on.
                </p>
              } />
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Unlock instantly with your fingerprint, face, or screen lock — no separate biometric setup, it&apos;s all part of the passkey</p>
        </div>
        {/* Same right-edge slot PIN/biometric rows give their Toggle, and EmailRow now gives
            "Change email" — kept out of the flow below so this row matches the rest of the card. */}
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} data-testid="security-passkey-add-toggle"
            className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors shrink-0">
            {enabled ? "Add another" : "Enable passkey unlock"}
          </button>
        )}
      </div>

      {!isLoading && passkeys.length > 0 && (
        <div className="space-y-2 px-4 pb-3 sm:pl-[46px]">
          {passkeys.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.nickname || "This device"}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Added {formatDate(p.createdAt)}{p.lastUsedAt ? ` · Last used ${formatDate(p.lastUsedAt)}` : ""}
                </p>
              </div>
              <button onClick={() => deletePasskey(p.id)} title="Remove" data-testid="security-passkey-delete"
                className="text-muted-foreground/60 hover:text-red-500 transition-colors shrink-0 p-2 -m-2 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="px-4 pb-4 sm:pl-[46px]">
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <FormInput
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="e.g. My phone"
                className="h-9"
                aria-label="Device name"
                data-testid="security-passkey-nickname-input"
              />
            </div>
            <button onClick={handleAdd} disabled={registering} data-testid="security-passkey-submit"
              className="h-9 px-3.5 rounded-xl text-xs font-medium bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 transition-all flex items-center gap-1.5">
              {registering && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {registering ? "Follow your device's prompt…" : "Continue"}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Chooses which biometric row applies to this platform — never both (see AppLockScreen's own
// comment for why: native's plain BiometricPrompt and a browser passkey both claim the same
// physical sensor, so offering both on one platform would be a confusing, redundant choice).
function BiometricRow() {
  const isNative = useIsNativePlatform();
  const supported = useWebAuthnSupport();

  if (isNative) return <NativeBiometricRow />;
  if (!supported) return null;
  return <PasskeyRow />;
}

function UnlockMethodsCard() {
  return (
    <div>
      <SectionLabel>Unlock this device</SectionLabel>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border mt-2">
        <PinRow />
        <BiometricRow />
      </div>
    </div>
  );
}

// ─── Password & email — demoted below unlock methods since it's a rare action, collapsed by
// default instead of an always-open form taking up the top of the page ─────────────────────────

function PasswordRow() {
  const { mutate: changePassword, isPending } = useChangePassword();
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function onSubmit(values: Values) {
    changePassword(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      { onSuccess: () => { form.reset(); setSuccess(true); setOpen(false); setTimeout(() => setSuccess(false), 4000); } }
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        data-testid="security-password-toggle"
        aria-expanded={open}
        className="w-full flex items-center gap-3.5 px-4 py-4 min-h-[64px] text-left hover:bg-muted/40 transition-colors"
      >
        <PremiumIcon icon={KeyRound} tone="blue" size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Password</p>
          <p className="text-xs text-muted-foreground mt-0.5">Use a strong password with letters, numbers, and symbols</p>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground/50 shrink-0 transition-transform", open && "rotate-90")} />
      </button>

      {success && (
        <div className="mx-4 mb-3 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-center font-medium">
          Password updated successfully!
        </div>
      )}

      {open && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-4 space-y-3 border-t border-border pt-3.5">
          <PasswordField
            label="Current password"
            reg={form.register("currentPassword")}
            error={form.formState.errors.currentPassword?.message}
            testId="security-current-password-input"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground block">New password</label>
              <InfoTooltip content={
                <ul className="space-y-1">
                  {PASSWORD_TIPS.map(tip => <li key={tip}>· {tip}</li>)}
                </ul>
              } />
            </div>
            <PasswordField
              reg={form.register("newPassword")}
              error={form.formState.errors.newPassword?.message}
              placeholder="At least 8 characters"
              testId="security-new-password-input"
            />
          </div>
          <PasswordField
            label="Confirm new password"
            reg={form.register("confirmPassword")}
            error={form.formState.errors.confirmPassword?.message}
            testId="security-confirm-password-input"
          />
          <button
            type="submit"
            disabled={isPending}
            data-testid="security-password-submit"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-brand-600 to-brand-500 shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Update password
          </button>
        </form>
      )}
    </div>
  );
}

const emailSchema = z.object({
  newEmail:        z.string().email("Invalid email address"),
  currentPassword: z.string().min(1, "Required"),
});
type EmailValues = z.infer<typeof emailSchema>;

function EmailRow() {
  const { user } = useAuthStore();
  const { mutate: changeEmail, isPending } = useChangeEmail();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  const onSubmit = (values: EmailValues) => {
    changeEmail(values, { onSuccess: () => { form.reset(); setShowForm(false); } });
  };

  return (
    <div>
      {/* px-4 py-4 min-h-[64px] here (not on an outer wrapper) matches PasswordRow's own header
          button exactly, which is what PinRow/NativeBiometricRow's row height also comes from —
          padding and min-height need to live on the same element (border-box) for the row to
          actually come out 64px tall. Splitting them across an outer wrapper's padding and an
          inner min-height (as this used to) stacks the two instead, making this row visibly
          taller than its neighbors and throwing the button's position off relative to the rest
          of the card even though it was centered within its own (mismatched) row. */}
      <div className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
        <PremiumIcon icon={Mail} tone="teal" size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            Email address <StatusPill on>VERIFIED</StatusPill>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>
        </div>
        {/* Same right-edge slot PIN/biometric rows give their Toggle — kept out of the flow below
            (rather than its own line under the row) so this row matches the rest of the card. */}
        {!showForm && (
          <button onClick={() => setShowForm(true)} data-testid="security-email-change-toggle"
            className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors shrink-0">
            {user?.pendingEmail ? "Change again" : "Change email"}
          </button>
        )}
      </div>

      {user?.pendingEmail && (
        <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mx-4 mb-3 sm:ml-[46px]">
          <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Verification link sent to <strong>{user.pendingEmail}</strong> — check that inbox to confirm the change.
          </p>
        </div>
      )}

      {showForm && (
        <div className="px-4 pb-4 sm:pl-[46px]">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormInput
              {...form.register("newEmail")}
              label="New email address"
              type="email"
              placeholder="you@example.com"
              className="h-auto py-2.5"
              error={form.formState.errors.newEmail?.message}
            />
            <PasswordField label="Current password" reg={form.register("currentPassword")}
              error={form.formState.errors.currentPassword?.message} />
            <div className="flex gap-2">
              <button type="submit" disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-br from-brand-600 to-brand-500 shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send verification link
              </button>
              <button type="button" onClick={() => { setShowForm(false); form.reset(); }}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PasswordEmailCard() {
  return (
    <div>
      <SectionLabel>Password &amp; email</SectionLabel>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border mt-2">
        <PasswordRow />
        <EmailRow />
      </div>
    </div>
  );
}

// ─── Active sessions ─────────────────────────────────────────────────────────
// One row per signed-in device (see AuthService#listSessions on the backend for why a
// non-revoked, non-expired refresh token maps 1:1 to an active session). "This device" is
// resolved server-side from the refresh token this page's own session already holds.
function SessionsCard() {
  const { data: sessions = [], isLoading } = useSessions();
  const { mutate: revoke, isPending: revoking } = useRevokeSession();
  const { mutate: revokeOthers, isPending: revokingOthers } = useRevokeOtherSessions();
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);

  const otherSessionCount = sessions.filter(s => !s.current).length;
  // Current device first — the account holder's own device is what they care about confirming,
  // not whatever order the API happens to return.
  const ordered = [...sessions].sort((a, b) => Number(b.current) - Number(a.current));

  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2 gap-3">
        <SectionLabel>Active sessions</SectionLabel>
        {otherSessionCount > 0 && !confirmRevokeOthers && (
          <button onClick={() => setConfirmRevokeOthers(true)} data-testid="security-sessions-revoke-others-toggle"
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Sign out others
          </button>
        )}
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {confirmRevokeOthers && (
          <div className="flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Sign out of {otherSessionCount} other {otherSessionCount === 1 ? "device" : "devices"}?
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => revokeOthers(undefined, { onSuccess: () => setConfirmRevokeOthers(false) })}
                disabled={revokingOthers} data-testid="security-sessions-revoke-others-confirm"
                className="h-7 px-2.5 rounded-lg text-xs font-medium bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5 text-white disabled:opacity-60 disabled:hover:translate-y-0 transition-all"
              >
                Sign out
              </button>
              <button onClick={() => setConfirmRevokeOthers(false)}
                className="h-7 px-2.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground">
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : (
          ordered.map(s => {
            const DeviceIcon = isMobileUserAgent(s.userAgent) ? Smartphone : Monitor;
            return (
              <div key={s.id} data-testid="security-session-row" className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
                <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                  <DeviceIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    {parseUserAgent(s.userAgent)}
                    {s.current && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                        THIS DEVICE
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    {s.ipAddress ? `${s.ipAddress} · ` : ""}Last active {formatDate(s.createdAt)}
                  </p>
                </div>
                {!s.current && (
                  <button onClick={() => revoke(s.id)} disabled={revoking} title="Sign out this device"
                    data-testid="security-session-revoke" className="text-muted-foreground/60 hover:text-red-500 transition-colors shrink-0 disabled:opacity-60 p-2.5 -m-2.5 rounded-xl">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header title="Security" subtitle="Your account's protection, at a glance" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-6">

          <UnlockMethodsCard />

          <PasswordEmailCard />

          <SessionsCard />

        </div>
      </PageWrapper>
    </div>
  );
}
