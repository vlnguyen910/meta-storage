import type { MobileWorkspace } from "@metastorage/contracts";
import type { useMobileWorkspace } from "../../../features/demo/use-mobile-workspace";
import type { MobileRoute } from "./navigation/routes";

export interface MobileScreenProps {
  route: MobileRoute;
  data: MobileWorkspace;
  go: (screen: MobileRoute["screen"], id?: string) => void;
  run: ReturnType<typeof useMobileWorkspace>["run"];
  pending: boolean;
}
