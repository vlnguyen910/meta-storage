import { styled } from "nativewind";
import { ActivityIndicator, TextInput } from "react-native";

// Keep prop-based native colors connected to CSS tokens as well.
export const ThemedActivityIndicator = styled(ActivityIndicator, {
  className: { target: "style", nativeStyleMapping: { color: true } },
});

export const ThemedTextInput = styled(TextInput, {
  className: "style",
  placeholderClassName: {
    target: false,
    nativeStyleMapping: { color: "placeholderTextColor" },
  },
  selectionClassName: {
    target: false,
    nativeStyleMapping: { color: "selectionColor" },
  },
});
