"use client";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {authApi} from "../api/auth.api";
import {useAuthStore} from "../store/auth.store";
import {createPasskey, getPasskeyAssertion} from "../utils/webauthn";
import {disableBiometricPinUnlock} from "../utils/nativeBiometric";
import type {LoginFormValues, RegisterFormValues} from "../schemas/auth.schema";

type ApiError = { response?: { data?: { message?: string; error?: string } } };

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: LoginFormValues) =>
      authApi.login({ email: v.email, password: v.password, rememberMe: v.rememberMe ?? false }),
    onSuccess: (data) => {
      qc.clear();
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome back, ${data.user.fullName.split(" ")[0]}!`);
      router.push("/home");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Login failed"),
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
  const { refreshToken, logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { if (refreshToken) await authApi.logout(refreshToken); },
    onSettled: () => { qc.clear(); logout(); router.push("/login"); },
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
    mutationFn: ({ currentPassword, pin }: { currentPassword: string; pin: string }) =>
      authApi.enablePin(currentPassword, pin),
    onSuccess: () => {
      if (user) setUser({ ...user, pinEnabled: true });
      toast.success("PIN unlock enabled");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Failed to enable PIN"),
  });
}

export function useDisablePin() {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.disablePin(),
    // A PIN disabled server-side but still sitting in native secure storage would just fail
    // biometric unlock with a stale "incorrect PIN" later — harmless, but worth clearing so state
    // doesn't linger orphaned. No-op on web.
    onSuccess: async () => {
      if (user) setUser({ ...user, pinEnabled: false });
      await disableBiometricPinUnlock();
      qc.invalidateQueries({ queryKey: ["auth", "nativeBiometric"] });
      toast.success("PIN unlock disabled");
    },
    onError: () => toast.error("Failed to disable PIN"),
  });
}

export function usePinLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ refreshToken, pin }: { refreshToken: string; pin: string }) =>
      authApi.pinLogin(refreshToken, pin),
    onSuccess: (data) => {
      qc.clear();
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome back, ${data.user.fullName.split(" ")[0]}!`);
      router.push("/home");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Incorrect PIN"),
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
    mutationFn: ({ refreshToken, pin }: { refreshToken: string; pin: string }) =>
      authApi.pinLogin(refreshToken, pin),
    onSuccess: (data) => setAuth(data.user, data.accessToken, data.refreshToken),
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Incorrect PIN"),
  });
}

export function useUnlockWithPasskey() {
  const { user, setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async (rememberMe: boolean) => {
      if (!user?.email) throw new Error("No active session");
      const options = await authApi.getPasskeyLoginOptions(user.email);
      const credential = await getPasskeyAssertion(options);
      return authApi.passkeyLogin(user.email, credential, rememberMe);
    },
    onSuccess: (data) => setAuth(data.user, data.accessToken, data.refreshToken),
    onError: (e: unknown) => {
      if (e instanceof DOMException && e.name === "NotAllowedError") return; // user cancelled — silent
      const err = e as ApiError;
      toast.error(err.response?.data?.message ?? "Passkey unlock failed");
    },
  });
}

export function usePasskeys() {
  return useQuery({
    queryKey: ["auth", "passkeys"],
    queryFn:  authApi.listPasskeys,
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

export function usePasskeyLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, rememberMe }: { email: string; rememberMe: boolean }) => {
      const options = await authApi.getPasskeyLoginOptions(email);
      const credential = await getPasskeyAssertion(options);
      return authApi.passkeyLogin(email, credential, rememberMe);
    },
    onSuccess: (data) => {
      qc.clear();
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome back, ${data.user.fullName.split(" ")[0]}!`);
      router.push("/home");
    },
    onError: (e: unknown) => {
      if (e instanceof DOMException && e.name === "NotAllowedError") return; // user cancelled — silent
      const err = e as ApiError;
      toast.error(err.response?.data?.message ?? "Passkey sign-in failed");
    },
  });
}

export function useGoogleLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idToken, rememberMe }: { idToken: string; rememberMe: boolean }) =>
      authApi.googleLogin(idToken, rememberMe),
    onSuccess: (data) => {
      qc.clear();
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome, ${data.user.fullName.split(" ")[0]}!`);
      router.push("/home");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Google sign-in failed"),
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
