// Lightweight, dependency-free UA parsing for the Security settings device list — good enough for
// a friendly "Chrome on macOS" / "WealthyNest app on Android" label, not meant to be a general
// browser/bot-detection library. Order matters: Edge/Chrome UAs also match Safari's token, so the
// more specific checks run first.

function detectOs(ua: string): string {
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "an unknown OS";
}

function detectBrowser(ua: string): string {
  if (/EdgA|Edge|Edg\//i.test(ua)) return "Edge";
  if (/CriOS|Chrome/i.test(ua)) return "Chrome";
  if (/FxiOS|Firefox/i.test(ua)) return "Firefox";
  if (/Version\/[\d.]+.*Safari/i.test(ua)) return "Safari";
  return "a browser";
}

// Capacitor's Android WebView UA carries "; wv)"; iOS's native WebView (WKWebView) looks
// indistinguishable from mobile Safari at the UA level, so it's grouped with Safari there instead
// of over-claiming certainty.
function isAndroidWebView(ua: string): boolean {
  return /; ?wv\)/i.test(ua);
}

export function parseUserAgent(ua?: string | null): string {
  if (!ua) return "Unknown device";
  const os = detectOs(ua);
  if (isAndroidWebView(ua)) return `WealthyNest app on ${os}`;
  return `${detectBrowser(ua)} on ${os}`;
}

/** Phone vs. desktop glyph for the Security sessions list — a coarser signal than detectOs, since
 * a tablet/phone distinction isn't worth a third icon there. */
export function isMobileUserAgent(ua?: string | null): boolean {
  if (!ua) return false;
  return /Android|iPhone|iPad|iPod/i.test(ua);
}
