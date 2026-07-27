import {NativeSplashReady} from "@/components/shared/NativeSplashReady";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Clears the status bar in the native Android shell — safe here (unlike DashboardLayout) since
  // these are plain scrollable pages with no pinned header depending on the page never growing
  // past one viewport; see globals.css's body-rule comment for why that isn't true everywhere.
  return (
    <div style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Cold-start entry point when logged out (capacitor.config.ts's server.url always loads
          /home first, which redirects here) — see NativeSplashReady's own comment. */}
      <NativeSplashReady />
      {children}
    </div>
  );
}
