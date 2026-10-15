import type { ReactNode, Ref } from "react";
import type { TextInput, TextInputProps } from "react-native";

export interface MobileButtonProps {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  hint?: string;
}
export interface MobileFieldProps extends TextInputProps {
  ref?: Ref<TextInput>;
  label: string;
  error?: string;
  hint?: string;
}
export interface MobileCardProps {
  children: ReactNode;
  title?: string;
}
