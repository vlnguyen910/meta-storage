import type { useAuthFlow } from "./use-auth-flow";

export type AuthMode = "login" | "register" | "verify-email" | "forgot-password";

export type VerifyEmailSimState = "pending" | "success" | "expired";

export interface FormFieldProps {
  label: string;
  value: string;
  error?: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoComplete?: "name" | "email" | "tel" | "current-password" | "new-password";
  autoCapitalize?: "none" | "sentences" | "words";
  placeholder?: string;
  hint?: string;
  rightElement?: React.ReactNode;
}

export type SignupField = "name" | "email" | "phone" | "password" | "confirmPassword";

export type SignupErrors = Partial<Record<SignupField | "terms", string>>;

export interface AuthViewProps {
  auth: ReturnType<typeof useAuthFlow>;
}
