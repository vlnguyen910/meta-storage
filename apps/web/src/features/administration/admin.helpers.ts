import { UserRole } from "@metastorage/contracts";
import { ADMIN_MESSAGES as M } from "./admin.messages";
import type {
  AdminAccountChange,
  AdminFacility,
  AdminMockData,
  AdminSnapshot,
} from "./admin.types";

export const isFacilityRole = (role: UserRole) =>
  role === UserRole.FACILITY_STAFF || role === UserRole.FACILITY_MANAGER;

export function accessLabel(snapshot: AdminSnapshot, facilities: readonly AdminFacility[]) {
  if (snapshot.role === UserRole.STORAGE_CUSTOMER) return M.ownAccess;
  if (!isFacilityRole(snapshot.role)) return M.globalAccess;
  return (
    snapshot.facilityIds
      .map((id) => facilities.find((facility) => facility.id === id)?.name ?? id)
      .join(", ") || M.noAssignments
  );
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

export function matchesDate(at: string, date: string) {
  if (!date) return true;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(at));
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}` === date;
}

export function applyAdminChange(data: AdminMockData, change: AdminAccountChange): AdminMockData {
  const user = data.users.find((item) => item.id === change.userId);
  if (!user) return data;
  const before: AdminSnapshot = {
    role: user.role,
    status: user.status,
    facilityIds: [...user.facilityIds],
  };
  const after: AdminSnapshot = { ...before, ...change.patch };
  const updated = { ...user, ...after };
  return {
    ...data,
    users: data.users.map((item) => (item.id === user.id ? updated : item)),
    audits: [
      {
        id: `AUD-${crypto.randomUUID()}`,
        actor: change.actor,
        actorRole: UserRole.SYSTEM_ADMINISTRATOR,
        target: user.name,
        targetId: user.id,
        action: change.action,
        at: new Date().toISOString(),
        outcome: "SUCCESS",
        facilityIds: [...new Set([...before.facilityIds, ...after.facilityIds])],
        reason: change.reason,
        before,
        after,
      },
      ...data.audits,
    ],
  };
}

export function csvCell(value: string) {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function downloadCsv(
  section: string,
  headings: readonly string[],
  rows: readonly (readonly string[])[],
) {
  const content = [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `storex-admin-${section}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
