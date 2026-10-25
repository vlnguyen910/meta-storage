export interface LoginCaptureContext {
  path: string;
  providerId?: string;
  headers: Headers;
}

export interface LoginCaptureSession {
  id: string;
  userId: string;
  createdAt: Date;
}
