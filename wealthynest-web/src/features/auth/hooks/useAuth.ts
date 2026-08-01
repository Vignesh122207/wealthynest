"use client";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {authApi} from "../api/auth.api";
import {useAuthStore} from "../store/auth.store";
import {clearPasskeyDismissedOnDevice, useAppLockStore} from "../store/appLock.store";
import {createPasskey, getPasskeyAssertion} from "../utils/webauthn";
import {deriveLockoutState} from "../utils/lockout";
import type {LoginFormValues, RegisterFormValues} from "../schemas/auth.schema";
import {notificationsApi} from "@/features/notifications/api/notifications.api";
import {getLastRegisteredPushToken} from "@/features/notifications/utils/nativePush";
import {apiErrorCode} from "@/lib/utils";

type ApiError = { response?: { data?: { message?: string; error?: string } } };

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    // Always the long-lived session — no "remember me" checkbox to ask, since the PIN/fingerprint/
    // passkey lock screen (see AppLockScreen/useAppLockTrigger) is the thing actually gating access
    // on return, the same pattern real banking apps use. A short-lived option only made sense back
    // when this was the only line of defense.
    mutationFn: (v: LoginFormValues) =>
      authApi.login({ email: v.email, password: v.password, rememberMe: true }),
    // No success toast — landing on /home, which greets you by name in its own GreetingBanner,
    // is already the confirmation; a toast on top of that is one more thing competing for
    // attention during a navigation that's already in flight, not new information.
    onSuccess: (data) => {
      qc.clear();
      setAuth(data.user, data.accessToken);
      // A fresh, successful login should never immediately re-show the app-lock screen — either
      // because of a "went hidden at" marker left over from an earlier, unrelated session (e.g.
      // one that ended via axios.ts's forced logout on a failed token refresh, which can't call
      // the normal useLogout() path — see that call site's own comment), or because `isLocked`
      // itself is still stale-true from before this login: it's plain in-memory Zustand state, so
      // it survives an in-app router.push() (unlike a real page reload — and the Capacitor WebView
      // never does one). Real bug this fixes: sign out from the lock screen via "Use password
      // instead", log back in with that password, and the session you just proved re-shows the
      // very lock screen you signed out to get past. unlock() clears both markers in one call.
      useAppLockStore.getState().unlock();
      // replace, not push: this device's WebView history (which Android's hardware back button
      // navigates through — see useHardwareBackButton) must not keep /login reachable by going
      // back from /home right after signing in. Real bug this fixes: sign in with Google, press
      // Android's back button once, and land right back on the login form despite being fully
      // authenticated — a push here left /login as the previous history entry underneath /home.
      router.replace("/home");
    },
    // ACCOUNT_LOCKED/RATE_LIMIT_EXCEEDED are rendered as a LockoutBanner with a live countdown at
    // the call site instead — see LoginForm's PasswordLoginStep — so skip the toast there to avoid
    // showing the same "too many attempts" message twice.
    onError: (e: ApiError) => { if (!deriveLockoutState(e)) toast.error(e.response?.data?.message ?? "Login failed"); },
  });
}

export function useRegister() {
  const router = useRouter();
  return useMutation({
    mutationFn: (v: RegisterFormValues) =>
      authApi.register({ fullName: v.fullName, email: v.email, password: v.password }),
    onSuccess: (_data, variables) => {
      toast.success("Account created! Check your email to verify.");
      router.push(`/verify-email?email=${encodeURIComponent(variables.email)}`);
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Registration failed"),
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      // Fire-and-forget, not awaited — a native device's push token shouldn't block logout, and a
      // token left behind past this session is harmless (see nativePush.ts's own comment; it just
      // gets pruned server-side the next time a push to it comes back UNREGISTERED).
      const token = getLastRegisteredPushToken();
      if (token) notificationsApi.unregisterDeviceToken(token).catch(() => {});
      return authApi.logout();
    },
    // unlock() (not just the hidden-at marker) — signing out must also drop the in-memory
    // `isLocked` flag itself, or it stays stale-true across this in-app navigation to /login and
    // the very next login on this device (e.g. right after "Use password instead") lands on
    // /home only to have that stale flag immediately re-show the lock screen it just escaped.
    onSettled: () => { qc.clear(); logout(); useAppLockStore.getState().unlock(); router.push("/login"); },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Verification failed. Link may have expired."),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => toast.success("Verification email sent. Check your inbox."),
    onError: () => toast.error("Could not resend. Please try again."),
  });
}

