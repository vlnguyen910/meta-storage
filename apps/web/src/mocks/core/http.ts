import {
  type ApiEnvelope,
  type ApiErrorBody,
  type Session,
  type SessionUser,
  StorageUnitStatus,
  type UnitAvailabilityOption,
  type User,
} from "@metastorage/contracts";
import type { AxiosRequestConfig } from "axios";
import type { MockDatabase, MockStorageUnit, MockUser } from "../types";

export function envelope<T>(data: T, message = "Thành công"): ApiEnvelope<T> {
  return { success: true, message, data, timestamp: new Date().toISOString() };
}

export function errorBody(code: number, message: string): ApiErrorBody {
  return { success: false, message, error: { code }, timestamp: new Date().toISOString() };
}

export function parseBody<T>(value: unknown): T {
  return JSON.parse(String(value ?? "{}")) as T;
}

export function publicUser(user: MockUser): User {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function tokenUserId(token: string | undefined, kind: "access" | "refresh"): string | null {
  if (!token?.startsWith(`${kind}:`)) return null;
  return token.split(":")[1] ?? null;
}

function getBearer(config: AxiosRequestConfig): string | undefined {
  const value = config.headers?.Authorization;
  return typeof value === "string" ? value.replace(/^Bearer\s+/i, "") : undefined;
}

export function currentUser(config: AxiosRequestConfig, database: MockDatabase): MockUser | null {
  const userId = tokenUserId(getBearer(config), "access");
  return database.users.find((user) => user.id === userId) ?? null;
}

export function createSession(user: MockUser): Session {
  const timestamp = Date.now();
  return {
    user: sessionUser(user),
    accessToken: `access:${user.id}:${timestamp}`,
    refreshToken: `refresh:${user.id}:${timestamp}`,
    expiresAt: new Date(timestamp + 30 * 60 * 1000).toISOString(),
  };
}

export function sessionUser(user: MockUser): SessionUser {
  return {
    ...publicUser(user),
    assignedFacilityId:
      user.role === "FACILITY_STAFF" || user.role === "FACILITY_MANAGER"
        ? (user.assignedFacilityIds[0] ?? null)
        : null,
  };
}

export function addMonths(dateValue: string, months: number): string {
  const hasTime = dateValue.includes("T");
  const date = new Date(hasTime ? dateValue : `${dateValue}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return hasTime ? date.toISOString() : date.toISOString().slice(0, 10);
}

export function optionsForUnits(units: MockStorageUnit[]): UnitAvailabilityOption[] {
  const groups = new Map<string, UnitAvailabilityOption>();
  for (const unit of units) {
    const key = `${unit.facilityId}:${unit.unitTypeId}`;
    const existing = groups.get(key);
    if (existing) {
      if (unit.status === StorageUnitStatus.AVAILABLE) existing.availableCount += 1;
      continue;
    }
    groups.set(key, {
      facilityId: unit.facilityId,
      unitTypeId: unit.unitTypeId,
      unitType: unit.unitType,
      sizeLabel: unit.sizeLabel,
      sizeSqm: unit.sizeSqm,
      monthlyPrice: unit.monthlyPrice,
      availableCount: unit.status === StorageUnitStatus.AVAILABLE ? 1 : 0,
    });
  }
  return [...groups.values()].sort((a, b) => a.monthlyPrice - b.monthlyPrice);
}
