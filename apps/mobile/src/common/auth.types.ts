import type { useAppSession, useDemoSession } from "../features/auth/use-app-session";
import type { useAuthentication } from "../features/auth/use-authentication";

export type AuthRoute = "login" | "register" | "forgot-password" | "verify-email";
export type Verification = "pending" | "returned" | "expired";
export interface AuthenticationOptions {
  callbackUrl?: string;
  demo?: boolean;
  onAuthenticated?: (role: string) => void;
}

export type Authentication = ReturnType<typeof useAuthentication>;
export type AppSession = ReturnType<typeof useAppSession> | ReturnType<typeof useDemoSession>;
