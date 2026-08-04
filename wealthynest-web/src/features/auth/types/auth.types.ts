export interface User {
  id:           string;
  fullName:     string;
  email:        string;
  pendingEmail?: string;
  role:         "ADMIN" | "FAMILY_ADMIN" | "MEMBER";
  avatarUrl?:   string;
  familyId?:    string;
  active:       boolean;
  lastLoginAt?: string;
  createdAt:    string;
  pinEnabled:   boolean;
  hasPasskeys:  boolean;
  loginAlertEnabled: boolean;
}

// No refreshToken field — it travels only as an httpOnly cookie the browser manages
// automatically (see RefreshCookieService on the backend), never in the response body.
export interface AuthResponse {
  accessToken:  string;
  expiresIn:    number;
  tokenType:    string;
  user:         User;
}

export interface LoginPayload    { email: string; password: string; rememberMe: boolean; }
export interface RegisterPayload { fullName: string; email: string; password: string; }

export interface Passkey {
  id:         string;
  nickname?:  string;
  createdAt:  string;
  lastUsedAt?: string;
}

export interface Session {
  id:        string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
  current:   boolean;
}
