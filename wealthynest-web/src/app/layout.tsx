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

export const metadata: Metadata = {
  title: { default: "WealthyNest – Personal Finance", template: "%s | WealthyNest" },
  description: "Smart personal finance for Indian families. Track expenses, budgets, assets and investments.",
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
