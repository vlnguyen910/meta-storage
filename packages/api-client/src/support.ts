import type {
  ApiEnvelope,
  SupportBookingContext,
  SupportContextPage,
  SupportContextQuery,
  SupportCreateInput,
  SupportDetail,
  SupportPageQuery,
  SupportPaymentContext,
  SupportTicketPage,
  SupportTicketQuery,
} from "@metastorage/contracts";
import type { AxiosInstance } from "axios";

const unwrap = <T>(response: { data: ApiEnvelope<T> }) => response.data.data;
export function createSupportClient(http: AxiosInstance) {
  const path = (id: string) => `/support/tickets/${encodeURIComponent(id)}`;
  return {
    support: {
      contexts: (params: SupportContextQuery, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<SupportContextPage<SupportBookingContext>>>("/support/contexts", {
            params,
            signal,
          })
          .then(unwrap),
      contextPayments: (
        bookingId: string,
        params: Partial<SupportPageQuery> = {},
        signal?: AbortSignal,
      ) =>
        http
          .get<ApiEnvelope<SupportContextPage<SupportPaymentContext>>>(
            `/support/contexts/${encodeURIComponent(bookingId)}/payments`,
            { params, signal },
          )
          .then(unwrap),
      create: (input: SupportCreateInput) =>
        http.post<ApiEnvelope<SupportDetail>>("/support/tickets", input).then(unwrap),
      list: (params: Partial<SupportTicketQuery> = {}, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<SupportTicketPage>>("/support/tickets", { params, signal })
          .then(unwrap),
      detail: (id: string, signal?: AbortSignal) =>
        http.get<ApiEnvelope<SupportDetail>>(path(id), { signal }).then(unwrap),
    },
  };
}
