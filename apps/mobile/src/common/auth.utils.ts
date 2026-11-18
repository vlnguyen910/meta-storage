import { AUTHENTICATION as M } from "../features/auth/authentication.messages";
import { apiErrorDetailMessage } from "./api-error.utils";

export function authenticationError(error: Error) {
  if ("isAxiosError" in error) {
    const response = (
      error as {
        response?: {
          status?: number;
          data?: { error?: { message?: string }; message?: string };
        };
      }
    ).response;
    if (!response) return M.networkError;
    if (response.status === 429) return M.tooManyRequests;
    if (response.status !== undefined && response.status >= 500) return M.requestFailed;
    return (
      apiErrorDetailMessage(error) ||
      response.data?.error?.message ||
      response.data?.message ||
      M.requestFailed
    );
  }
  return error.message === "Failed to fetch" ? M.networkError : error.message || M.requestFailed;
}
