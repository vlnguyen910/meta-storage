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
