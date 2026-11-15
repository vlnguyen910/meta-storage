import type { User } from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { isAxiosError } from "axios";
import type { AdminManagedUser } from "./admin.types";

export function isManagedUser(user: User): user is AdminManagedUser {
  return user.role !== null && user.status !== null;
}

export function adminApiError(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;
  const body = error.response?.data as
    | { error?: { message?: unknown }; message?: unknown }
    | undefined;
  if (typeof body?.error?.message === "string") return body.error.message;
  if (typeof body?.message === "string") return body.message;
  return fallback;
}

export function userInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi");
}

export function roleBadgeClassName(role: UserRole): string {
  if (role === UserRole.FACILITY_MANAGER) return "border-primary/20 bg-primary-soft text-primary";
  if (role === UserRole.BUSINESS_OPERATIONS_MANAGER)
    return "border-blue-100 bg-blue-50 text-blue-700";
  if (role === UserRole.SYSTEM_ADMINISTRATOR) return "border-amber-100 bg-amber-50 text-amber-800";
  return "border-line bg-slate-50 text-secondary";
}

export function matchesSearch(values: readonly string[], search: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  return normalize(values.join(" ")).includes(normalize(search.trim()));
}
