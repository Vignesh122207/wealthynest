/** Registers public/sw.js (app-shell caching + offline fallback only — see that file's own
 * comment on why it deliberately doesn't cache anything beyond the offline page for a finance
 * app). Safe to call from any client component's effect: no-ops on the server and in browsers
 * without SW support, and never throws on a failed registration. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}
