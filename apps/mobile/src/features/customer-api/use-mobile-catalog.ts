import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import { useCustomerCatalog } from "./customer-api.hooks";

export function useMobileCatalog() {
  const query = useCustomerCatalog();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("name");
  const [selected, setSelected] = useState<string>();
  const facilities = query.data?.pages.flat() ?? [];
  const prices = useQueries({
    queries: facilities.map((facility) => ({
      queryKey: ["mobile-catalog-prices", facility.id],
      queryFn: async () => {
        let price: number | null = null;
        for (let offset = 0; ; offset += 100) {
          const page = await api.facilities.listUnitTypes(facility.id, { limit: 100, offset });
          for (const type of page)
            price = price === null ? type.monthlyPrice : Math.min(price, type.monthlyPrice);
          if (page.length < 100) return price;
        }
      },
      staleTime: 30000,
    })),
  });
  const items = facilities
    .map((facility, index) => ({ ...facility, price: prices[index]?.data }))
    .filter(
      (f) =>
        `${f.name} ${f.address}`
          .toLocaleLowerCase("vi")
          .includes(search.trim().toLocaleLowerCase("vi")) &&
        (!city || f.address.includes(city)),
    )
    .sort((a, b) =>
      sort === "price"
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : a.name.localeCompare(b.name, "vi"),
    );
  return {
    query,
    search,
    setSearch,
    city,
    setCity,
    sort,
    setSort,
    selected,
    setSelected,
    items,
    facility: facilities.find((f) => f.id === selected),
  };
}
