export interface VerificationEmail {
  to: string;
  name: string;
  verificationUrl: string;
}

export interface Mailer {
  sendVerificationEmail(email: VerificationEmail): Promise<void>;
}
