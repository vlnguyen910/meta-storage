import type {
  ApiEnvelope,
  SupportCreateInput,
  SupportDetail,
  SupportImageInput,
  SupportImageResult,
  SupportMessagePage,
  SupportPageQuery,
  SupportReplyInput,
  SupportReplyResult,
  SupportTicketPage,
  SupportTicketQuery,
} from "@metastorage/contracts";
import type { AxiosInstance } from "axios";

const unwrap = <T>(response: { data: ApiEnvelope<T> }) => response.data.data;
export function createSupportClient(http: AxiosInstance) {
  const path = (id: string) => `/support/tickets/${encodeURIComponent(id)}`;
  return {
    support: {
      create: (input: SupportCreateInput) =>
        http.post<ApiEnvelope<SupportDetail>>("/support/tickets", input).then(unwrap),
      list: (params: Partial<SupportTicketQuery> = {}, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<SupportTicketPage>>("/support/tickets", { params, signal })
          .then(unwrap),
      detail: (id: string, signal?: AbortSignal) =>
        http.get<ApiEnvelope<SupportDetail>>(path(id), { signal }).then(unwrap),
      messages: (id: string, params: Partial<SupportPageQuery> = {}, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<SupportMessagePage>>(`${path(id)}/messages`, { params, signal })
          .then(unwrap),
      reply: (id: string, input: SupportReplyInput) =>
        http.post<ApiEnvelope<SupportReplyResult>>(`${path(id)}/messages`, input).then(unwrap),
      uploadImage: (id: string, messageId: string, input: SupportImageInput) =>
        http
          .post<ApiEnvelope<SupportImageResult>>(
            `${path(id)}/messages/${encodeURIComponent(messageId)}/attachments`,
            input,
            { timeout: 45_000 },
          )
          .then(unwrap),
      image: (id: string, imageId: string, signal?: AbortSignal) =>
        http
          .get<ArrayBuffer>(`${path(id)}/attachments/${encodeURIComponent(imageId)}`, {
            responseType: "arraybuffer",
            timeout: 45_000,
            signal,
          })
          .then((response) => response.data),
    },
  };
}
