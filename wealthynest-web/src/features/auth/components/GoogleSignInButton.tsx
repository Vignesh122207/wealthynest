"use client";

import {useEffect, useState} from "react";
import Script from "next/script";
import {Capacitor} from "@capacitor/core";
import {GenericOAuth2} from "@capacitor-community/generic-oauth2";
import {Loader2} from "lucide-react";
import {toast} from "sonner";
import {useGoogleLogin, useGoogleLoginNative} from "../hooks/useAuth";

// Minimal shape of the Google Identity Services API this component actually calls —
// https://accounts.google.com/gsi/client doesn't ship its own types, and pulling in a full
// @types package for two methods isn't worth the dependency.
interface PromptMomentNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
}
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
  prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

// For a "Desktop app" type OAuth client, Google does NOT accept an arbitrary app-chosen custom
// scheme for the redirect — it only accepts `com.googleusercontent.apps.<client-id>`, derived
// from the client ID itself (confirmed the hard way: Google's /auth endpoint rejected
// "in.wealthynest.app://oauth2redirect" with a 400 invalid_request on redirect_uri, even though
// that scheme is registered correctly on the Android side). Deriving it from the client ID here
// — instead of hardcoding the resulting string — means it can never drift out of sync if the
// native OAuth client is ever rotated.
function nativeRedirectUrlFor(clientId: string): string {
  return `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, "")}:/oauth2redirect`;
}

function GoogleLogo() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// Fully our own button (used by both native and web below) rather than Google's rendered widget —
// GIS's iframe-rendered button only exposes small/medium/large size presets and its own corner
// radius, neither of which can be made to actually match this app's own buttons (h-11/rounded-xl,
// same as "Continue with email" and every other secondary-emphasis button here); a previous
// attempt to force it into alignment via a measured CSS scale still wasn't reliably right. Google's
// own colors (white/#1F1F1F/logo) stay untouched regardless of app theme — see the style prop
// below for why: it's Google's mark, and a dark-mode-tinted version of someone else's brand button
// reads as an inconsistent knockoff next to the real thing, not as "matching our theme."
function GoogleButtonChrome({ onClick, busy, testId }: { onClick: () => void; busy: boolean; testId: string }) {
  return (
    <div className="relative">
      {/* Soft copper glow behind the button — same treatment AppLockScreen uses behind the brand
          icon, so it reads as a designed part of this app rather than a plain default. */}
      <div className="absolute inset-0 rounded-xl bg-[#c2703d]/20 blur-lg scale-105" aria-hidden />
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        data-testid={testId}
        style={{ backgroundColor: "#FFFFFF", color: "#1F1F1F", border: "1px solid #747775" }}
        className="relative w-full h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2.5
          shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:bg-[#F8F9FA]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2703d]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background
          disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleLogo />}
        {busy ? "Signing in…" : "Continue with Google"}
      </button>
    </div>
  );
}

