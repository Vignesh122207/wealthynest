"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import type {UseFormRegisterReturn} from "react-hook-form";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {
    Bell,
    Eye,
    EyeOff,
    Fingerprint,
    KeyRound,
    Loader2,
    LogOut,
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
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {AuthCard} from "@/features/auth/components/AuthCard";
import {
    useChangeEmail,
    useChangePassword,
    useDeletePasskey,
    usePasskeys,
    useRegisterPasskey,
    useRevokeOtherSessions,
    useRevokeSession,
    useSessions,
    useUpdateProfile,
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
import {useAppLockStore} from "@/features/auth/store/appLock.store";
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

// ─── Protection score — one glance instead of five status pills ────────────
// Counts only the checks that actually apply to this session (e.g. skips the biometric check
// entirely on a browser with no WebAuthn support) so a device that can't offer a given method
// isn't penalized for it.
function useProtectionScore() {
  const { user } = useAuthStore();
  const isNative = useIsNativePlatform();
  const supported = useWebAuthnSupport();
  const { data: nativeBiometric } = useNativeBiometricStatus();
  const { data: passkeys = [] } = usePasskeys();

  const pinOn = !!user?.pinEnabled;
  const alertsOn = user?.loginAlertEnabled ?? true;
  const biometricApplicable = isNative ? !!nativeBiometric?.available : supported;
  const biometricOn = isNative ? !!nativeBiometric?.enabled : passkeys.length > 0;

  const checks = [pinOn, alertsOn, ...(biometricApplicable ? [biometricOn] : [])];
  const total = checks.length;
  const enabledCount = checks.filter(Boolean).length;

  return { percent: total ? Math.round((enabledCount / total) * 100) : 0, enabledCount, total };
}

function ProtectionRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-brand-500/15" />
        <circle
          cx="28" cy="28" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className="stroke-brand-500 transition-[stroke-dashoffset] duration-500 ease-out"
          strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-foreground tabular-nums">
        {percent}%
      </div>
    </div>
  );
}

function ProtectionHero() {
  const { percent, enabledCount, total } = useProtectionScore();
  const label = percent === 100 ? "Fully protected" : percent >= 50 ? "Almost there" : "Add a layer of protection";
  const copy = percent === 100
    ? "PIN, fingerprint unlock, and sign-in alerts are all on for this account."
    : `${enabledCount} of ${total} protections on — turn on the rest below.`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent pointer-events-none" />
      <ProtectionRing percent={percent} />
      <div className="relative min-w-0">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{copy}</p>
      </div>
    </div>
  );
}

// ─── Unlock this device — PIN + fingerprint/passkey merged into one card ────
// These used to be up to three separate always-rendered-or-null cards (PIN, web passkeys, native
// biometric), and turning on native biometric used to leave a second, separate "enable passkey"
// card asking for the same fingerprint a moment later. Grouping them (and putting this ahead of
// the password form) puts the thing a phone user actually taps daily first; see FingerprintRow's
// own comment below for why native now renders as a single row instead of two.

function PinRow() {
  const { user } = useAuthStore();
  const router = useRouter();
  const isNative = useIsNativePlatform();
  const enabled = !!user?.pinEnabled;
  const [showSetup, setShowSetup] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [resetPassword, setResetPassword] = useState<string | undefined>(undefined);

  // Lands here right after "Forgot your PIN?" → sign out → sign back in with password (see
  // useLogin's own comment on this specific redirect) — auto-opens PIN setup with that
  // just-typed password already in hand, closing the loop instead of leaving the user to
  // rediscover "Forgot your PIN?" a second time on their own. A plain window.location read
  // (not useSearchParams) so this one-shot check doesn't need a Suspense boundary the rest of
  // this page has no other reason to carry.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("resetPin") !== "1") return;
    const password = useAppLockStore.getState().consumePendingPinResetPassword();
    router.replace("/settings/security"); // drop the query param so a refresh doesn't retrigger
    if (password) {
      setResetPassword(password);
      setShowSetup(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeSetup = () => { setShowSetup(false); setResetPassword(undefined); };

  // Mirrors FingerprintRow/PasskeyRow's own toggle below — PIN used to be a tap-through link
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
        <PinSetupModal currentPassword={resetPassword} onClose={closeSetup} onSuccess={closeSetup} />
      )}
      {showVerify && (
        <PinVerifyModal
          onClose={() => setShowVerify(false)}
          onVerified={() => setShowVerify(false)}
          onForgot={() => { setShowVerify(false); setShowSetup(true); }}
        />
      )}
    </div>
  );
}

