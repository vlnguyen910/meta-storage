"use client";
import { useState } from "react";
import { useAvailability, useFacilities } from "@/features/facilities/hooks";

export function useLandingCatalog() {
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
  const bookingHref = (unitTypeId?: string) => {
    const params = new URLSearchParams({ facilityId, area: unitTypeId ? "all" : need });
    if (unitTypeId) params.set("unitTypeId", unitTypeId);
    return `/reservations/new?${params}`;
  };
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
    bookingHref,
  };
}
