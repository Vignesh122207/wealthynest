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
    url: "https://wealthynest.in/launch",
    androidScheme: "https",
    cleartext: false,
    // wealthynest.in now permanently redirects (308) to www.wealthynest.in at the DNS/Vercel
    // level (confirmed live, not something this repo controls). Without this, Capacitor's default
    // behavior — "all external URLs are opened in the external browser, not the WebView" — treats
    // that redirect's target host as external (it's a different hostname from server.url's),
    // so the WebView bounces straight to Chrome on every single launch instead of showing the app
    // at all. Reproduced on a real emulator build and confirmed this, not the new App Links
    // intent-filter added alongside it, is the cause (same bounce happens with that intent-filter
    // fully removed). This is a pre-existing production bug, not something introduced here.
    allowNavigation: ["www.wealthynest.in"],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