// Native only — merges what used to be two rows (bare fingerprint app-lock toggle, plus a
// separate "enable passkey" card for the same sensor) into one. Turning the toggle on both arms
// local biometric app-lock AND auto-provisions the real WebAuthn credential Vault reveal/export
// needs (see useEnableBiometricUnlock) — so there's one setup ask, not two. The credential itself
// still needs a place to be managed (renamed, removed, a second device added), which is what the
// "Manage" line below the toggle expands into — tucked away by default instead of rendered as its
// own always-visible card, since most users never need it. If auto-provisioning was declined or
// failed, that line still appears (toggle is on, but there's no passkey yet) with "Retry" instead
// of "Manage", offering a manual way to finish setup for the exact same credential.
function FingerprintRow() {
  const { data, isLoading } = useNativeBiometricStatus();
  const { mutate: enable, isPending: enabling } = useEnableBiometricUnlock();
  const { mutate: disable, isPending: disabling } = useDisableBiometricUnlock();
  const supported = useWebAuthnSupport();
  const { data: passkeys = [] } = usePasskeys();
  const { mutate: deletePasskey } = useDeletePasskey();
  const [showManage, setShowManage] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading || !data?.available) return null;

  const hasPasskey = passkeys.length > 0;
  const canManage = supported && (data.enabled || hasPasskey);

  return (
    <div>
      <div className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
        <PremiumIcon icon={Fingerprint} tone={data.enabled ? "green" : "gray"} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
            Fingerprint unlock
            <StatusPill on={data.enabled}>{data.enabled ? "ENABLED" : "NOT SET UP"}</StatusPill>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.enabled ? "Also unlocks Vault reveals & exports" : "Unlocks the app and Vault with one tap"}
          </p>
        </div>
        <Toggle
          checked={data.enabled}
          disabled={enabling || disabling}
          onChange={(v) => (v ? enable() : disable())}
          testId={data.enabled ? "security-biometric-disable" : "security-biometric-enable-toggle"}
        />
      </div>

      {canManage && (
        <button
          onClick={() => (hasPasskey ? setShowManage(v => !v) : setShowAdd(true))}
          data-testid="security-biometric-manage-toggle"
          className="w-full flex items-center justify-between gap-2 px-4 pb-3 sm:pl-[46px] text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{hasPasskey ? `${passkeys.length} device${passkeys.length === 1 ? "" : "s"} added` : "Setup didn't finish on this device"}</span>
          <span className="font-semibold text-brand-600 dark:text-brand-300">{hasPasskey ? (showManage ? "Hide" : "Manage") : "Retry"}</span>
        </button>
      )}

      {showManage && hasPasskey && (
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
          <button onClick={() => setShowAdd(true)} data-testid="security-passkey-add-toggle"
            className="w-full h-9 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors">
            Add another device
          </button>
        </div>
      )}

      {showAdd && (
        <PasskeyAddModal enabled={hasPasskey} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}

// Web/desktop only — WebAuthn passkeys, potentially several (one per enrolled device), so unlike
// the native row above this can't collapse to a single on/off switch: each entry needs its own
// remove action and there's a real "add another" flow. Kept expanded by default (matches the
// original PasskeysSection) rather than gated behind a second click, since fingerprint/face is
// exactly the feature this redesign is meant to promote, not bury further.
// Popup — same chrome as PasswordChangeModal/EmailChangeModal/PinSetupModal.
function PasskeyAddModal({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const { mutate: registerPasskey, isPending: registering } = useRegisterPasskey();
  const [nickname, setNickname] = useState("");

  const handleAdd = () => {
    registerPasskey(nickname.trim() || "This device", { onSuccess: onClose });
  };

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-[400px]">
      <AuthCard animation="scale-in" className="px-5 pt-5 pb-6">
        <button onClick={onClose} aria-label="Close" data-testid="passkey-add-close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pt-2 text-center">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <Fingerprint className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-1">
            {enabled ? "Add another device" : "Enable passkey unlock"}
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Name this device so you can recognize it in the list later.
          </p>
        </div>

        <div className="space-y-3">
          <FormInput
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="e.g. My phone"
            aria-label="Device name"
            data-testid="security-passkey-nickname-input"
          />
          <button onClick={handleAdd} disabled={registering} data-testid="security-passkey-submit"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-brand-600 to-brand-500 shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
            {registering && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {registering ? "Follow your device's prompt…" : "Continue"}
          </button>
        </div>
      </AuthCard>
    </TransactionModalOverlay>
  );
}

function PasskeyRow() {
  const { data: passkeys = [], isLoading } = usePasskeys();
  const { mutate: deletePasskey } = useDeletePasskey();
  const [showAdd, setShowAdd] = useState(false);
  const enabled = passkeys.length > 0;

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
          <p className="text-xs text-muted-foreground mt-0.5">
            Unlock instantly with your fingerprint, face, or screen lock — no separate biometric setup, it&apos;s all part of the passkey
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} data-testid="security-passkey-add-toggle"
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors shrink-0">
          {enabled ? "Add another" : "Enable passkey unlock"}
        </button>
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
        <PasskeyAddModal enabled={enabled} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}

// Native gets FingerprintRow (bare app-lock toggle + the WebAuthn credential it auto-provisions,
// merged into one row — see FingerprintRow's own comment). Web/desktop has no native biometric
// layer to merge into, so PasskeyRow renders standalone there, same as before.
function BiometricRow() {
  const isNative = useIsNativePlatform();
  const supported = useWebAuthnSupport();

  if (isNative) return <FingerprintRow />;
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

// Popup — same TransactionModalOverlay + AuthCard chrome as PinSetupModal/PinVerifyModal, so
// every security form now shares one consistent surface instead of some being inline-expanding
// rows and others popups.
function PasswordChangeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { mutate: changePassword, isPending } = useChangePassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function onSubmit(values: Values) {
    changePassword(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      { onSuccess: () => { form.reset(); onSuccess(); } }
    );
  }

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-[400px]">
      <AuthCard animation="scale-in" className="px-5 pt-5 pb-6">
        <button onClick={onClose} aria-label="Close" data-testid="password-change-close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pt-2 text-center">
          <div className="w-11 h-11 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-5 h-5 text-brand-500" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-1">Change password</h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Use a strong password with letters, numbers, and symbols.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
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
      </AuthCard>
    </TransactionModalOverlay>
  );
}

