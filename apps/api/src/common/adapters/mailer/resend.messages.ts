export const RESEND_MESSAGES = {
  deliveryNotConfigured:
    "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
  verificationEmailRejected: (status: number, message: string) =>
    `Resend rejected verification email (${status}): ${message}`,
} as const;
