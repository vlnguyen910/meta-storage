import type { Metadata } from "next";
import { facilitiesMessages } from "@/features/facilities/facilities.messages";
import { PublicFacilitiesScreen } from "@/features/facilities/public-facilities-screen";

export const metadata: Metadata = { title: facilitiesMessages.title };
export default function FacilitiesPage() {
  return <PublicFacilitiesScreen />;
}
