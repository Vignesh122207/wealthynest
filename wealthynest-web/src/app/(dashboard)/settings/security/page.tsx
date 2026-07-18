"use client";

import {useState} from "react";
import type {UseFormRegisterReturn} from "react-hook-form";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {
    ArrowLeft,
    Check,
    Eye,
    EyeOff,
    Fingerprint,
    KeyRound,
    Loader2,
    Mail,
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
    useEnablePin,
    usePasskeys,
    useRegisterPasskey,
} from "@/features/auth/hooks/useAuth";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {isWebAuthnSupported} from "@/features/auth/utils/webauthn";
import {formatDate} from "@/lib/utils";

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
        <PremiumIcon icon={Mail} tone="indigo" size="xs" />
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
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
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
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-colors">
          {user?.pendingEmail ? "Change to a different email" : "Change email"}
        </button>
      )}
    </div>
  );
}

const pinSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  pin:             z.string().regex(/^[0-9]{4,6}$/, "PIN must be 4 to 6 digits"),
  confirmPin:      z.string().min(1, "Required"),
}).refine(d => d.pin === d.confirmPin, { message: "PINs do not match", path: ["confirmPin"] });
type PinValues = z.infer<typeof pinSchema>;

function PinSection() {
  const { user } = useAuthStore();
  const { mutate: enablePin, isPending: enabling } = useEnablePin();
  const { mutate: disablePin, isPending: disabling } = useDisablePin();
  const [showForm, setShowForm] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const form = useForm<PinValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: { currentPassword: "", pin: "", confirmPin: "" },
  });

  const onSubmit = (values: PinValues) => {
    enablePin({ currentPassword: values.currentPassword, pin: values.pin }, {
      onSuccess: () => { form.reset(); setShowForm(false); },
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <PremiumIcon icon={KeyRound} tone="indigo" size="xs" />
          <div>
            <p className="text-sm font-semibold text-foreground">PIN unlock</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A quick 4-6 digit PIN to resume your session on this device — it only works alongside a device you&apos;ve already signed into, never as a standalone login.
            </p>
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
      ) : showForm ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <PasswordField label="Current password" reg={form.register("currentPassword")}
            error={form.formState.errors.currentPassword?.message} />
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              {...form.register("pin")}
              label="PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="4-6 digits"
              className="h-auto py-2.5"
              error={form.formState.errors.pin?.message}
            />
            <FormInput
              {...form.register("confirmPin")}
              label="Confirm PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              className="h-auto py-2.5"
              error={form.formState.errors.confirmPin?.message}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={enabling}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
              {enabling && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Enable PIN unlock
            </button>
            <button type="button" onClick={() => { setShowForm(false); form.reset(); }}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-colors">
          Set up PIN unlock
        </button>
      )}
    </div>
  );
}

function PasskeysSection() {
  const supported = isWebAuthnSupported();
  const { data: passkeys = [], isLoading } = usePasskeys();
  const { mutate: registerPasskey, isPending: registering } = useRegisterPasskey();
  const { mutate: deletePasskey } = useDeletePasskey();
  const [nickname, setNickname] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  if (!supported) return null;

  const handleAdd = () => {
    registerPasskey(nickname.trim() || "Passkey", { onSuccess: () => { setNickname(""); setShowAdd(false); } });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <PremiumIcon icon={Fingerprint} tone="indigo" size="xs" />
        <div>
          <p className="text-sm font-semibold text-foreground">Passkeys</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sign in with your device&apos;s fingerprint, face, or screen lock — no password needed.
          </p>
        </div>
      </div>

      {!isLoading && passkeys.length > 0 && (
        <div className="space-y-2">
          {passkeys.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.nickname || "Passkey"}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Added {formatDate(p.createdAt)}{p.lastUsedAt ? ` · Last used ${formatDate(p.lastUsedAt)}` : ""}
                </p>
              </div>
              <button onClick={() => deletePasskey(p.id)} title="Remove passkey"
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
              placeholder="e.g. My iPhone"
              className="h-9"
              aria-label="Passkey nickname"
            />
          </div>
          <button onClick={handleAdd} disabled={registering}
            className="h-9 px-3.5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 transition-colors flex items-center gap-1.5">
            {registering && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {registering ? "Follow your device's prompt…" : "Continue"}
          </button>
          <button onClick={() => setShowAdd(false)}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="h-9 px-3.5 rounded-xl text-xs font-medium bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-colors">
          Add a passkey
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

          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>

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
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Update password
              </button>
            </form>
          </div>

          <EmailChangeSection />

          <PasskeysSection />

          <PinSection />

        </div>
      </PageWrapper>
    </div>
  );
}