function PasswordRow() {
  const [showModal, setShowModal] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSuccess = () => {
    setShowModal(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
  };

  return (
    <div>
      <div className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
        <PremiumIcon icon={KeyRound} tone="blue" size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Password</p>
          <p className="text-xs text-muted-foreground mt-0.5">Use a strong password with letters, numbers, and symbols</p>
        </div>
        <button onClick={() => setShowModal(true)} data-testid="security-password-toggle"
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors shrink-0">
          Change password
        </button>
      </div>

      {success && (
        <div className="mx-4 mb-3 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-center font-medium">
          Password updated successfully!
        </div>
      )}

      {showModal && (
        <PasswordChangeModal onClose={() => setShowModal(false)} onSuccess={handleSuccess} />
      )}
    </div>
  );
}

const emailSchema = z.object({
  newEmail:        z.string().email("Invalid email address"),
  currentPassword: z.string().min(1, "Required"),
});
type EmailValues = z.infer<typeof emailSchema>;

// Popup — same chrome as PasswordChangeModal/PinSetupModal.
function EmailChangeModal({ pendingEmail, onClose }: { pendingEmail?: string; onClose: () => void }) {
  const { mutate: changeEmail, isPending } = useChangeEmail();
  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  const onSubmit = (values: EmailValues) => {
    changeEmail(values, { onSuccess: () => { form.reset(); onClose(); } });
  };

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-[400px]">
      <AuthCard animation="scale-in" className="px-5 pt-5 pb-6">
        <button onClick={onClose} aria-label="Close" data-testid="email-change-close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pt-2 text-center">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto mb-3">
            <Mail className="w-5 h-5 text-teal-500" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-1">
            {pendingEmail ? "Change to a different email" : "Change email"}
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            We&apos;ll send a verification link to the new address before it takes effect.
          </p>
        </div>

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
          <button type="submit" disabled={isPending} data-testid="security-email-submit"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-brand-600 to-brand-500 shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send verification link
          </button>
        </form>
      </AuthCard>
    </TransactionModalOverlay>
  );
}

