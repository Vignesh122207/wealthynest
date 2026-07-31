import {create} from "zustand";
import {persist} from "zustand/middleware";
import type {User} from "../types/auth.types";

interface AuthState {
  user:            User | null;
  // In-memory only — deliberately NOT in `partialize` below. Persisting it to localStorage would
  // make it readable by any script that runs on the page (an XSS foothold anywhere in the app
  // could exfiltrate a live, hours-long-valid Bearer token usable directly against the API from
  // outside the browser entirely, bypassing cookies/CORS/SameSite). A reload starts this at null;
  // `isAuthenticated` (which does persist) still renders the dashboard shell immediately, and the
  // first API call 401s and runs the ordinary refresh-token flow (axios.ts's interceptor) to
  // silently re-populate it from the httpOnly refresh cookie — no separate boot-time refresh
  // needed, that path already exists for an ordinary expired token.
  accessToken:     string | null;
  isAuthenticated: boolean;
  /** Bumped on every `setUser`/`setAuth`/`logout` call — lets an in-flight async update (e.g.
   * DashboardLayout's mount-time `getMe()` resync) detect that a more recent call already landed
   * while it was in flight, and skip overwriting it with stale data. Not persisted: it only needs
   * to order updates within a session, not survive a reload. */
  userVersion: number;
  // Refresh tokens never touch JS — they live only in the httpOnly cookie the browser manages
  // automatically (see RefreshCookieService on the backend). setAuth/setTokens only ever handle
  // the short-lived access token; there is deliberately no refreshToken parameter to accept.
  setAuth:   (user: User, accessToken: string) => void;
  setTokens: (accessToken: string) => void;
  setUser:   (user: User) => void;
  logout:    () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, accessToken: null, isAuthenticated: false, userVersion: 0,
      setAuth:   (user, accessToken) => set((s) => ({ user, accessToken, isAuthenticated: true, userVersion: s.userVersion + 1 })),
      setTokens: (accessToken)       => set({ accessToken }),
      setUser:   (user)              => set((s) => ({ user, userVersion: s.userVersion + 1 })),
      logout:    ()                  => set((s) => ({ user: null, accessToken: null, isAuthenticated: false, userVersion: s.userVersion + 1 })),
    }),
    {
      name: "wealthynest-auth",
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);
