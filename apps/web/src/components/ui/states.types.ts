import type { ReactNode } from "react";

export type LoadingVariant = "content" | "dashboard" | "table" | "detail" | "form";

export interface LoadingStateProps {
  label?: string;
  variant?: LoadingVariant;
}

export interface FullScreenLoadingProps {
  label?: string;
}

export interface DelayedFullScreenLoadingProps {
  label?: string;
  delayMs?: number;
}

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}
