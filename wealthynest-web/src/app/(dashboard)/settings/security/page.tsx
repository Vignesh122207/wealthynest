"use client";

import {useState} from "react";
import type {UseFormRegisterReturn} from "react-hook-form";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {
    Check,
    Eye,
    EyeOff,
    Fingerprint,
    KeyRound,
    Loader2,
    Mail,
    Monitor,
    ShieldCheck,
    Trash2,
    X
} from "lucide-react";
import Link from "next/link";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {InfoTooltip} from "@/components/ui/Tooltip";
import {FormInput} from "@/components/forms/FormInput";
import {
    useChangeEmail,
    useChangePassword,
    useDeletePasskey,
    useDisablePin,
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
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useWebAuthnSupport} from "@/features/auth/hooks/useWebAuthnSupport";
import {formatDate} from "@/lib/utils";
import {parseUserAgent} from "@/lib/parseUserAgent";

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

const emailSchema = z.object({
  newEmail:        z.string().email("Invalid email address"),
  currentPassword: z.string().min(1, "Required"),
});
type EmailValues = z.infer<typeof emailSchema>;

function EmailChangeSection() {
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
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <PremiumIcon icon={Mail} hex="#c2703d" size="xs" />
        <div>
          <p className="text-sm font-semibold text-foreground">Email address</p>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
        </div>
      </div>

      {user?.pendingEmail && (
        <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
          <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Verification link sent to <strong>{user.pendingEmail}</strong> — check that inbox to confirm the change.
          </p>
        </div>
      )}

      {showForm ? (
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
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send verification link
            </button>
            <button type="button" onClick={() => { setShowForm(false); form.reset(); }}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors">
          {user?.pendingEmail ? "Change to a different email" : "Change email"}
        </button>
      )}
    </div>
  );
}

