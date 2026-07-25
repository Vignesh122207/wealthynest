package in.wealthynest.app;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Durable, native-side "when did this Activity last leave the foreground" — SharedPreferences
    // with a blocking commit(), not the JS side's localStorage. onPause() is a guaranteed Android
    // lifecycle callback that runs before the process *can* be killed, whereas the WebView's own
    // visibilitychange/pagehide events have looser guarantees under a real task-swipe-away kill —
    // this was still occasionally missing the lock screen on close+reopen even with those two
    // covering each other. useAppLockTrigger folds this into the same "hidden at" marker it already
    // uses, so the rest of that logic doesn't need to know this source exists.
    private static final String APP_LOCK_PREFS = "wealthynest_applock";
    private static final String KEY_BACKGROUNDED_AT_MS = "backgroundedAtMs";

    // Floor: long enough that the ribbon-W splash (res/drawable/splash.png) reads as a deliberate
    // branded beat — the same "icon holds for a moment" pause other polished apps use before
    // revealing fingerprint/home — short enough it never feels like a stall on an already-warm
    // load.
    private static final long MIN_SPLASH_DURATION_MS = 700;
    // Ceiling: this is a server.url build (the WebView loads the live site over the network, not
    // bundled assets — see capacitor.config.ts), so a slow/offline connection must not hang the
    // splash forever waiting for a "ready" signal that may never arrive. After this, show whatever
    // the WebView currently has rather than blocking indefinitely.
    private static final long MAX_SPLASH_DURATION_MS = 6000;
    private final long createdAtMs = SystemClock.elapsedRealtime();

    // Set once the web app's first real screen — the login form, or the dashboard/app-lock
    // decision — has actually painted (see src/lib/nativeSplash.ts's notifyReady() call). Without
    // this, the splash only ever waited on MIN_SPLASH_DURATION_MS's flat timer, so on any load
    // slower than 700ms (the common case for this server.url network fetch) it hid on schedule
    // anyway and revealed a blank/white WebView for however much longer the real page took to
    // paint — the "W then a white flash before login" bug this fixes.
    private volatile boolean contentReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must run before super.onCreate() — installSplashScreen() needs to intercept the window's
        // initial background before the Activity's own theme/content takes over.
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        // Finance app: without this, Android's app-switcher/recents preview and any screen
        // recording show whatever was on screen last (account balances, transaction amounts) even
        // while the app-lock overlay would otherwise be covering it — FLAG_SECURE blanks the
        // window in both contexts at the OS level, before AppLockScreen's own JS-side lock ever
        // gets a chance to run.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);

        // Plain addJavascriptInterface (not a full Capacitor plugin) — this is a one-way, one-shot
        // "I've painted" signal, not something that needs the plugin system's request/response
        // bridge or to be callable from a browser/PWA context at all.
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void notifyReady() {
                contentReady = true;
            }
        }, "NativeSplash");

        // Read-and-clear: JS calls this once per resume/mount, treating a non-zero result exactly
        // like its own persisted "hidden at" marker. Cleared on read so a later call this same
        // session (with nothing new pending) correctly reports "nothing to report" rather than
        // re-locking on every remount off a stale value.
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public long consumeBackgroundedAt() {
                SharedPreferences prefs = getSharedPreferences(APP_LOCK_PREFS, MODE_PRIVATE);
                long value = prefs.getLong(KEY_BACKGROUNDED_AT_MS, 0L);
                if (value != 0L) prefs.edit().remove(KEY_BACKGROUNDED_AT_MS).commit();
                return value;
            }
        }, "NativeAppLock");

        splashScreen.setKeepOnScreenCondition(() -> {
            long elapsed = SystemClock.elapsedRealtime() - createdAtMs;
            if (elapsed < MIN_SPLASH_DURATION_MS) return true;
            if (contentReady) return false;
            return elapsed < MAX_SPLASH_DURATION_MS;
        });
    }

    @Override
    public void onPause() {
        super.onPause();
        // commit() (synchronous, blocking) not apply() (async) — this must be durably on disk
        // before onPause() returns, since the process can legitimately be killed immediately after,
        // with no guarantee an async write ever flushes.
        getSharedPreferences(APP_LOCK_PREFS, MODE_PRIVATE)
            .edit()
            .putLong(KEY_BACKGROUNDED_AT_MS, System.currentTimeMillis())
            .commit();
    }
}
