export const ENV_MESSAGES = {
  invalidEnvironment: "Invalid environment variables; server startup aborted:",
  required: (name: string) => `${name} is required and must not be blank.`,
  secret: (name: string) => `${name} must contain at least 32 characters.`,
  httpUrl: "Must be an absolute HTTP or HTTPS URL.",
  databaseUrl: "Must be a PostgreSQL URL (postgres:// or postgresql://).",
  redisUrl: "Must be a Redis URL (redis:// or rediss://).",
  corsOrigins:
    "Must list explicit HTTP(S) origins separated by commas, without empty entries or wildcards.",
  trustedOrigins:
    "Must list valid trusted origins separated by commas, without empty entries or wildcards.",
  trustedProxyCidrs:
    "Must list explicit proxy IP addresses or CIDRs separated by commas; wildcards and /0 are forbidden.",
  senderEmail: "Must be an email address or a display name followed by <email>.",
  sepayCredentials: "PAYMENT_PROVIDER=sepay requires SEPAY_MERCHANT_ID and SEPAY_SECRET_KEY.",
  sepayPair: "SEPAY_MERCHANT_ID and SEPAY_SECRET_KEY must be configured together.",
} as const;
