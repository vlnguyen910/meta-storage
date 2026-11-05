import type { LucideIcon, LucideProps } from "lucide-react-native";
import { styled } from "nativewind";

function IconBase({ as: Component, ...props }: LucideProps & { as: LucideIcon }) {
  return <Component size={20} strokeWidth={1.8} aria-hidden={true} focusable={false} {...props} />;
}

export const Icon = styled(IconBase, {
  className: { target: "style", nativeStyleMapping: { color: true } },
});
