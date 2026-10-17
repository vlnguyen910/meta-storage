import type { ApiError, ApiResponse } from "@metastorage/shared";

export function successResponse<T>(
  data: T,
  message?: string,
): ApiResponse<T> & { success: true; data: T } {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(error: ApiError): ApiResponse<never> {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
}
