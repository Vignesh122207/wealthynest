import type {Metadata, Viewport} from "next";
import {Fraunces, Inter, Plus_Jakarta_Sans} from "next/font/google";
import {ThemeProvider} from "next-themes";
import {ThemedToaster} from "@/components/ui/ThemedToaster";
import {Providers} from "./providers";
import "./globals.css";

const inter    = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta  = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", weight: ["400","500","600","700","800"] });
// Display serif reserved for auth-page headlines (font-serif) — gives the "private bank" register
// the rest of the app's Jakarta/Inter sans doesn't reach for. Self-hosted via next/font, so no CSP
// concern from an external font CDN.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", weight: ["500","600"], style: ["normal"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Lets content extend into notch/status-bar/nav-bar areas so env(safe-area-inset-*) resolves to
  // real values instead of 0 — required for the Capacitor Android shell to draw full-screen
  // instead of leaving default-colored bars at the top/bottom (see globals.css's body padding and
  // MobileNav's own safe-area padding, which both depend on this being set).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)",  color: "#030C17" },
  ],
};

const TITLE = "WealthyNest – Personal Finance";
const DESCRIPTION = "Smart personal finance for Indian families. Track expenses, budgets, assets and investments.";

export const metadata: Metadata = {
  // Required for Next to resolve opengraph-image.tsx/twitter-image.tsx (relative by default) into
  // the absolute URLs social platforms' crawlers need — without this they silently fail to embed.
  metadataBase: new URL("https://wealthynest.in"),
  title: { default: TITLE, template: "%s | WealthyNest" },
  description: DESCRIPTION,
  keywords: ["personal finance", "expense tracker", "budget", "investments", "India"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WealthyNest",
  },
  icons: {
    // Listed first so SVG-favicon-capable browsers (Chrome, Firefox, Edge) prefer the bare ribbon
    // glyph (same art as BrandMark's RibbonWMark, no background plate) over the PNG tile icons
    // below. No light/dark pairing needed — it's transparent, so there's no plate color to clash
    // with the tab bar. Safari (inconsistent SVG-favicon support) and any browser that ignores it
    // fall through to the PNGs.
    icon:  [
      { url: "/icons/favicon.svg?v=ribbon-w-2",      type: "image/svg+xml" },
      { url: "/icons/icon-192.png?v=ribbonw-copper2", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=ribbonw-copper2", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png?v=ribbonw-copper2", sizes: "192x192" }],
  },
  // Image itself comes from opengraph-image.tsx/twitter-image.tsx (Next's file-convention
  // auto-detects and injects those) — these fields cover the surrounding text/type metadata that
  // convention doesn't fill in on its own.
  openGraph: {
    type: "website",
    url: "https://wealthynest.in",
    siteName: "WealthyNest",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable} ${fraunces.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <Providers>
            {children}
            <ThemedToaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
