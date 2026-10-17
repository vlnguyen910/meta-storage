import { z } from "zod";
import type { CookieSession, Session } from "./auth.types";
import { CONTRACT_MESSAGES } from "./messages";

export type SessionTokens = Pick<Session, "accessToken" | "refreshToken" | "expiresAt">;

export type ClientSession = Session | CookieSession;

export const CustomerSignUpInputSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().toLowerCase().email().max(255),
    phone: z.string().trim().min(1).max(20),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    callbackTarget: z.enum(["web", "mobile"]),
  })
  .superRefine((input, context) => {
    if (input.password !== input.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: CONTRACT_MESSAGES.passwordsDoNotMatch,
      });
    }
  });

export type CustomerSignUpInput = z.infer<typeof CustomerSignUpInputSchema>;

export type { CookieSession, LoginInput, Session, SessionUser } from "./auth.types";
