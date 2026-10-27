import { UserRole } from "@metastorage/contracts";
import { z } from "zod";
import { ADMIN_MESSAGES as M } from "./admin.messages";

export const AdminUserDraftSchema = z.object({
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: M.invalidRole }) }),
  status: z.enum(["ACTIVE", "INACTIVE"], { errorMap: () => ({ message: M.invalidStatus }) }),
  reason: z.string().trim(),
});

export const AdminUserEditSchema = z.object({
  role: z
    .nativeEnum(UserRole)
    .refine(
      (role) => role !== UserRole.SYSTEM_ADMINISTRATOR && role !== UserRole.STORAGE_CUSTOMER,
      { message: M.invalidRoleChange },
    ),
});

export const AdminAssignmentDraftSchema = z.object({
  facilityIds: z.array(z.string()),
  reason: z.string().trim(),
});
