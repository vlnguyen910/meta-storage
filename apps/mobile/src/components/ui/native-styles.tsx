import { styled } from "nativewind";
import { ActivityIndicator } from "react-native";

// Keep prop-based native colors connected to CSS tokens as well.
export const ThemedActivityIndicator = styled(ActivityIndicator, {
  className: { target: "style", nativeStyleMapping: { color: true } },
});
