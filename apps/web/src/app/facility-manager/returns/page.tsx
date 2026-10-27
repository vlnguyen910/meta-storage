import { redirect } from "next/navigation";

export default function FacilityManagerReturnsPage() {
  redirect("/facility-manager/tasks?view=returns");
}
