import type { ReactNode, Ref } from "react";
import type { PressableProps, TextInput, TextInputProps } from "react-native";

export type MobileButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "soft";

export interface MobileButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  variant?: MobileButtonVariant;
  /** Existing secondary actions retain their outline appearance. */
  secondary?: boolean;
  danger?: boolean;
  hint?: string;
  compact?: boolean;
  inline?: boolean;
}
export interface MobileFieldProps extends TextInputProps {
  ref?: Ref<TextInput>;
  label: string;
  error?: string;
  hint?: string;
  labelAction?: ReactNode;
}
export interface MobileCardProps {
  children: ReactNode;
  title?: string;
  compact?: boolean;
  outlined?: boolean;
  flush?: boolean;
}
