"use client";

import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {useAuthStore} from "@/features/auth/store/auth.store";

const PRIMARY_BTN = "bg-[#a85f30] hover:bg-[#c2703d] text-white transition-all";

// The landing page ("/") is reachable while already signed in — a bookmark, a direct link, or
// just navigating back to "/" from inside the app — and every primary CTA here used to hardcode
// Sign in/Get started/Create your free account regardless of that, while every OTHER public page
// (PublicNav, used by /support, /privacy, /terms) already correctly swapped to "Go to Home" for a
// signed-in visitor. Same auth check as PublicNav, just three different visual treatments for the
// three spots this page needs it (compact nav pill, large hero button, large closing-section
// button) — one isolated client component so the rest of this otherwise-static marketing page can
// stay a server component.
export function LandingNavCTA() {
  const user = useAuthStore(s => s.user);

  if (user) {
    return (
      <Link href="/home"
        className={`text-sm ${PRIMARY_BTN} px-4 py-2 rounded-xl font-semibold shadow-lg shadow-[#c2703d]/25`}>
        Go to Home
      </Link>
    );
  }

  return (
    <>
      <Link href="/login"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
        Sign in
      </Link>
      <Link href="/signup"
        className={`text-sm ${PRIMARY_BTN} px-4 py-2 rounded-xl font-semibold shadow-lg shadow-[#c2703d]/25`}>
        Get started
      </Link>
    </>
  );
}

export function LandingHeroCTA() {
  const user = useAuthStore(s => s.user);
  return (
    <Link href={user ? "/home" : "/signup"}
      className={`inline-flex items-center justify-center gap-2 ${PRIMARY_BTN} px-6 py-3.5 rounded-xl font-semibold text-sm shadow-[0_6px_24px_rgba(194,112,61,0.35)] hover:shadow-[0_8px_30px_rgba(194,112,61,0.5)] hover:-translate-y-0.5`}>
      {user ? "Go to Home" : "Start free — takes 2 minutes"} <ArrowRight className="w-4 h-4" />
    </Link>
  );
}

export function LandingClosingCTA() {
  const user = useAuthStore(s => s.user);
  return (
    <Link href={user ? "/home" : "/signup"}
      className={`inline-flex items-center gap-2 ${PRIMARY_BTN} px-7 py-3.5 rounded-xl font-semibold text-sm shadow-[0_6px_24px_rgba(194,112,61,0.35)] hover:shadow-[0_8px_30px_rgba(194,112,61,0.5)] hover:-translate-y-0.5`}>
      {user ? "Go to your dashboard" : "Create your free account"} <ArrowRight className="w-4 h-4" />
    </Link>
  );
}