// One row per signed-in device (see AuthService#listSessions on the backend for why a
// non-revoked, non-expired refresh token maps 1:1 to an active session). "This device" is
// resolved server-side from the refresh token this page's own session already holds — see
// useSessions.
function SessionsSection() {
  const { data: sessions = [], isLoading } = useSessions();
  const { mutate: revoke, isPending: revoking } = useRevokeSession();
  const { mutate: revokeOthers, isPending: revokingOthers } = useRevokeOtherSessions();
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);

  const otherSessionCount = sessions.filter(s => !s.current).length;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <PremiumIcon icon={Monitor} hex="#c2703d" size="xs" />
          <div>
            <p className="text-sm font-semibold text-foreground">Active sessions</p>
            <p className="text-xs text-muted-foreground mt-0.5">Devices currently signed in to your account.</p>
          </div>
        </div>
        {otherSessionCount > 0 && !confirmRevokeOthers && (
          <button onClick={() => setConfirmRevokeOthers(true)} data-testid="security-sessions-revoke-others-toggle"
            className="h-8 px-3 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground shrink-0">
            Sign out others
          </button>
        )}
      </div>

      {confirmRevokeOthers && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Sign out of {otherSessionCount} other {otherSessionCount === 1 ? "device" : "devices"}?
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => revokeOthers(undefined, { onSuccess: () => setConfirmRevokeOthers(false) })}
              disabled={revokingOthers} data-testid="security-sessions-revoke-others-confirm"
              className="h-7 px-2.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
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
        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.id} data-testid="security-session-row" className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                  {parseUserAgent(s.userAgent)}
                  {s.current && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  {s.ipAddress ? `${s.ipAddress} · ` : ""}Last active {formatDate(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <button onClick={() => revoke(s.id)} disabled={revoking} title="Sign out this device"
                  data-testid="security-session-revoke" className="text-muted-foreground/60 hover:text-red-500 transition-colors shrink-0 disabled:opacity-60">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Setup itself lives on its own screen now (/settings/security/pin) — a dedicated choose/confirm
// PIN flow, not an inline form here. This card just shows status + the entry point / disable.
function PinSection() {
  const { user } = useAuthStore();
  const { mutate: disablePin, isPending: disabling } = useDisablePin();
  const [confirmDisable, setConfirmDisable] = useState(false);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <PremiumIcon icon={KeyRound} hex="#c2703d" size="xs" />
          <div>
            <p className="text-sm font-semibold text-foreground">PIN unlock</p>
            <p className="text-xs text-muted-foreground mt-0.5">Quick 4-digit unlock for this device.</p>
          </div>
        </div>
      </div>

      {user?.pinEnabled ? (
        confirmDisable ? (
          <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <p className="text-xs text-amber-600 dark:text-amber-400">Disable PIN unlock on this account?</p>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => disablePin(undefined, { onSuccess: () => setConfirmDisable(false) })} disabled={disabling}
                className="h-7 px-2.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-60">
                Disable
              </button>
              <button onClick={() => setConfirmDisable(false)}
                className="h-7 px-2.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" /> PIN unlock is enabled
            </span>
            <button onClick={() => setConfirmDisable(true)}
              className="h-8 px-3 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground">
              Disable
            </button>
          </div>
        )
      ) : (
        <Link href="/settings/security/pin" data-testid="security-pin-setup-link"
          className="inline-block h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors leading-9">
          Set up PIN unlock
        </Link>
      )}
    </div>
  );
}

// Web/desktop only — native gets NativeBiometricSection's bare fingerprint toggle instead, not
// both. A native shell can pass useWebAuthnSupport() too (Credential Manager exists there), but
// showing the two together would be a confusing, redundant choice for the same physical sensor.
function PasskeysSection() {
  const supported = useWebAuthnSupport();
  const isNative = useIsNativePlatform();
  const { data: passkeys = [], isLoading } = usePasskeys();
  const { mutate: registerPasskey, isPending: registering } = useRegisterPasskey();
  const { mutate: deletePasskey } = useDeletePasskey();
  const [nickname, setNickname] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  if (!supported || isNative) return null;

  const handleAdd = () => {
    registerPasskey(nickname.trim() || "This device", { onSuccess: () => { setNickname(""); setShowAdd(false); } });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <PremiumIcon icon={Fingerprint} hex="#c2703d" size="xs" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">Fingerprint &amp; face unlock</p>
            {passkeys.length > 0 && (
              <InfoTooltip content={
                <p>
                  Each entry below is tied to one specific device — a passkey added on your laptop
                  won&apos;t offer to unlock this account on your phone, even though both are listed
                  here. Add a passkey separately on each device you want fast unlock on.
                </p>
              } />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Unlock instantly with your fingerprint, face, or screen lock.</p>
        </div>
      </div>

      {!isLoading && passkeys.length > 0 && (
        <div className="space-y-2">
          {passkeys.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.nickname || "This device"}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Added {formatDate(p.createdAt)}{p.lastUsedAt ? ` · Last used ${formatDate(p.lastUsedAt)}` : ""}
                </p>
              </div>
              <button onClick={() => deletePasskey(p.id)} title="Remove" data-testid="security-passkey-delete"
                className="text-muted-foreground/60 hover:text-red-500 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
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
            className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-60 transition-colors flex items-center gap-1.5">
            {registering && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {registering ? "Follow your device's prompt…" : "Continue"}
          </button>
          <button onClick={() => setShowAdd(false)}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} data-testid="security-passkey-add-toggle"
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors">
          Enable fingerprint unlock
        </button>
      )}
    </div>
  );
}

// Native only — a bare fingerprint/face toggle with nothing stored behind it. Unlike
// PasskeysSection's WebAuthn ceremony (server-verified, needed since a browser passkey is a real
// remote credential), this lock screen is a local re-proof on top of a session that's already
// valid the whole time it's up (see AppLockScreen's own comment) — so "enable" just confirms the
// device can pass a biometric check and remembers that preference, no password step, no PIN
// dependency. See nativeBiometric.ts for the full reasoning.
function NativeBiometricSection() {
  const { data, isLoading } = useNativeBiometricStatus();
  const { mutate: enable, isPending: enabling } = useEnableBiometricUnlock();
  const { mutate: disable, isPending: disabling } = useDisableBiometricUnlock();

  if (isLoading || !data?.available) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <PremiumIcon icon={Fingerprint} hex="#c2703d" size="xs" />
        <div>
          <p className="text-sm font-semibold text-foreground">Fingerprint &amp; face unlock</p>
          <p className="text-xs text-muted-foreground mt-0.5">Unlock instantly with this device&apos;s fingerprint or face.</p>
        </div>
      </div>

      {data.enabled ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Fingerprint unlock is enabled
          </span>
          <button onClick={() => disable()} disabled={disabling} data-testid="security-biometric-disable"
            className="h-8 px-3 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground">
            Disable
          </button>
        </div>
      ) : (
        <button onClick={() => enable()} disabled={enabling} data-testid="security-biometric-enable-toggle"
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 transition-colors flex items-center gap-1.5">
          {enabling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />}
          Enable fingerprint unlock
        </button>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const { mutate: changePassword, isPending } = useChangePassword();
  const [success, setSuccess] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function onSubmit(values: Values) {
    changePassword(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      { onSuccess: () => { form.reset(); setSuccess(true); setTimeout(() => setSuccess(false), 4000); } }
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Security" subtitle="Password, sessions, and account security" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-6">

          {/* Icon header */}
          <div className="flex flex-col items-center gap-3 py-2">
            <PremiumIcon icon={ShieldCheck} tone="gray" size="xl" />
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">Change Password</p>
              <p className="text-xs text-muted-foreground mt-1">Use a strong password with letters, numbers and symbols.</p>
            </div>
          </div>

          {success && (
            <div className="text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl px-4 py-3 text-center font-medium">
              Password updated successfully!
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Update password
              </button>
            </form>
          </div>

          <EmailChangeSection />

          <SessionsSection />

          <PasskeysSection />

          <PinSection />

          <NativeBiometricSection />

        </div>
      </PageWrapper>
    </div>
  );
}