export function useUpdateProfile() {
  const { setUser } = useAuthStore();
  return useMutation({
    mutationFn: (data: { fullName?: string }) => authApi.updateProfile(data),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success("Profile updated");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Update failed"),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => authApi.changePassword(data),
    onSuccess: () => toast.success("Password changed successfully"),
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Password change failed"),
  });
}

export function useChangeEmail() {
  const { user, setUser } = useAuthStore();
  return useMutation({
    mutationFn: (data: { newEmail: string; currentPassword: string }) => authApi.changeEmail(data),
    onSuccess: (_, vars) => {
      // The real `email` doesn't change until the link is clicked — only reflect the pending
      // state locally so the UI can show "verification sent to X" without waiting on a refetch.
      if (user) setUser({ ...user, pendingEmail: vars.newEmail });
      toast.success(`Verification link sent to ${vars.newEmail}`);
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Failed to change email"),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    // Safe to surface directly (not the anti-enumeration case) — the backend already returns a
    // generic success regardless of whether the email is registered (see ForgotPasswordForm's own
    // "If {email} is registered..." copy), so onError here only ever fires for a genuine
    // network/server failure, not "no such account". Was previously silent — the button just
    // reverted to its idle state with zero feedback on a real failure.
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Could not send reset link. Please try again."),
  });
}

export function useResetPassword() {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
    onSuccess: () => {
      toast.success("Password reset successfully. Please sign in.");
      router.push("/login");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Reset failed. Link may have expired."),
  });
}

export function useEnablePin() {
  const { user, setUser } = useAuthStore();
  return useMutation({
    mutationFn: (pin: string) => authApi.enablePin(pin),
    onSuccess: () => {
      if (user) setUser({ ...user, pinEnabled: true });
      toast.success("PIN unlock enabled");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Failed to enable PIN"),
  });
}

export function useDisablePin() {
  const { user, setUser } = useAuthStore();
  return useMutation({
    mutationFn: (pin: string) => authApi.disablePin(pin),
    onSuccess: () => {
      if (user) setUser({ ...user, pinEnabled: false });
      toast.success("PIN unlock disabled");
    },
    // PIN_LOCKED renders as a LockoutBanner and a wrong PIN as a cell shake, both inline at the
    // call site (PinVerifyModal) — same reasoning as useUnlockWithPin's own comment on skipping
    // the toast for those. Only something genuinely unexpected still toasts here.
    onError: (e: ApiError) => {
      if (deriveLockoutState(e) || apiErrorCode(e) === "INVALID_PIN") return;
      toast.error(e.response?.data?.message ?? "Failed to disable PIN");
    },
  });
}

export function usePinLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    // No refreshToken param — the anchoring session is read off the httpOnly cookie server-side.
    mutationFn: (pin: string) => authApi.pinLogin(pin),
    // No success toast — see useLogin's comment for why.
    onSuccess: (data) => {
      qc.clear();
      setAuth(data.user, data.accessToken);
      useAppLockStore.getState().unlock(); // see useLogin's own comment for why
      router.replace("/home"); // see useLogin's own comment for why this isn't push
    },
    // PIN_LOCKED/RATE_LIMIT_EXCEEDED render as a LockoutBanner at the call site instead — see
    // deriveLockoutState's own comment on useLogin above for why the toast is skipped there.
    onError: (e: ApiError) => { if (!deriveLockoutState(e)) toast.error(e.response?.data?.message ?? "Incorrect PIN"); },
  });
}

// Deliberately separate from usePinLogin/usePasskeyLogin rather than reusing them: those clear
// the whole query cache and redirect to /home, correct for a real login landing fresh, but wrong
// for the app-lock screen — the user never left their page, so unlocking should just re-arm the
// session in place (new rotated tokens) without wiping already-loaded data or navigating them
// away from wherever they were.
export function useUnlockWithPin() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: (pin: string) => authApi.pinLogin(pin),
    onSuccess: (data) => setAuth(data.user, data.accessToken),
    // PIN_LOCKED/RATE_LIMIT_EXCEEDED render as a LockoutBanner at the call site instead — see
    // deriveLockoutState's own comment on useLogin above for why the toast is skipped there.
    onError: (e: ApiError) => { if (!deriveLockoutState(e)) toast.error(e.response?.data?.message ?? "Incorrect PIN"); },
  });
}

