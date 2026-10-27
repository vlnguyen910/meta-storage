export interface VerificationEmail {
  to: string;
  name: string;
  verificationUrl: string;
}

export interface Mailer {
  sendVerificationEmail(email: VerificationEmail): Promise<void>;
  sendPasswordResetEmail(email: PasswordResetEmail): Promise<void>;
}

export interface PasswordResetEmail {
  to: string;
  name: string;
  resetUrl: string;
}
