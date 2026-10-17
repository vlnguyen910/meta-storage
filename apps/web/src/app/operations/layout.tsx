import { UserRole } from "@metastorage/contracts";
import type { ReactNode } from "react";
import { ProtectedArea } from "@/components/layout/protected-area";
import { BusinessOperationsShell } from "@/modules/business-operations/business-operations-shell";
export default function OperationsLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedArea allowedRole={UserRole.BUSINESS_OPERATIONS_MANAGER} withAppShell={false}>
      <BusinessOperationsShell>{children}</BusinessOperationsShell>
    </ProtectedArea>
  );
}
