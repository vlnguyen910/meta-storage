import type { UserRole } from "@metastorage/contracts";
import type { ReactNode } from "react";

export interface ProtectedAreaProps {
  readonly allowedRole: UserRole;
  readonly children: ReactNode;
  readonly withAppShell?: boolean;
}
