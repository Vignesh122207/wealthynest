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
}

export interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  tokenType:    string;
  user:         User;
}

export interface LoginPayload    { email: string; password: string; rememberMe?: boolean; }
export interface RegisterPayload { fullName: string; email: string; password: string; }

export interface Passkey {
  id:         string;
  nickname?:  string;
  createdAt:  string;
  lastUsedAt?: string;
}