export function useUnlockWithPasskey() {
  const { user, setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async (rememberMe: boolean) => {
      if (!user?.email) throw new Error("No active session");
      const options = await authApi.getPasskeyLoginOptions(user.email);
      const credential = await getPasskeyAssertion(options);
      // This device already has a valid session (that's the whole premise of an app-lock unlock)
      // — the server reads it off the httpOnly cookie already riding along on this request and
      // revokes it, instead of leaving it active alongside the freshly-minted one. See
      // auth.api.ts#passkeyLogin's own comment.
      return authApi.passkeyLogin(user.email, credential, rememberMe);
    },
    onSuccess: (data) => setAuth(data.user, data.accessToken),
    onError: (e: unknown) => {
      if (e instanceof DOMException && e.name === "NotAllowedError") return; // user cancelled — silent
      const err = e as ApiError;
      toast.error(err.response?.data?.message ?? "Passkey unlock failed");
    },
  });
}

// Gated on isAuthenticated (not just left to fire and 401) because one of this hook's callers —
// useAppLockTrigger — mounts unconditionally from DashboardLayout on every cold launch, logged in
// or not (capacitor.config.ts's server.url always loads /home first). That 401 doesn't just get
// silently swallowed: /users/me/webauthn/passkeys isn't under the axios interceptor's
// isAuthEndpoint ("/auth/**") exemption, so a logged-out request to it fell into the refresh-token
// flow, found no refresh token, and forced a hard `window.location.href = "/login"` reload — the
// "white flash + something flickers" bug this fixes, not just a wasted request.
export function usePasskeys() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["auth", "passkeys"],
    queryFn:  authApi.listPasskeys,
    enabled:  isAuthenticated,
  });
}

export function useRegisterPasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nickname: string) => {
      const options = await authApi.getPasskeyRegistrationOptions();
      const credential = await createPasskey(options);
      await authApi.verifyPasskeyRegistration(credential, nickname);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "passkeys"] });
      // This browser just proved it has a working credential store — any earlier "don't show the
      // fingerprint button on this device" from AppLockScreen is stale as of right now.
      clearPasskeyDismissedOnDevice();
      toast.success("Passkey added");
    },
    onError: (e: unknown) => {
      if (e instanceof DOMException && e.name === "NotAllowedError") return; // user cancelled — silent
      toast.error("Failed to add passkey");
    },
  });
}

export function useDeletePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.deletePasskey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "passkeys"] });
      toast.success("Passkey removed");
    },
    onError: () => toast.error("Failed to remove passkey"),
  });
}

// Shared onSuccess for every Google sign-in mutation below (ID token, native code, web popup
// fallback code) — all three land the user the same way once the backend hands back a session.
function useGoogleAuthOnSuccess() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return (data: Awaited<ReturnType<typeof authApi.googleLogin>>) => {
    qc.clear();
    setAuth(data.user, data.accessToken);
    useAppLockStore.getState().unlock(); // see useLogin's own comment for why
    router.replace("/home"); // see useLogin's own comment for why this isn't push
  };
}

export function useGoogleLogin() {
  const onSuccess = useGoogleAuthOnSuccess();
  return useMutation({
    mutationFn: ({ idToken, rememberMe }: { idToken: string; rememberMe: boolean }) =>
      authApi.googleLogin(idToken, rememberMe),
    // No success toast — see useLogin's comment for why.
    onSuccess,
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Google sign-in failed"),
  });
}

// Native Android counterpart — see auth.api.ts's googleLoginNative comment for why this posts an
// authorization code + PKCE verifier instead of an ID token.
export function useGoogleLoginNative() {
  const onSuccess = useGoogleAuthOnSuccess();
  return useMutation({
    mutationFn: authApi.googleLoginNative,
    onSuccess,
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Google sign-in failed"),
  });
}

// Web fallback used when One Tap's silent prompt() is blocked/skipped — see auth.api.ts's
// googleLoginPopup comment.
export function useGoogleLoginPopup() {
  const onSuccess = useGoogleAuthOnSuccess();
  return useMutation({
    mutationFn: authApi.googleLoginPopup,
    onSuccess,
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Google sign-in failed"),
  });
}

// The backend flags which row is "this device" by reading the httpOnly refresh-token cookie
// already riding along on the request — see auth.api.ts#listSessions and
// UserController#listSessions.
export function useSessions() {
  return useQuery({
    queryKey: ["auth", "sessions"],
    queryFn:  () => authApi.listSessions(),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
      toast.success("Device signed out");
    },
    onError: () => toast.error("Failed to sign out that device"),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
      toast.success("Signed out of all other devices");
    },
    onError: () => toast.error("Failed to sign out other devices"),
  });
}

export function useCloseAccount() {
  const { logout } = useAuthStore();
  const router     = useRouter();
  const qc         = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.closeAccount(),
    onSuccess: () => {
      qc.clear();
      logout();
      router.push("/login");
      toast.success("Account closed. Sorry to see you go.");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Failed to close account"),
  });
}
