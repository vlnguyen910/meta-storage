export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiError {
  code: number;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}
