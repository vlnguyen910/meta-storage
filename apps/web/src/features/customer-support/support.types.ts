import type { SupportTicketQuery } from "@metastorage/contracts";

export interface CustomerSupportFilters {
  search: string;
  category: string;
  status?: SupportTicketQuery["status"];
  page: number;
}
