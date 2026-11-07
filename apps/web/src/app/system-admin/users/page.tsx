import type { Metadata } from "next";
import { SystemAdministratorUsersScreen } from "@/modules/system-administrator/users/system-administrator-users-screen";

export const metadata: Metadata = {
  title: "Quản lý người dùng",
};

export default function SystemAdministratorUsersPage() {
  return <SystemAdministratorUsersScreen />;
}