// The web/GIS flow (Google Identity Services' JS SDK) doesn't work inside an embedded Android
// WebView — Google deliberately blocks/degrades it there (`disallowed_useragent`) — so native
// goes through a Custom Tab (a real, non-embedded browser context) via generic-oauth2 instead.
//
// Deliberately does NOT set `accessTokenEndpoint` on the authenticate() call below, so the plugin
// stops at the authorization code instead of attempting its own token exchange. Google requires a
// client secret for that exchange on this "Desktop app" client type even with PKCE enabled — that
// isn't an assumption, it's confirmed against Google's own OAuth docs — and generic-oauth2's
// Android side has no option anywhere to attach one (its TokenRequest is built via AppAuth's
// `createTokenExchangeRequest()` with no client authentication). Every native sign-in used to
// reach Google's token endpoint and get rejected there, one step past the account picker. Instead
// the code + PKCE verifier go to useGoogleLoginNative, which hits a backend endpoint that holds
// the secret server-side and does the exchange itself (see AuthServiceImpl.googleLoginNative).
// The web flow below still gets its ID token directly from GIS and calls useGoogleLogin as before
// — only the native path needed this detour.
function NativeGoogleSignInButton() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_NATIVE_CLIENT_ID;
  const { mutate: googleLoginNative, isPending } = useGoogleLoginNative();
  const [authenticating, setAuthenticating] = useState(false);

  if (!clientId) return null;
  const redirectUrl = nativeRedirectUrlFor(clientId);

  const handleSignIn = async () => {
    setAuthenticating(true);
    try {
      const result = await GenericOAuth2.authenticate({
        appId: clientId,
        authorizationBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        responseType: "code",
        pkceEnabled: true,
        scope: "openid email profile",
        android: { redirectUrl },
      });
      // Without accessTokenEndpoint, the plugin resolves with just the raw AppAuth authorization
      // response (see GenericOAuth2Plugin.java's resolveAuthorizationResponse) — the code sits at
      // authorization_response.code, and the PKCE verifier this same request generated sits at
      // authorization_response.request.codeVerifier (confirmed against AppAuth's own
      // AuthorizationResponse/AuthorizationRequest jsonSerialize() field names).
      const code = result?.authorization_response?.code as string | undefined;
      const codeVerifier = result?.authorization_response?.request?.codeVerifier as string | undefined;
      if (!code || !codeVerifier) throw new Error("No authorization code returned");
      // Always the long-lived session — see useLogin's own comment for why there's no checkbox
      // asking; the PIN/fingerprint/passkey lock screen is what actually gates return access.
      googleLoginNative({ code, redirectUri: redirectUrl, codeVerifier, rememberMe: true });
    } catch (e) {
      // User closing the Custom Tab lands here as a rejected promise with message "USER_CANCELLED"
      // (GenericOAuth2Plugin.java's USER_CANCELLED constant) — silent, same as the biometric/passkey
      // cancel paths elsewhere in this app. Anything else (a real failure, e.g. the missing-code
      // case above) surfaces a toast instead of failing silently back to the login screen.
      const message = e instanceof Error ? e.message : String(e);
      if (message !== "USER_CANCELLED") toast.error("Google sign-in failed. Please try again.");
    } finally {
      setAuthenticating(false);
    }
  };

  return <GoogleButtonChrome onClick={handleSignIn} busy={authenticating || isPending} testId="google-signin-native-button" />;
}

function WebGoogleSignInButton() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const { mutate: googleLogin } = useGoogleLogin();
  const [pending, setPending] = useState(false);

  const handleScriptLoad = () => {
    if (!clientId || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      // Always the long-lived session — see useLogin's own comment for why there's no checkbox.
      callback: (response) => { setPending(false); googleLogin({ idToken: response.credential, rememberMe: true }); },
    });
  };

  useEffect(() => {
    // Script may already be loaded (client-side nav back to /login) — Script's onLoad won't
    // re-fire in that case, so initialize on mount too if the API is already present.
    handleScriptLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!clientId) return null;

  // No rendered widget to click — google.accounts.id.prompt() triggers the same underlying GIS
  // sign-in flow (One Tap / FedCM depending on browser) programmatically, calling back to
  // initialize()'s callback above with the ID token exactly like clicking Google's own button
  // would. This is what lets the visible button be entirely our own, styled to match the rest of
  // the card, instead of an iframe Google renders and sizes itself.
  const handleClick = () => {
    if (!window.google) {
      toast.error("Still loading — please try again in a moment.");
      return;
    }
    setPending(true);
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setPending(false);
        toast.error("Google sign-in isn't available right now. Please try again.");
      } else if (notification.isDismissedMoment()) {
        // Covers both "user cancelled" (silent, same as the biometric/passkey cancel paths
        // elsewhere in this app) and "succeeded" (initialize()'s callback already fired above).
        setPending(false);
      }
    });
  };

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={handleScriptLoad} />
      <GoogleButtonChrome onClick={handleClick} busy={pending} testId="google-signin-web-button" />
    </>
  );
}

export function GoogleSignInButton() {
  return Capacitor.isNativePlatform() ? <NativeGoogleSignInButton /> : <WebGoogleSignInButton />;
}

// Native and web read different env vars (see nativeRedirectUrlFor's own comment above for why) —
// this lets callers that wrap GoogleSignInButton in their own surrounding UI (SignupForm's "or
// create an account with email" divider) check the one that actually applies on the current
// platform, instead of hardcoding the web var and hiding that wrapper UI on native.
export function isGoogleSignInConfigured(): boolean {
  return Capacitor.isNativePlatform()
    ? !!process.env.NEXT_PUBLIC_GOOGLE_NATIVE_CLIENT_ID
    : !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}
