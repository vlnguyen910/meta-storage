import type { useAuthFlow } from "./use-auth-flow";

export type AuthMode = "login" | "register" | "verify-email" | "forgot-password";

export type VerifyEmailSimState = "pending" | "success" | "expired";

export type SignupField = "name" | "email" | "phone" | "password" | "confirmPassword";

export type SignupErrors = Partial<Record<SignupField | "terms", string>>;

export interface AuthViewProps {
  auth: ReturnType<typeof useAuthFlow>;
  onBrowse?: () => void;
}
