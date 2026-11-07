import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Keyboard } from "react-native";
import type { FacilitySearchFilters } from "../../common/customer-home.types";
import { api } from "../../lib/api";

const defaults: FacilitySearchFilters = { search: "", city: "", sort: "name" };

export function useFacilitySearch(enabled: boolean) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [filters, setFilters] = useState(defaults);
  const [filterOpen, setFilterOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const query = useInfiniteQuery({
    queryKey: ["customer-facility-search", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.facilities.catalog({
        search: filters.search || undefined,
        city: filters.city || undefined,
        sort: filters.sort,
        page: pageParam,
        pageSize: 10,
      }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
    staleTime: 60000,
  });
  function submit(keyword = search, reset = false) {
    const value = keyword.trim().slice(0, 200);
    setSearch(value);
    if (reset) setCity("");
    setFilters((current) => ({ ...(reset ? defaults : current), search: value }));
    setFilterOpen(false);
    if (value)
      setHistory((current) =>
        [
          value,
          ...current.filter(
            (item) => item.toLocaleLowerCase("vi") !== value.toLocaleLowerCase("vi"),
          ),
        ].slice(0, 4),
      );
    Keyboard.dismiss();
  }
  return {
    query,
    search,
    changeSearch: (value: string) => {
      setSearch(value);
      if (!value.trim()) setFilters((current) => ({ ...current, search: "" }));
    },
    city,
    setCity,
    filters,
    filterOpen,
    toggleFilters: () => setFilterOpen((open) => !open),
    history,
    clearHistory: () => setHistory([]),
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    submit,
    start: (keyword: string) => submit(keyword, true),
    reset: () => submit("", true),
    applyCity: () => {
      setFilters((current) => ({ ...current, city: city.trim() }));
      submit();
    },
    toggleSort: () =>
      setFilters((current) => ({ ...current, sort: current.sort === "name" ? "price" : "name" })),
  };
}
