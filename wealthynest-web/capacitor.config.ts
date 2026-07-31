import type { CapacitorConfig } from "@capacitor/cli";

// Server mode, not a bundled build: the WebView loads the live site, same as the TWA it
// replaces, so `docker compose up -d --build wealthynest-web` remains the entire Android update
// story — no separate Play Store submission for ordinary UI/feature changes. `webDir` is still
// required by the Capacitor CLI to scaffold native asset folders (icons/splash) even though
// nothing is served from it at runtime. See ANDROID_APP_ROADMAP.md for the full rationale,
// including why this deliberately isn't a bundled/offline-data build.
const config: CapacitorConfig = {
  appId: "in.wealthynest.app",
  appName: "WealthyNest",
  webDir: "public",
  server: {
    // `/launch` (not `/`, not `/home` directly) so an installed app never shows the marketing
    // landing page, and — the reason it's not `/home` itself — never pays /home's own bundle cost
    // (9+ query hooks, every dashboard chart widget) before knowing whether this cold start is
    // even going there. See src/app/launch/page.tsx's own comment: loading /home directly on cold
    // launch was measured pushing the WebView renderer to 800MB+ and crashing on OOM, regardless
    // of auth state, since DashboardLayout's redirect-when-logged-out only fires after that whole
    // bundle already downloaded and got parsed. /launch checks auth from the already-loaded root
    // layout's store and redirects to /home or /login — whichever this cold start actually needs.
    // MUST be the exact host the app actually ends up on, not one that redirects elsewhere.
    // This was "https://wealthynest.in/launch" — wealthynest.in permanently redirects (308) to
    // www.wealthynest.in at the DNS/Vercel level (confirmed live, not something this repo
    // controls) — and that one-hostname gap silently broke Capacitor's entire native bridge, not
    // just navigation: Bridge.java scopes its native-bridge.js/PluginHeaders JS injection to
    // server.url's own configured authority (bare wealthynest.in), so once the WebView landed on
    // the redirect's target (www.wealthynest.in), that injection never applied there. Every
    // native plugin call app-wide silently rejected with "X plugin is not implemented on
    // android" (window.Capacitor.nativeCallback/PluginHeaders confirmed permanently undefined,
    // not just slow — waited 60s with no change) - reproduced on a real emulator, and confirmed
    // fixed the same way (native bridge present immediately, a real Google OAuth Custom Tab
    // opens on click) once server.url pointed at www.wealthynest.in directly.
    url: "https://www.wealthynest.in/launch",
    androidScheme: "https",
    cleartext: false,
    // Kept defensively even though server.url's own host no longer needs to self-list here:
    // if anything in the app ever links to the bare wealthynest.in domain, this is what stops
    // that redirect's target from bouncing out to the external browser the way server.url's old
    // value did. Harmless no-op if nothing does.
    allowNavigation: ["www.wealthynest.in"],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
