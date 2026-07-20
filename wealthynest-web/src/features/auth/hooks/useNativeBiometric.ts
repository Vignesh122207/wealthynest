"use client";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {
  BiometryErrorType,
  disableBiometricPinUnlock,
  enableBiometricPinUnlock,
  hasBiometricPinStored,
  isBiometryError,
  isNativeBiometricAvailable,
  isNativePlatform,
} from "../utils/nativeBiometric";

const NATIVE_BIOMETRIC_QUERY_KEY = ["auth", "nativeBiometric"];

/** Whether this account can offer PIN-via-fingerprint on this device right now: running inside
 * the native Android shell, the device has enrolled biometrics, and a PIN has been saved to
 * secure storage for it. See nativeBiometric.ts for why this is scoped to PIN-only accounts. */
export function useNativeBiometricStatus() {
  return useQuery({
    queryKey: NATIVE_BIOMETRIC_QUERY_KEY,
    queryFn: async () => {
      if (!isNativePlatform()) return { available: false, pinStored: false };
      const [available, pinStored] = await Promise.all([isNativeBiometricAvailable(), hasBiometricPinStored()]);
      return { available, pinStored };
    },
  });
}

export function useEnableBiometricPinUnlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pin: string) => enableBiometricPinUnlock(pin),
    onSuccess: () => qc.invalidateQueries({ queryKey: NATIVE_BIOMETRIC_QUERY_KEY }),
    onError: (e: unknown) => {
      if (isBiometryError(e) && e.code === BiometryErrorType.userCancel) return; // user cancelled — silent
      toast.error("Couldn't enable fingerprint unlock");
    },
  });
}

export function useDisableBiometricPinUnlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: disableBiometricPinUnlock,
    onSuccess: () => qc.invalidateQueries({ queryKey: NATIVE_BIOMETRIC_QUERY_KEY }),
  });
}
