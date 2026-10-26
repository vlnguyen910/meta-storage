import type {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SupportTicketQuery,
} from "@metastorage/contracts";

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export interface CustomerSupportDetailProps {
  ticketId: string;
}

export interface PrivateSupportImageProps {
  ticketId: string;
  imageId: string;
  filename: string;
}

export interface SupportTicketFilterState {
  search: string;
  status?: SupportTicketQuery["status"];
  category?: SupportCategory;
}

export interface SupportBadgeConfig {
  label: string;
  className: string;
}