function EmailRow() {
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
        <PremiumIcon icon={Mail} tone="teal" size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            Email address <StatusPill on>VERIFIED</StatusPill>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>
        </div>
        <button onClick={() => setShowModal(true)} data-testid="security-email-change-toggle"
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors shrink-0">
          {user?.pendingEmail ? "Change again" : "Change email"}
        </button>
      </div>

      {user?.pendingEmail && (
        <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mx-4 mb-3 sm:ml-[46px]">
          <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Verification link sent to <strong>{user.pendingEmail}</strong> — check that inbox to confirm the change.
          </p>
        </div>
      )}

      {showModal && (
        <EmailChangeModal pendingEmail={user?.pendingEmail} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

// Controls the "new sign-in" security email (see AuthServiceImpl#login /
// #signInWithGooglePayload) — used to fire on every login unconditionally. Off by admin
// override still shows this toggle, it just has no effect; the API doesn't expose the global
// kill switch's state here, so there's nothing to reflect.
function LoginAlertRow() {
  const { user } = useAuthStore();
  const { mutate, isPending } = useUpdateProfile();
  const enabled = user?.loginAlertEnabled ?? true;

  return (
    <div className="flex items-center gap-3.5 px-4 py-4 min-h-[64px]">
      <PremiumIcon icon={Bell} tone="orange" size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Sign-in email alerts</p>
        <p className="text-xs text-muted-foreground mt-0.5">Get an email whenever your account signs in on any device</p>
      </div>
      <Toggle
        checked={enabled}
        disabled={isPending}
        onChange={(next) => mutate({ loginAlertEnabled: next })}
        testId={enabled ? "security-login-alert-disable-toggle" : "security-login-alert-enable-toggle"}
      />
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
        <LoginAlertRow />
      </div>
    </div>
  );
}

// Popup — same TransactionModalOverlay + AuthCard chrome as every other Security popup
// (PasswordChangeModal/EmailChangeModal/PinSetupModal/PinVerifyModal), replacing what used to be
// an inline amber confirmation row wedged above the session list.
function RevokeOtherSessionsModal({ count, onClose, onConfirm, isPending }: {
  count: number;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-[360px]">
      <AuthCard animation="scale-in" className="px-5 pt-5 pb-6">
        <button onClick={onClose} aria-label="Close" data-testid="security-sessions-revoke-others-close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pt-2 text-center">
          <div className="w-11 h-11 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <LogOut className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-1">Sign out other devices?</h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            You&apos;ll be signed out of {count} other {count === 1 ? "device" : "devices"}. This device stays signed in.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isPending} data-testid="security-sessions-revoke-others-confirm"
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5 text-white disabled:opacity-60 disabled:hover:translate-y-0 transition-all">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Sign out
          </button>
        </div>
      </AuthCard>
    </TransactionModalOverlay>
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
        {otherSessionCount > 0 && (
          <button onClick={() => setConfirmRevokeOthers(true)} data-testid="security-sessions-revoke-others-toggle"
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Sign out others
          </button>
        )}
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
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
                    {s.firstSeenAt && s.firstSeenAt !== s.createdAt && ` · First seen ${formatDate(s.firstSeenAt)}`}
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

      {confirmRevokeOthers && (
        <RevokeOtherSessionsModal
          count={otherSessionCount}
          isPending={revokingOthers}
          onClose={() => setConfirmRevokeOthers(false)}
          onConfirm={() => revokeOthers(undefined, { onSuccess: () => setConfirmRevokeOthers(false) })}
        />
      )}
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header title="Security" subtitle="Your account's protection, at a glance" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-6">

          <ProtectionHero />

          <UnlockMethodsCard />

          <PasswordEmailCard />

          <SessionsCard />

        </div>
      </PageWrapper>
    </div>
  );
}
