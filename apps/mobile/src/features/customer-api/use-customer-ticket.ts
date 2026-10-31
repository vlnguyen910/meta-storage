import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { api } from "../../lib/api";

export function customerError(error: unknown) {
  if (axios.isAxiosError(error) && (!error.response || error.response.status >= 500))
    return M.error;
  return axios.isAxiosError(error)
    ? (error.response?.data?.error?.message ?? M.error)
    : error instanceof Error
      ? error.message
      : M.error;
}

export function useCustomerTicket(owner: string, id: string) {
  return useQuery({
    queryKey: ["support-ticket", owner, id],
    queryFn: ({ signal }) => api.support.detail(id, signal),
    enabled: Boolean(owner && id),
  });
}
