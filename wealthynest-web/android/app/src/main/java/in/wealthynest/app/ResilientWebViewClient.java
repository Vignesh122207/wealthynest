package in.wealthynest.app;

import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Capacitor's default BridgeWebViewClient has no onRenderProcessGone override, so ANY renderer
 * crash — regardless of cause (OOM, native WebView bug, anything) — is fatal to the whole app
 * (confirmed via a real device/emulator crash: "Render process crash wasn't handled by all
 * associated webviews, triggering application crash"). A single WebView-internal crash taking
 * down the entire app is bad resilience for any WebView-shell app, independent of what's actually
 * causing a given crash.
 *
 * Recovery here is deliberately simple and bounded: reload once on the first crash (a fresh
 * renderer process is spun up automatically by WebView.reload()/loadUrl() — no need to tear down
 * and recreate the WebView object itself, which is where most home-grown recovery attempts go
 * wrong). If it crashes again shortly after, don't keep reloading forever — fall through to the
 * platform's default handling (same as today) rather than risk a silent reload loop that burns
 * battery/CPU without ever telling the user anything is wrong.
 */
public class ResilientWebViewClient extends BridgeWebViewClient {
    private static final String TAG = "WealthyNest";
    private static final long CRASH_LOOP_WINDOW_MS = 30_000;

    private long lastCrashAtMs = 0;

    public ResilientWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        long now = System.currentTimeMillis();
        boolean crashedAgainQuickly = (now - lastCrashAtMs) < CRASH_LOOP_WINDOW_MS && lastCrashAtMs != 0;
        lastCrashAtMs = now;

        Log.w(TAG, "WebView render process gone (didCrash=" + detail.didCrash() + "). "
            + (crashedAgainQuickly ? "Crashed again within " + CRASH_LOOP_WINDOW_MS + "ms — not retrying again."
                                    : "Reloading once to recover."));

        if (crashedAgainQuickly) {
            // Let the platform's default fatal handling take over, same as before this class
            // existed, rather than loop indefinitely on a renderer that can't stay up.
            return false;
        }

        view.reload();
        return true;
    }
}
