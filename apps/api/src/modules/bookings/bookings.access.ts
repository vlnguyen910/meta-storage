import { BOOKING_ACCESS } from "@metastorage/shared/booking-access";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { BOOKING_MESSAGES } from "./bookings.messages";

const COOKIE = "metastorage_booking_session";
const allowedOrigins = new Set(
  [...env.CORS_ORIGIN.split(","), ...env.AUTH_TRUSTED_ORIGINS.split(","), env.WEB_URL].map(
    (origin) => origin.trim(),
  ),
);
export function trackingSessionToken(request: FastifyRequest): string | undefined {
  const value = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export function trackingSessionCookie(token: string, clear = false): string {
  return `${COOKIE}=${token}; Path=/api/booking; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : BOOKING_ACCESS.sessionTtl}${env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export async function privateTrackingResponse(_request: FastifyRequest, reply: FastifyReply) {
  reply.header("Cache-Control", "no-store").header("Referrer-Policy", "no-referrer");
}
export async function requireTrackingOrigin(request: FastifyRequest) {
  if (!request.headers.origin || !allowedOrigins.has(request.headers.origin))
    throw new AppError(BOOKING_MESSAGES.accessOriginRejected, 403);
}
