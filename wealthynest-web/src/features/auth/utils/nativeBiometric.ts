// Bare fingerprint/face app-lock for the native shell — a purely local UI gate, not a credential.
// The device's own BiometricPrompt (TEE-backed, checked only against fingerprints the OS owner
// enrolled in Android/iOS Settings) IS the security boundary here; there's nothing further to
// prove to the server, because the session behind the lock screen is already valid the whole
// time it's up (see AppLockScreen's own comment — this is a local re-proof, not a re-login).
// That's also why this stores no secret at all: "enabling" just remembers a boolean preference
// after confirming the device can pass a biometric check; "unlocking" just re-runs that same
// check and, on success, clears the lock screen directly.
import { Capacitor } from "@capacitor/core";
import { BiometricAuth, BiometryError, BiometryErrorType } from "@aparajita/capacitor-biometric-auth";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";

// Re-exported so callers only ever depend on this platform-boundary module, not the raw plugin
// package directly — keeps the plugin's own registerPlugin() side effects out of component/hook
// code and out of their test mocks.
export { BiometryErrorType };

const ENABLED_KEY = "wealthynest.applock.biometricEnabled";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  const { isAvailable } = await BiometricAuth.checkBiometry();
  return isAvailable;
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    await SecureStoragePlugin.get({ key: ENABLED_KEY });
    return true;
  } catch {
    return false;
  }
}

/** Confirms the device can actually pass a biometric check right now, then remembers the
 * preference. Throws (as a `BiometryError`) if the prompt fails or is cancelled — nothing gets
 * enabled in that case. */
export async function enableBiometricUnlock(): Promise<void> {
  await BiometricAuth.authenticate({ reason: "Enable fingerprint unlock" });
  await SecureStoragePlugin.set({ key: ENABLED_KEY, value: "true" });
}

export async function disableBiometricUnlock(): Promise<void> {
  await SecureStoragePlugin.remove({ key: ENABLED_KEY });
}

/** Prompts biometric and resolves on success. Callers use this to clear the lock screen directly
 * — no server round trip, no stored secret to retrieve, since the session underneath is already
 * valid the whole time the screen is up. */
export async function verifyBiometric(): Promise<void> {
  await BiometricAuth.authenticate({ reason: "Unlock WealthyNest" });
}

export function isBiometryError(e: unknown): e is BiometryError {
  return e instanceof BiometryError;
}
