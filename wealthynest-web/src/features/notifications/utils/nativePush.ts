// FCM push registration for the native shell — see ANDROID_APP_ROADMAP.md's "Known gap: push
// notifications" for why this exists: a Capacitor WebView doesn't get push "for free" the way the
// TWA it replaced did, so this uses the real @capacitor/push-notifications plugin (backed by
// Firebase Cloud Messaging) instead of the WebView's own (unreliable) Push API.
import { Capacitor } from "@capacitor/core";
import { PushNotifications, type PushNotificationSchema, type ActionPerformed } from "@capacitor/push-notifications";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// Remembered in-memory so a logout in the same app session can best-effort unregister the token
// it just registered — no new store for a single read/write site (see useAuth.ts's useLogout).
// Deliberately not persisted: a killed-and-relaunched app re-registers on its next authenticated
// mount anyway, and a token left behind past a session boundary is harmless — it just gets
// pruned server-side the next time a push to it comes back UNREGISTERED.
let lastRegisteredToken: string | null = null;

export function getLastRegisteredPushToken(): string | null {
  return lastRegisteredToken;
}

/** Requests notification permission and, if granted, registers with FCM and resolves the device
 * token. Resolves `null` (no throw) when permission is denied — same silent-decline treatment as
 * biometric enrollment's `userCancel`, since a user saying no to a permission prompt isn't an
 * error. Rejects only on an actual registration failure (`registrationError`). */
export async function registerForPush(): Promise<string | null> {
  if (!isNativePlatform()) return null;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return null;

  return new Promise((resolve, reject) => {
    PushNotifications.addListener("registration", (token) => {
      lastRegisteredToken = token.value;
      resolve(token.value);
    });
    PushNotifications.addListener("registrationError", (error) => {
      reject(new Error(error.error));
    });
    PushNotifications.register();
  });
}

export function addPushForegroundListener(handler: (notification: PushNotificationSchema) => void) {
  if (!isNativePlatform()) return Promise.resolve({ remove: async () => {} });
  return PushNotifications.addListener("pushNotificationReceived", handler);
}

export function addPushTapListener(handler: (action: ActionPerformed) => void) {
  if (!isNativePlatform()) return Promise.resolve({ remove: async () => {} });
  return PushNotifications.addListener("pushNotificationActionPerformed", handler);
}
