export type ToastTone = "success" | "error";

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}
