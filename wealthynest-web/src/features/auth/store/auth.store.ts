import {create} from "zustand";
import {persist} from "zustand/middleware";
import type {User} from "../types/auth.types";

interface AuthState {
  user:            User | null;
  accessToken:     string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;
  /** Bumped on every `setUser`/`setAuth`/`logout` call — lets an in-flight async update (e.g.
   * DashboardLayout's mount-time `getMe()` resync) detect that a more recent call already landed
   * while it was in flight, and skip overwriting it with stale data. Not persisted: it only needs
   * to order updates within a session, not survive a reload. */
  userVersion: number;
  setAuth:   (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser:   (user: User) => void;
  logout:    () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, accessToken: null, refreshToken: null, isAuthenticated: false, userVersion: 0,
      setAuth:   (user, accessToken, refreshToken) => set((s) => ({ user, accessToken, refreshToken, isAuthenticated: true, userVersion: s.userVersion + 1 })),
      setTokens: (accessToken, refreshToken)       => set({ accessToken, refreshToken }),
      setUser:   (user)                            => set((s) => ({ user, userVersion: s.userVersion + 1 })),
      logout:    ()                                => set((s) => ({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, userVersion: s.userVersion + 1 })),
    }),
    {
      name: "wealthynest-auth",
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }),
    }
  )
);
