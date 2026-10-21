import { randomUUID } from "node:crypto";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { ResendMailer } from "../../common/adapters/mailer/resend.adapter";
import { env } from "../../config/env";
import { authDatabase } from "./auth.database";
import { AUTH_MESSAGES } from "./auth.messages";

const verificationMailer = new ResendMailer({
  apiKey: env.RESEND_API_KEY,
  fromEmail: env.RESEND_FROM_EMAIL,
});
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [
    ...env.AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()),
    "metastorage://",
  ],
  database: authDatabase,
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            // Only the authorization-code flow is exposed in this backend integration.
            disableIdTokenSignIn: true,
            prompt: "select_account",
          },
        }
      : {},
  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      allowDifferentEmails: false,
      updateUserInfoOnLink: false,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/link-social") return;
      const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
      if (!session)
        throw new APIError("UNAUTHORIZED", {
          code: "LOGIN_REQUIRED",
          message: AUTH_MESSAGES.googleLinkSessionRequired,
        });
      if (session.user.status !== "ACTIVE")
        throw new APIError("FORBIDDEN", {
          code: "ACCOUNT_DISABLED",
          message: AUTH_MESSAGES.accountDisabled,
        });
    }),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session, ctx) => {
          if (!ctx) return;
          const user = await ctx.context.internalAdapter.findUserById(session.userId);
          if (!user || !("status" in user) || user.status !== "ACTIVE")
            throw new APIError("FORBIDDEN", {
              code: "ACCOUNT_DISABLED",
              message: AUTH_MESSAGES.accountDisabled,
            });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await verificationMailer.sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationUrl: url,
      });
    },
  },
  user: {
    validateUserInfo: async ({ user, source }, ctx) => {
      if (source.method !== "oauth" || source.oauth?.providerId !== "google") return;
      if (user.emailVerified !== true)
        return {
          error: "google_email_unverified",
          errorDescription: AUTH_MESSAGES.googleEmailUnverified,
        };
      if (source.action !== "create-user" && user.id) {
        const existing = await ctx.context.internalAdapter.findUserById(user.id);
        if (!existing || !("status" in existing) || existing.status !== "ACTIVE")
          return {
            error: "account_disabled",
            errorDescription: AUTH_MESSAGES.accountDisabled,
          };
      }
      if (source.action === "link-account") {
        // OAuth state proves initiation, but linking also requires a live session at callback.
        const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
        if (!session || session.user.id !== user.id)
          return {
            error: "link_session_required",
            errorDescription: AUTH_MESSAGES.googleLinkSessionRequired,
          };
      }
      return undefined;
    },
    additionalFields: {
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      role: {
        type: [
          "CUSTOMER",
          "FACILITY_STAFF",
          "FACILITY_MANAGER",
          "BUSINESS_OPERATION_MANAGER",
          "SYSTEM_ADMIN",
        ],
        required: false,
        defaultValue: "CUSTOMER",
        input: false,
      },
      status: {
        type: ["ACTIVE", "INACTIVE"],
        required: false,
        defaultValue: "ACTIVE",
        input: false,
      },
    },
  },
  plugins: [expo()],
  advanced: {
    disableOriginCheck: false,
    disableCSRFCheck: false,
    cookiePrefix: "metastorage-auth",
    useSecureCookies: env.NODE_ENV === "production",
    database: {
      generateId: () => randomUUID(),
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
