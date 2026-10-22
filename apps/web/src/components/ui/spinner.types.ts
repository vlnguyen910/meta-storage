export type SpinnerVariant = "brand" | "button" | "default";
export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface SpinnerProps {
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  className?: string;
  label?: string;
}
