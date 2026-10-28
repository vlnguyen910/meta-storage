import { useState } from "react";
import { useCustomerCatalog, useCustomerTypes } from "../customer-api/customer-api.hooks";

export function usePublicLanding() {
  const facilities = useCustomerCatalog();
  const [chosenFacility, setFacility] = useState("");
  const [filter, setFilter] = useState("all");
  const facilityList = facilities.data?.pages.flat() ?? [];
  const facilityId = chosenFacility || facilityList[0]?.id || "";
  const types = useCustomerTypes(facilityId);
  const options = (types.data?.pages.flat() ?? []).filter((type) => {
    const area = type.lengthM * type.widthM;
    return filter === "all" || (filter === "small" ? area < 3 : area >= 3);
  });
  return { facilities, facilityList, facilityId, setFacility, filter, setFilter, types, options };
}
