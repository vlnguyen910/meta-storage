import type { User } from "./users";

export type SessionUser = User & { assignedFacilityId: string | null };

export interface CookieSession {
  user: SessionUser;
}

export interface Session extends CookieSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SocialAuthInput {
  provider: "google";
  callbackURL: string;
  errorCallbackURL: string;
  disableRedirect?: boolean;
}

export interface SocialAuthResponse {
  url: string;
  redirect?: boolean;
}
