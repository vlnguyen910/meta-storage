import { UserRole } from "@metastorage/contracts";
import type { ReactNode } from "react";
import { ProtectedArea } from "@/components/layout/protected-area";
export default function FacilityManagerLayout({ children }: { children: ReactNode }) {
  return <ProtectedArea allowedRole={UserRole.FACILITY_MANAGER}>{children}</ProtectedArea>;
}
