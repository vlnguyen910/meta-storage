import { redirect } from "next/navigation";
import { facilityManagerRoutes } from "@/config/routes";

export default function FacilityManagerRootPage() {
  redirect(facilityManagerRoutes.dashboard);
}
