import { UserRole } from "@metastorage/database/schema/user-enums";
import type { ReactNode } from "react";
import { ProtectedArea } from "@/components/layout/protected-area";
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <ProtectedArea allowedRole={UserRole.STORAGE_CUSTOMER}>{children}</ProtectedArea>;
}
