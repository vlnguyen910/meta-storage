import type { ReportExportQuery, SupportOperationsTicket } from "@metastorage/contracts";
import type { ReactNode } from "react";
export interface ManagerTabFrameProps {
  title: string;
  description: string;
  children: (facilityId: string) => ReactNode;
}
export interface ManagerFacilityTabProps {
  facilityId: string;
}
export interface ManagerTicketProps extends ManagerFacilityTabProps {
  id: string;
}
export interface ManagerTicketFormProps {
  ticket: SupportOperationsTicket;
  onSaved?: () => void;
}
export interface ManagerImageProps {
  ticketId: string;
  imageId: string;
  filename: string;
  mimeType: string;
}
export interface ManagerReportRow {
  id: string;
  label: string;
  value: string;
  detail: string;
}
export type ManagerReportType = ReportExportQuery["type"];
export interface ManagerSupportFormValues {
  action: "ASSIGN" | "REPLY" | "NOTE" | "ACCEPT" | "REOPEN" | "PRIORITY";
  content: string;
  staffId: string;
  priority: "NORMAL" | "HIGH";
}
