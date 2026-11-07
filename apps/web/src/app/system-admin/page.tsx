import { redirect } from "next/navigation";
import { systemAdministratorRoutes } from "@/config/routes";

export default function SystemAdminRootPage() {
  redirect(systemAdministratorRoutes.dashboard);
}
