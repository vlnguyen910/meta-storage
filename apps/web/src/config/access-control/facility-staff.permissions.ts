import { Permission } from "./permissions";

export const facilityStaffPermissions = [
  Permission.VIEW_ASSIGNED_FACILITY,
  Permission.HANDLE_CHECK_IN,
  Permission.HANDLE_RETURN,
] as const;
