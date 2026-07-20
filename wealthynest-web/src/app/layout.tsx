import type {Metadata, Viewport} from "next";
import {Inter, Plus_Jakarta_Sans} from "next/font/google";
import {ThemeProvider} from "next-themes";
import {ThemedToaster} from "@/components/ui/ThemedToaster";
import {Providers} from "./providers";
import "./globals.css";

const inter    = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta  = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", weight: ["400","500","600","700","800"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
    icon:  [
      { url: "/icons/icon-192.png?v=ribbonw-copper", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=ribbonw-copper", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png?v=ribbonw-copper", sizes: "192x192" }],
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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable}`}>
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
