import { redirect } from "next/navigation";
import { customerRoutes } from "@/config/routes";

export default function CustomerRootPage() {
  redirect(customerRoutes.dashboard);
}
