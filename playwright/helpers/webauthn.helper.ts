import type {Page} from "@playwright/test";

/** Attaches a Chromium CDP virtual authenticator to the page so
 * `navigator.credentials.create()`/`.get()` (see wealthynest-web's utils/webauthn.ts) resolve
 * automatically instead of hanging on a real device prompt — this is what lets security.spec.ts
 * drive a genuine passkey register+login round trip instead of stopping at the
 * button-renders/request-fires boundary this suite otherwise stops at (see README's "Known
 * gaps"). Chromium/CDP-only — call before any WebAuthn UI interaction, and only under the
 * chromium project (this suite's default; see README's "chromium only, on purpose"). */
export async function addVirtualAuthenticator(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}
