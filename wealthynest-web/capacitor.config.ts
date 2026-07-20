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
    url: "https://wealthynest.in",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
