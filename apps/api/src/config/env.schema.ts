import { isIP } from "node:net";
import { z } from "zod";
import { ENV_MESSAGES as m } from "./env.messages";
import { providerEnvSchema } from "./provider-env";

const required = (name: string) => z.string().trim().min(1, m.required(name));
const secret = (name: string) => z.string().trim().min(32, m.secret(name));
const httpUrl = z.url({ protocol: /^https?$/, hostname: /^.+$/, error: m.httpUrl });
const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const trustedProxyCidrsSchema = z
  .string()
  .trim()
  .default("")
  .refine(
    (value) =>
      !value ||
      value.split(",").every((entry) => {
        const [address = "", prefix, extra] = entry.trim().split("/");
        const family = isIP(address);
        return (
          family !== 0 &&
          extra === undefined &&
          (prefix === undefined ||
            (/^\d+$/.test(prefix) &&
              Number(prefix) >= 1 &&
              Number(prefix) <= (family === 4 ? 32 : 128)))
        );
      }),
    m.trustedProxyCidrs,
  )
  .transform((value): string[] | false =>
    value ? value.split(",").map((entry) => entry.trim()) : false,
  );

function validOriginList(value: string, webOnly: boolean): boolean {
  return value.split(",").every((entry) => {
    const origin = entry.trim();
    if (!origin || origin.includes("*") || /\s/.test(origin)) return false;
    try {
      const url = new URL(origin);
      if (url.username || url.password || url.search || url.hash) return false;
      if (/^https?:$/.test(url.protocol))
        return Boolean(url.hostname) && ["", "/"].includes(url.pathname);
      // Better Auth also supports native application origins, e.g. metastorage://.
      return !webOnly && /^[a-z][a-z0-9+.-]*:\/\//i.test(origin);
    } catch {
      return false;
    }
  });
}

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "develop", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().trim().min(1).default("0.0.0.0"),
    TRUSTED_PROXY_CIDRS: trustedProxyCidrsSchema,
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.url({ protocol: /^postgres(?:ql)?$/, hostname: /^.+$/, error: m.databaseUrl }),
    REDIS_URL: z.url({ protocol: /^rediss?$/, hostname: /^.+$/, error: m.redisUrl }),
    CORS_ORIGIN: required("CORS_ORIGIN").refine(
      (value) => validOriginList(value, true),
      m.corsOrigins,
    ),
    AUTH_TRUSTED_ORIGINS: required("AUTH_TRUSTED_ORIGINS").refine(
      (value) => validOriginList(value, false),
      m.trustedOrigins,
    ),
    BETTER_AUTH_SECRET: secret("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: httpUrl,
    BOOKING_MAGIC_LINK_SECRET: secret("BOOKING_MAGIC_LINK_SECRET"),
    QR_TOKEN_SECRET: secret("QR_TOKEN_SECRET"),
    PUBLIC_APP_URL: httpUrl,
    WEB_URL: httpUrl,
    RESEND_API_KEY: required("RESEND_API_KEY"),
    RESEND_FROM_EMAIL: required("RESEND_FROM_EMAIL").refine((value) => {
      const address = value.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? value;
      return z.email().safeParse(address.trim()).success;
    }, m.senderEmail),
    PAYMENT_PROVIDER: z.enum(["mock", "sepay"]).default("mock"),
    SEPAY_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
    SEPAY_MERCHANT_ID: optionalText,
    SEPAY_SECRET_KEY: optionalText,
    SEPAY_PAYMENT_PREFIX: z
      .string()
      .regex(/^[A-Z]{2,5}$/)
      .default("SX"),
    SEPAY_BANK_NAME: optionalText,
    SEPAY_BANK_ACCOUNT_NUMBER: optionalText,
    SEPAY_BANK_ACCOUNT_NAME: optionalText,
  })
  .superRefine((values, ctx) => {
    if (values.PAYMENT_PROVIDER !== "sepay") return;
    const pg = [values.SEPAY_MERCHANT_ID, values.SEPAY_SECRET_KEY];
    if (pg.some(Boolean) && !pg.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: [values.SEPAY_MERCHANT_ID ? "SEPAY_SECRET_KEY" : "SEPAY_MERCHANT_ID"],
        message: m.sepayPair,
      });
    }
    if (!pg.every(Boolean)) {
      ctx.addIssue({ code: "custom", path: ["PAYMENT_PROVIDER"], message: m.sepayCredentials });
    }
  })
  .and(providerEnvSchema);
