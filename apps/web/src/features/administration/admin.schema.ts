import { UserRole } from "@metastorage/database/schema/user-enums";
import { z } from "zod";
import { ADMIN_MESSAGES as M } from "./admin.messages";

export const AdminUserEditSchema = z.object({
  role: z
    .nativeEnum(UserRole)
    .refine(
      (role) => role !== UserRole.SYSTEM_ADMINISTRATOR && role !== UserRole.STORAGE_CUSTOMER,
      { message: M.invalidRoleChange },
    ),
});
