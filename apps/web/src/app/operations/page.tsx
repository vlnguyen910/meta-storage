import { redirect } from "next/navigation";
import { businessOperationsRoutes } from "@/config/routes";

export default function OperationsRootPage() {
  redirect(businessOperationsRoutes.dashboard);
}
