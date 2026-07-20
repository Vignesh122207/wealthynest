// Thin wrapper around the Capacitor native biometric + secure-storage plugins — mirrors
// webauthn.ts's role as the platform-API boundary, kept mockable in tests. Deliberately scoped to
// PIN-only accounts: a passkey account's WebAuthn ceremony already surfaces Android's native
// fingerprint prompt on its own (Credential Manager), so gating that behind this plugin too would
// double-prompt. The PIN itself lives in Android Keystore-backed secure storage (not
// localStorage/preferences) so only a successful biometric check can retrieve it — see
// AppLockScreen for how it's then submitted through the same server-verified unlock as a typed
// PIN, never accepted as proof of identity on its own.
import { Capacitor } from "@capacitor/core";
import { BiometricAuth, BiometryError, BiometryErrorType } from "@aparajita/capacitor-biometric-auth";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";

// Re-exported so callers only ever depend on this platform-boundary module, not the raw plugin
// package directly — keeps the plugin's own registerPlugin() side effects out of component/hook
// code and out of their test mocks.
export { BiometryErrorType };

const STORED_PIN_KEY = "wealthynest.applock.pin";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function isNativeBiometricAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  const { isAvailable } = await BiometricAuth.checkBiometry();
  return isAvailable;
}

export async function hasBiometricPinStored(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    await SecureStoragePlugin.get({ key: STORED_PIN_KEY });
    return true;
  } catch {
    return false;
  }
}

/** Confirms the user's biometric identity, then stores the PIN so a future biometric check alone
 * can retrieve it. Throws (as a `BiometryError`) if the biometric prompt fails or is cancelled. */
export async function enableBiometricPinUnlock(pin: string): Promise<void> {
  await BiometricAuth.authenticate({ reason: "Confirm it's you to enable fingerprint unlock" });
  await SecureStoragePlugin.set({ key: STORED_PIN_KEY, value: pin });
}

export async function disableBiometricPinUnlock(): Promise<void> {
  await SecureStoragePlugin.remove({ key: STORED_PIN_KEY });
}

/** Prompts for biometric authentication and, on success, returns the PIN stored by
 * `enableBiometricPinUnlock`. The caller still submits this PIN through the normal server-verified
 * unlock — biometric success only proves "this device", not "this account". */
export async function retrievePinViaBiometric(): Promise<string> {
  await BiometricAuth.authenticate({ reason: "Unlock WealthyNest" });
  const { value } = await SecureStoragePlugin.get({ key: STORED_PIN_KEY });
  return value;
}

export function isBiometryError(e: unknown): e is BiometryError {
  return e instanceof BiometryError;
}
