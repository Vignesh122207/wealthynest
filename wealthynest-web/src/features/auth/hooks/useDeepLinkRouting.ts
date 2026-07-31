"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {App} from "@capacitor/app";
import {Capacitor} from "@capacitor/core";

// Android's App Links intent-filter (AndroidManifest.xml) hands wealthynest.in/verify-email,
// /reset-password, /login, and /forgot-password links to this app instead of the browser — but
// this is a server.url build (capacitor.config.ts) whose WebView always boots to /launch
// regardless of what URL the Activity was actually opened with. Nothing translated the intent's
// real target into an in-app navigation, so those links silently landed on whatever /launch
// resolves to instead of the page they pointed at (e.g. a verify-email link just showed the
// generic "check your inbox" screen, token dropped on the floor). This is that translation, for
// both a cold start (getLaunchUrl) and the app already running in the background (appUrlOpen) —
// mirrors useAppLockTrigger's own App.addListener/Capacitor.isNativePlatform pattern.
export function useDeepLinkRouting() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const navigateToDeepLink = (url: string) => {
      try {
        const { pathname, search } = new URL(url);
        router.push(pathname + search);
      } catch {
        // Malformed/unexpected URL — nothing sane to navigate to.
      }
    };

    App.getLaunchUrl().then((result) => {
      if (result?.url) navigateToDeepLink(result.url);
    });

    let removeListener: (() => void) | undefined;
    App.addListener("appUrlOpen", (event) => navigateToDeepLink(event.url))
      .then((handle) => { removeListener = () => handle.remove(); });

    return () => { removeListener?.(); };
  }, [router]);
}
