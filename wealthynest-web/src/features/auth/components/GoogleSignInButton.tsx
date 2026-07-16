"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { useGoogleLogin } from "../hooks/useAuth";

// Minimal shape of the Google Identity Services API this component actually calls —
// https://accounts.google.com/gsi/client doesn't ship its own types, and pulling in a full
// @types package for two methods isn't worth the dependency.
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: { theme: string; size: string; width: number; text: string; shape: string }): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

export function GoogleSignInButton({ rememberMe }: { rememberMe: boolean }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const { mutate: googleLogin } = useGoogleLogin();
  // Ref so the GIS callback (registered once, on script load) always calls the mutation with
  // the current rememberMe value instead of closing over whatever it was at initialize()-time.
  const rememberMeRef = useRef(rememberMe);
  rememberMeRef.current = rememberMe;

  // GIS renders at a fixed pixel width (no "100%" support), so a hardcoded value drifts out of
  // alignment with the sibling buttons around it whenever the card's width changes — measure the
  // actual container instead so this button always matches its neighbors edge to edge.
  const renderButton = () => {
    if (!clientId || !window.google || !buttonRef.current || !containerRef.current) return;
    const width = Math.round(containerRef.current.getBoundingClientRect().width);
    if (width <= 0) return;
    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline", size: "large", width, text: "continue_with", shape: "rectangular",
    });
  };

  const handleScriptLoad = () => {
    if (!clientId || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => googleLogin({ idToken: response.credential, rememberMe: rememberMeRef.current }),
    });
    renderButton();
  };

  useEffect(() => {
    // Script may already be loaded (client-side nav back to /login) — Script's onLoad won't
    // re-fire in that case, so initialize on mount too if the API is already present.
    handleScriptLoad();
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => renderButton());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!clientId) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={handleScriptLoad} />
      <div ref={containerRef} className="w-full">
        <div ref={buttonRef} className="w-full flex justify-center" />
      </div>
    </>
  );
}
