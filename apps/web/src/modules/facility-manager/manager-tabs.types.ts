import type { ReactNode } from "react";
export interface ManagerTabFrameProps {
  title: string;
  description: string;
  children: (facilityId: string) => ReactNode;
}
