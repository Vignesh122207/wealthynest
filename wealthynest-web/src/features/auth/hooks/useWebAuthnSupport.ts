"use client";

import {useEffect, useState} from "react";
import {isWebAuthnSupported} from "../utils/webauthn";

/** Resolves whether this device can actually do a passkey ceremony — async because, on native,
 * that requires an out-to-native round trip (see webauthn.ts's isWebAuthnSupported for why a
 * synchronous `!!window.PublicKeyCredential` check can't answer this inside Capacitor's WebView).
 * Starts `false` on every render until that resolves, same SSR/first-paint safety reasoning as the
 * `hydrated` flags elsewhere in this feature — never assume support before the check actually
 * lands, in either direction. Shared by AppLockScreen, LoginForm, and SecurityPage's Passkeys
 * section instead of each duplicating the same state+effect. */
export function useWebAuthnSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isWebAuthnSupported().then((result) => {
      if (!cancelled) setSupported(result);
    });
    return () => { cancelled = true; };
  }, []);

  return supported;
}
