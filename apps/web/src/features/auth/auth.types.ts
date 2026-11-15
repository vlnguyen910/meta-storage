import type { CustomerSignUpInput } from "@metastorage/contracts";

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues extends CustomerSignUpInput {
  terms?: boolean;
}

export interface ForgotPasswordFormValues {
  email: string;
}
