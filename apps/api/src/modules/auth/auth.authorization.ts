import { UserRoleSchema, UserStatus } from "@metastorage/contracts";
import type { Role } from "@metastorage/database";
import { ForbiddenError } from "../../common/errors/app-error";
import { AUTH_MESSAGES } from "./auth.messages";

type AuthorizationUser = {
  role: string | null | undefined;
  status: string | null | undefined;
};

function isRole(value: string | null | undefined): value is Role {
  return UserRoleSchema.safeParse(value).success;
}

export function assertActiveUser(user: AuthorizationUser): asserts user is AuthorizationUser & {
  status: UserStatus.ACTIVE;
} {
  if (user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenError(AUTH_MESSAGES.accountDisabled);
  }
}

export function assertUserHasRole(
  user: AuthorizationUser,
  allowedRoles: readonly Role[],
): asserts user is AuthorizationUser & { role: Role } {
  if (!isRole(user.role) || !allowedRoles.includes(user.role)) {
    throw new ForbiddenError(AUTH_MESSAGES.permissionDenied);
  }
}
