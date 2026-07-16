// Thin wrapper around the browser's native WebAuthn JSON API — no npm dependency needed since
// modern browsers (Chrome 122+, Safari 17.4+, Firefox 122+) implement
// PublicKeyCredential.parseCreationOptionsFromJSON/.parseRequestOptionsFromJSON and
// credential.toJSON() natively, handling all the ArrayBuffer<->base64url conversion for us.

export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export async function createPasskey(optionsJSON: PublicKeyCredentialCreationOptionsJSON): Promise<PublicKeyCredentialJSON> {
  const options = PublicKeyCredential.parseCreationOptionsFromJSON(optionsJSON);
  const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
  return credential.toJSON();
}

export async function getPasskeyAssertion(optionsJSON: PublicKeyCredentialRequestOptionsJSON): Promise<PublicKeyCredentialJSON> {
  const options = PublicKeyCredential.parseRequestOptionsFromJSON(optionsJSON);
  const credential = await navigator.credentials.get({ publicKey: options }) as PublicKeyCredential;
  return credential.toJSON();
}
