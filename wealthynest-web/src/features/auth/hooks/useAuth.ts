"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import type { LoginFormValues, RegisterFormValues } from "../schemas/auth.schema";

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
      router.push("/dashboard");
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
    mutationFn: (data: { fullName?: string; email?: string }) => authApi.updateProfile(data),
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
