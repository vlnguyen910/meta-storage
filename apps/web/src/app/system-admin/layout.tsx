import { UserRole } from "@metastorage/contracts";
import type { ReactNode } from "react";
import { ProtectedArea } from "@/components/layout/protected-area";
import { SystemAdministratorShell } from "@/modules/system-administrator/system-administrator-shell";
export default function SystemAdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedArea allowedRole={UserRole.SYSTEM_ADMINISTRATOR} withAppShell={false}>
      <SystemAdministratorShell>{children}</SystemAdministratorShell>
    </ProtectedArea>
  );
}
