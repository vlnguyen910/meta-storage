import type { UserRole } from "@metastorage/database/schema/user-enums";
import type { ReactNode } from "react";

export interface ProtectedAreaProps {
  readonly allowedRole: UserRole;
  readonly children: ReactNode;
  readonly withAppShell?: boolean;
}
