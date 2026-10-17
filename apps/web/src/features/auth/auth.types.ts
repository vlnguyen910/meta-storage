import type { CustomerSignUpInput, UserRole } from "@metastorage/contracts";

export interface LoginFormValues {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterFormValues extends CustomerSignUpInput {
  terms?: boolean;
}

export interface ForgotPasswordFormValues {
  email: string;
}

export type VerifyEmailState = "pending" | "success" | "expired" | "failure";

export interface DemoAccountItem {
  role: UserRole;
  email: string;
  label: string;
}
