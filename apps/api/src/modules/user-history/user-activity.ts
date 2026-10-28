import type { ActivityRequest, UserActivityInput } from "./user-activity.types";

const excludedRoutes = new Set([
  "/api/bookings/check-in/lookup",
  "/api/booking/magic-link/exchange",
  "/api/booking/session/revoke",
  "/api/payments/webhooks/sepay",
  "/api/sepay/ipn",
]);
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function uuid(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export function activityForResponse(
  request: ActivityRequest,
  payload?: unknown,
): UserActivityInput | null {
  if (
    !writeMethods.has(request.method) ||
    !request.route.startsWith("/api/") ||
    request.route.startsWith("/api/auth/") ||
    excludedRoutes.has(request.route)
  )
    return null;
  const params = record(request.params);
  const body = record(request.body);
  const response = record(payload);
  if (response.success === false) return null;
  const data = record(response.data);
  const target =
    uuid(data.id) ??
    uuid(params.id) ??
    uuid(params.requestId) ??
    uuid(params.ticketId) ??
    uuid(params.chargeId) ??
    uuid(params.renewalId) ??
    uuid(params.bookingId) ??
    uuid(params.rentalId) ??
    uuid(params.userId) ??
    uuid(params.unitTypeId) ??
    uuid(params.priceRangeId) ??
    uuid(params.facilityId) ??
    (request.route.startsWith("/api/users/me") ? request.actorId : null);
  return {
    actorId: request.actorId,
    action: `${request.method} ${request.route}`.slice(0, 120),
    entityType: request.route.split("/")[2] ?? "unknown",
    entityId: target,
    facilityId: uuid(params.facilityId) ?? uuid(body.facilityId),
  };
}
