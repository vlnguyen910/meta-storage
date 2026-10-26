import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { isAxiosError } from "axios";

export function customerApiError(error: unknown): string {
  if (isAxiosError(error) && typeof error.response?.data?.error?.message === "string")
    return error.response.data.error.message;
  return M.error;
}
