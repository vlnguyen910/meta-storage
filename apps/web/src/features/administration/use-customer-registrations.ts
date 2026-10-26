import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCustomerRegistrations(year: number) {
  return useQuery({
    queryKey: ["administration", "customer-registrations", year],
    queryFn: () => api.users.customerRegistrations(year),
    staleTime: 5 * 60 * 1000,
  });
}
