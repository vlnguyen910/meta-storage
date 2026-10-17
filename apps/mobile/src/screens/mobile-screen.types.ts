import type { MobileWorkspace } from "@metastorage/contracts";
import type { MobileRoute } from "../features/demo/demo.types";
import type { useMobileWorkspace } from "../features/demo/use-mobile-workspace";

export interface MobileScreenProps {
  route: MobileRoute;
  data: MobileWorkspace;
  go: (screen: MobileRoute["screen"], id?: string) => void;
  run: ReturnType<typeof useMobileWorkspace>["run"];
  pending: boolean;
}
