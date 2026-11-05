import { AUTHENTICATION as M } from "../features/auth/authentication.messages";

export function authenticationError(error: Error) {
  if ("isAxiosError" in error) {
    const data = (
      error as { response?: { data?: { error?: { message?: string }; message?: string } } }
    ).response?.data;
    return data?.error?.message || data?.message || M.networkError;
  }
  return error.message === "Failed to fetch" ? M.networkError : error.message || M.requestFailed;
}
