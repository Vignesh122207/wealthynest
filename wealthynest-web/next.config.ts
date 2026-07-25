import type { NextConfig } from "next";

// Resolves to the API's own origin (not just its path) so connect-src can allow exactly that
// host — falls back to the same default axios.ts uses when the env var isn't set.
const apiOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").origin; }
  catch { return "http://localhost:8080"; }
})();

// script-src/style-src keep 'unsafe-inline' — NOT a placeholder for "later": a per-request-nonce
// version was built and tested via src/middleware.ts (Next 15.3.2, this exact standalone build)
// and none of the App Router's own inline hydration scripts (the `self.__next_f.push(...)` tags
// it streams RSC payloads through) picked up the nonce the docs describe as automatic — verified
// by curling a real response and finding zero `nonce="..."` attributes anywhere in the rendered
// HTML despite the CSP header correctly declaring one. Under a nonce-only script-src, every one
// of those scripts gets blocked by the browser and the app fails to hydrate — reproduced, not
// theoretical. That's strictly worse than the unsafe-inline gap this is meant to close, so this
// reverts to the verified-working static policy rather than ship a broken lockdown.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com",
  // Missing accounts.google.com here (script-src/connect-src/frame-src already allow it) blocks
  // GIS's own https://accounts.google.com/gsi/style stylesheet — the button still renders, but the
  // degraded iframe falls back to a plain window.open() with no popup dimensions, which most
  // browsers then show as a full new tab instead of GIS's normal compact popup.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: https:",
  `connect-src 'self' ${apiOrigin} https://accounts.google.com`,
  "frame-src https://accounts.google.com",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // /dashboard renamed to /home — keeps existing bookmarks and already-installed PWA shortcuts
  // (which cached the old start_url) working instead of 404ing.
  async redirects() {
    return [{ source: "/dashboard", destination: "/home", permanent: true }];
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options",        value: "DENY" },
        { key: "X-XSS-Protection",       value: "1; mode=block" },
        { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
        { key: "Content-Security-Policy", value: csp },
      ],
    }];
  },
};

export default nextConfig;
