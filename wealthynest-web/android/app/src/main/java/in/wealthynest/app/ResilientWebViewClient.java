package in.wealthynest.app;

import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.util.ArrayDeque;

/**
 * Capacitor's default BridgeWebViewClient has no onRenderProcessGone override, so ANY renderer
 * crash — regardless of cause (OOM, native WebView bug, anything) — is fatal to the whole app
 * (confirmed via a real device/emulator crash: "Render process crash wasn't handled by all
 * associated webviews, triggering application crash"). A single WebView-internal crash taking
 * down the entire app is bad resilience for any WebView-shell app, independent of what's actually
 * causing a given crash.
 *
 * Recovery reloads on every crash (a fresh renderer process is spun up automatically by
 * WebView.reload() — no need to tear down and recreate the WebView object itself, which is where
 * most home-grown recovery attempts go wrong), but stops once a real loop is detected — otherwise
 * this falls through to the platform's default handling instead of reloading forever.
 *
 * Loop detection is a rolling count, not a fixed "crashed again within N ms of the last one"
 * check: an on-emulator repro of the underlying OOM bug this was built for showed crashes
 * recurring roughly every 40-47s, not back-to-back — an earlier version of this class used a flat
 * 30s window, so every single one of those was more than 30s after the previous and got treated
 * as a fresh "first" crash forever, defeating the whole point of loop detection. Counting crashes
 * within a longer rolling window catches that pattern instead.
 */
public class ResilientWebViewClient extends BridgeWebViewClient {
    private static final String TAG = "WealthyNest";
    private static final long CRASH_LOOP_WINDOW_MS = 5 * 60_000;
    private static final int MAX_CRASHES_IN_WINDOW = 3;

    private final ArrayDeque<Long> recentCrashTimestamps = new ArrayDeque<>();

    public ResilientWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        long now = System.currentTimeMillis();
        recentCrashTimestamps.addLast(now);
        while (!recentCrashTimestamps.isEmpty() && now - recentCrashTimestamps.peekFirst() > CRASH_LOOP_WINDOW_MS) {
            recentCrashTimestamps.removeFirst();
        }

        boolean loopDetected = recentCrashTimestamps.size() >= MAX_CRASHES_IN_WINDOW;
        Log.w(TAG, "WebView render process gone (didCrash=" + detail.didCrash() + "). "
            + (loopDetected ? recentCrashTimestamps.size() + " crashes within "
                + (CRASH_LOOP_WINDOW_MS / 1000) + "s — not retrying again."
                : "Reloading to recover."));

        if (loopDetected) {
            // Let the platform's default fatal handling take over rather than keep reloading a
            // renderer that demonstrably can't stay up.
            return false;
        }

        view.reload();
        return true;
    }
}
