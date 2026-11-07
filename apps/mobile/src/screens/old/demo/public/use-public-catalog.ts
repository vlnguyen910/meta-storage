import type { MobileWorkspace } from "@metastorage/contracts";
import { useMemo, useState } from "react";
export function usePublicCatalog(data: MobileWorkspace) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const facilities = useMemo(
    () =>
      data.facilities.filter(
        (f) =>
          `${f.name} ${f.address}`
            .toLocaleLowerCase("vi")
            .includes(search.toLocaleLowerCase("vi")) &&
          (!city || f.address.includes(city)),
      ),
    [data.facilities, search, city],
  );
  return {
    search,
    setSearch,
    city,
    setCity,
    facilities,
    reset: () => {
      setSearch("");
      setCity("");
    },
  };
}
