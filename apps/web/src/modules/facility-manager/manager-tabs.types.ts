import type { ReportExportQuery } from "@metastorage/contracts";
import type { ReactNode } from "react";
export interface ManagerTabFrameProps {
  title: string;
  description: string;
  children: (facilityId: string) => ReactNode;
}
export interface ManagerFacilityTabProps {
  facilityId: string;
}
export interface ManagerReportRow {
  id: string;
  label: string;
  value: string;
  detail: string;
}
export type ManagerReportType = ReportExportQuery["type"];
