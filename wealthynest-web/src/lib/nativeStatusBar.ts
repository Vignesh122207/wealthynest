import {Capacitor} from "@capacitor/core";
import {Style, StatusBar} from "@capacitor/status-bar";

/** Lets the WebView draw its own content (Header/MobileNav's --sidebar-bg) under the status bar
 * instead of the system painting an opaque bar in front of it — that opaque default is what
 * produced the "different color" cut at the top of the screen. `colors.xml`'s windowBackground
 * covers the moment before the WebView has painted anything at all; this covers every frame
 * after. Style is named for the BACKGROUND it suits, not the icon color it produces — Style.Dark
 * ("light text for dark backgrounds") gives light/white icons, Style.Light ("dark text for light
 * backgrounds") gives dark/black icons. This used to be inverted here (Style.Light on dark theme,
 * Style.Dark on light theme), which put dark-on-dark and light-on-light icons on screen — an
 * invisible status bar clock in both themes, not just one. */
export async function syncNativeStatusBar(theme: "light" | "dark"): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
  } catch {
    // Best-effort — a device/OS version without a given status bar API shouldn't block rendering.
  }
}
