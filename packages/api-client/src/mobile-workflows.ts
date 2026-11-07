import type {
  MobileDemoSession,
  MobileInspection,
  MobileInspectionInput,
  MobilePaidBooking,
  MobileRentalRequest,
  MobileRentalRequestInput,
  MobileRescheduleInput,
  MobileReturnReportInput,
  MobileWorkspace,
} from "@metastorage/contracts";
import type { AxiosInstance } from "axios";

// These endpoints are local demo contracts, not claims of backend capability.
export function createMobileWorkflowClient(http: AxiosInstance) {
  const unwrap = <T>(response: { data: { data: T } }): T => response.data.data;
  return {
    resetDemo: (confirmed: boolean) =>
      http.post<{ data: MobileWorkspace }>("/demo/reset", { confirmed }).then(unwrap),
    workspace: () => http.get<{ data: MobileWorkspace }>("/demo/workspace").then(unwrap),
    login: (email: string, password: string) =>
      http.post<{ data: MobileDemoSession }>("/demo/login", { email, password }).then(unwrap),
    logout: () => http.post<{ data: null }>("/demo/logout").then(unwrap),
    verifyEmail: (email: string) =>
      http.post<{ data: null }>("/demo/verify-email", { email }).then(unwrap),
    reschedule: (id: string, input: MobileRescheduleInput) =>
      http.post<{ data: MobilePaidBooking }>(`/demo/bookings/${id}/reschedule`, input).then(unwrap),
    cancel: (id: string) =>
      http.post<{ data: MobilePaidBooking }>(`/demo/bookings/${id}/cancel`).then(unwrap),
    request: (id: string, input: MobileRentalRequestInput) =>
      http.post<{ data: MobileRentalRequest }>(`/demo/rentals/${id}/requests`, input).then(unwrap),
    startInspection: (id: string) =>
      http.post<{ data: MobileInspection }>(`/demo/bookings/${id}/inspection`).then(unwrap),
    saveInspection: (id: string, input: MobileInspectionInput) =>
      http.patch<{ data: MobileInspection }>(`/demo/inspections/${id}`, input).then(unwrap),
    completeInspection: (id: string, version: number) =>
      http
        .post<{ data: MobileInspection }>(`/demo/inspections/${id}/complete`, { version })
        .then(unwrap),
    handover: (id: string, version: number, confirmed: boolean) =>
      http
        .post<{ data: MobileInspection }>(`/demo/inspections/${id}/handover`, {
          version,
          confirmed,
        })
        .then(unwrap),
    returnReport: (id: string, input: MobileReturnReportInput) =>
      http.post<{ data: MobileRentalRequest }>(`/demo/requests/${id}/report`, input).then(unwrap),
  };
}
