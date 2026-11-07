"use client";
import { useState } from "react";
import { storageEntryHref } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { useAvailability, useFacilities } from "@/features/facilities/hooks";

export function useLandingCatalog() {
  const session = useAuthStore((state) => state.session);
  const authReady = useAuthStore((state) => state.authReady);
  const searchHref = storageEntryHref(session?.user.role);
  const facilitiesQuery = useFacilities({ pageSize: 20 });
  const [chosenFacility, setFacility] = useState("");
  const [need, setNeed] = useState("all");
  const [filter, setFilter] = useState("all");
  const facilities = facilitiesQuery.data?.items ?? [];
  const facilityId = chosenFacility || facilities[0]?.id || "";
  const availabilityQuery = useAvailability(facilityId);
  const options = availabilityQuery.data?.filter(
    (item) => filter === "all" || (filter === "small" ? item.sizeSqm < 3 : item.sizeSqm >= 3),
  );
  return {
    facilities,
    facilitiesQuery,
    facilityId,
    setFacility,
    need,
    setNeed,
    filter,
    setFilter,
    options,
    availabilityQuery,
    searchHref,
    authReady,
  };
}
