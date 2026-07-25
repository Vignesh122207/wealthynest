// Thin wrapper around @capawesome/capacitor-passkeys. Its options/result JSON shapes deliberately
// mirror the browser's own WebAuthn Level 3 JSON serialization (PublicKeyCredentialCreationOptionsJSON
// etc.) so the same objects our backend already generates for the browser API pass straight through
// unchanged — the plugin is what actually decides whether to call navigator.credentials (web, via
// its own bundled web implementation) or bridge to Android's Credential Manager / iOS's
// AuthenticationServices (native); this file doesn't need its own platform branch, Capacitor's
// plugin dispatch handles that.
//
// Native passkeys need a Digital Asset Links file at /.well-known/assetlinks.json declaring
// delegate_permission/common.get_login_creds for the app's package name + release signing cert's
// SHA-256 fingerprint (see public/.well-known/assetlinks.json) — without it, Android's Credential
// Manager rejects every ceremony with DOMAIN_NOT_ASSOCIATED, regardless of how correct the rest of
// this integration is.
import {
  Passkeys,
  type CreatePasskeyOptions,
  type CreatePasskeyResult,
  type GetPasskeyOptions,
  type GetPasskeyResult,
} from "@capawesome/capacitor-passkeys";

// Async (unlike a bare `!!window.PublicKeyCredential` check) because the plugin's own isAvailable()
// is the more precise, cross-platform signal — on native it checks the real OS version, on web it
// additionally confirms a user-verifying platform authenticator is actually present, not just that
// the API exists. Callers gate rendering on this via useWebAuthnSupport (see that hook's own
// comment for why a synchronous check can't answer this on native).
export async function isWebAuthnSupported(): Promise<boolean> {
  try {
    const { available } = await Passkeys.isAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function createPasskey(optionsJSON: PublicKeyCredentialCreationOptionsJSON): Promise<PublicKeyCredentialJSON> {
  const result: CreatePasskeyResult = await Passkeys.createPasskey(optionsJSON as unknown as CreatePasskeyOptions);
  return result;
}

export async function getPasskeyAssertion(optionsJSON: PublicKeyCredentialRequestOptionsJSON): Promise<PublicKeyCredentialJSON> {
  // rpId is optional in the browser's own JSON type (an omitted rpId just defaults to the current
  // origin there), but the plugin requires it explicitly since native has no "current origin" to
  // fall back on. WebAuthnServiceImpl.getAuthenticationOptions always sets it from
  // webAuthnConfig.getRpId(), so this is a real invariant, not a defensive guess.
  if (!optionsJSON.rpId) throw new Error("Missing rpId in passkey authentication options");
  const result: GetPasskeyResult = await Passkeys.getPasskey(optionsJSON as unknown as GetPasskeyOptions);
  return result;
}
