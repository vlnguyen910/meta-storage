import type {
  ApiEnvelope,
  ApiFacility,
  ApiFacilityAssignment,
  ApiUnitType,
  AssignBookingStaffInput,
  AssignPhysicalUnitInput,
  BookingDraft,
  BookingDraftInput,
  BookingListItem,
  BookingPaymentInput,
  BookingPaymentSession,
  BookingTracking,
  BookingTrackingSession,
  CatalogAvailabilityParams,
  CatalogFacility,
  CatalogFacilityListParams,
  CatalogUnitType,
  CheckInConfirmResult,
  CheckInLookupInput,
  CheckInLookupResult,
  CheckInSlotOption,
  ClientSession,
  ConfirmManualRefundInput,
  ConfirmReservationInput,
  CookieSession,
  CustomerSignUpInput,
  DashboardSummary,
  EligibleUnit,
  Facility,
  FacilityListParams,
  FacilityQuery,
  FacilityStaffMember,
  Inspection,
  InspectionDraftInput,
  InspectionPhotoContent,
  InspectionPhotoInput,
  LoginInput,
  ManualRefund,
  ManualRefundConfirmation,
  ManualRefundQuery,
  OperationsOverview,
  PaginatedResult,
  PaymentCheckoutInput,
  PaymentResponse,
  PaymentStatusResponse,
  PhysicalUnitAssignment,
  PricingChange,
  PricingConfiguration,
  PricingQuery,
  PricingUpdateResult,
  ReconciliationReport,
  RentalDetail,
  RentalListItem,
  RentalReport,
  RentalReportQuery,
  ReportExportQuery,
  Reservation,
  ReservationDraft,
  ReservationDraftInput,
  ReservationHold,
  ReservationQuote,
  ReservationQuoteInput,
  RevenueReport,
  RevenueReportQuery,
  Session,
  SessionTokens,
  SessionUser,
  UnitAvailabilityOption,
  UnitTypeListParams,
  UpdateDepositPolicy,
  UpdateUnitTypePrice,
  User,
  UserRole,
  UtilizationReport,
  UtilizationReportQuery,
} from "@metastorage/contracts";
import axios, { type AxiosError, type AxiosInstance } from "axios";
import type { HttpClientOptions, RetryConfig } from "./types";

export { createMobileWorkflowClient } from "./mobile-workflows";
export type { HttpClientOptions, TokenProvider } from "./types";

export type AuthMode = "mock" | "better-auth";
type SessionFor<Mode extends AuthMode> = Mode extends "mock"
  ? Session
  : Mode extends "better-auth"
    ? CookieSession
    : ClientSession;

export function createHttpClient({ baseURL, tokenProvider }: HttpClientOptions): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 15_000, withCredentials: true });
  let refreshPromise: Promise<SessionTokens> | null = null;

  client.interceptors.request.use((config) => {
    const token = tokenProvider.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;
      if (error.response?.status !== 401 || !config || config._retry || config.skipAuthRefresh) {
        return Promise.reject(error);
      }

      const refreshToken = tokenProvider.getRefreshToken();
      if (!refreshToken) {
        tokenProvider.clearSession();
        return Promise.reject(error);
      }

      config._retry = true;
      refreshPromise ??= client
        .post<ApiEnvelope<SessionTokens>>("/auth/refresh", { refreshToken }, {
          skipAuthRefresh: true,
        } as RetryConfig)
        .then((response) => response.data.data)
        .finally(() => {
          refreshPromise = null;
        });

      try {
        const tokens = await refreshPromise;
        tokenProvider.updateTokens(tokens);
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return client.request(config);
      } catch (refreshError) {
        tokenProvider.clearSession();
        return Promise.reject(refreshError);
      }
    },
  );

  return client;
}

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  return response.data.data;
}

function toSession(user: SessionUser): CookieSession {
  return { user };
}

function createMetastorageApiClientImpl(http: AxiosInstance, authMode: AuthMode) {
  return {
    http,
    auth: {
      login: async (input: LoginInput) => {
        if (authMode === "mock") {
          return http.post<ApiEnvelope<Session>>("/auth/login", input).then(unwrap);
        }

        await http.post("/auth/sign-in/email", input);
        try {
          const user = await http.get<ApiEnvelope<SessionUser>>("/auth/me").then(unwrap);
          return toSession(user);
        } catch (error) {
          await http.post("/auth/sign-out").catch(() => undefined);
          throw error;
        }
      },
      me: async () => {
        if (authMode === "mock") {
          return http.get<ApiEnvelope<Session["user"]>>("/auth/me").then(unwrap);
        }

        const user = await http.get<ApiEnvelope<SessionUser>>("/auth/me").then(unwrap);
        return toSession(user).user;
      },
      logout: () =>
        authMode === "mock"
          ? http.post<ApiEnvelope<null>>("/auth/logout").then(unwrap)
          : http.post("/auth/sign-out").then(() => null),
      forgotPassword: (email: string) =>
        http.post<ApiEnvelope<null>>("/auth/forgot-password", { email }).then(unwrap),
      resendVerificationEmail: (email: string, callbackURL: string) =>
        http.post("/auth/send-verification-email", { email, callbackURL }).then(() => undefined),
      registerCustomer: (input: CustomerSignUpInput) =>
        http
          .post<{ message: string }>("/auth/customer-sign-up", input)
          .then((response) => response.data),
    },
    users: {
      list: () => http.get<ApiEnvelope<User[]>>("/users", { params: { limit: 100 } }).then(unwrap),
      setRole: (userId: string, role: User["role"]) =>
        http.patch<ApiEnvelope<User>>(`/users/${userId}/role`, { role }).then(unwrap),
    },
    facilities: {
      listActive: (params: Partial<Pick<FacilityQuery, "limit" | "offset">> = {}) =>
        http.get<ApiEnvelope<ApiFacility[]>>("/facilities", { params }).then(unwrap),
      listUnitTypes: (facilityId: string, params: UnitTypeListParams = {}) =>
        http
          .get<ApiEnvelope<ApiUnitType[]>>(`/facilities/${facilityId}/unit-types`, { params })
          .then(unwrap),
      list: (params: FacilityListParams = {}) =>
        http.get<ApiEnvelope<PaginatedResult<Facility>>>("/facilities", { params }).then(unwrap),
      myAssignments: () =>
        http.get<ApiEnvelope<ApiFacilityAssignment[]>>("/facilities/my-assignments").then(unwrap),
      get: (facilityId: string) =>
        http.get<ApiEnvelope<Facility>>(`/facilities/${facilityId}`).then(unwrap),
      availability: (facilityId: string) =>
        http
          .get<ApiEnvelope<UnitAvailabilityOption[]>>(`/facilities/${facilityId}/availability`)
          .then(unwrap),
      getStaff: (facilityId: string) =>
        http
          .get<ApiEnvelope<FacilityStaffMember[]>>(`/facilities/${facilityId}/staff`)
          .then(unwrap),
    },
    catalog: {
      listFacilities: (params: CatalogFacilityListParams = {}) =>
        http
          .get<ApiEnvelope<PaginatedResult<CatalogFacility>>>("/catalog/facilities", { params })
          .then(unwrap),
      getFacility: (facilityId: string) =>
        http.get<ApiEnvelope<CatalogFacility>>(`/catalog/facilities/${facilityId}`).then(unwrap),
      listUnitTypes: (facilityId: string, params: CatalogAvailabilityParams = {}) =>
        http
          .get<ApiEnvelope<CatalogUnitType[]>>(`/catalog/facilities/${facilityId}/unit-types`, {
            params,
          })
          .then(unwrap),
    },
    reservations: {
      createDraft: (input: ReservationDraftInput) =>
        http.post<ApiEnvelope<ReservationDraft>>("/reservations/drafts", input).then(unwrap),
      createHold: (draftId: string, draftAccessToken: string) =>
        http
          .post<ApiEnvelope<ReservationHold>>(`/reservations/drafts/${draftId}/hold`, {
            draftAccessToken,
          })
          .then(unwrap),
      pay: (draftId: string, input: PaymentCheckoutInput) =>
        http
          .post<ApiEnvelope<PaymentResponse>>(`/reservations/drafts/${draftId}/pay`, input)
          .then(unwrap),
      quote: (input: ReservationQuoteInput) =>
        http.post<ApiEnvelope<ReservationQuote>>("/reservations/quote", input).then(unwrap),
      confirm: (input: ConfirmReservationInput) =>
        http.post<ApiEnvelope<Reservation>>("/reservations/confirm", input).then(unwrap),
      mine: () => http.get<ApiEnvelope<Reservation[]>>("/reservations/mine").then(unwrap),
      get: (reservationId: string) =>
        http.get<ApiEnvelope<Reservation>>(`/reservations/${reservationId}`).then(unwrap),
    },
    payments: {
      status: (paymentId: string, accessToken?: string) =>
        http
          .get<ApiEnvelope<PaymentStatusResponse>>(`/payments/${paymentId}/status`, {
            headers: accessToken ? { "x-booking-access-token": accessToken } : undefined,
            ...(accessToken ? { skipAuthRefresh: true } : {}),
          })
          .then(unwrap),
      listRefunds: (params: Partial<ManualRefundQuery> = {}) =>
        http.get<ApiEnvelope<ManualRefund[]>>("/payments/refunds", { params }).then(unwrap),
      confirmManualRefund: (paymentId: string, input: ConfirmManualRefundInput) =>
        http
          .post<ApiEnvelope<ManualRefundConfirmation>>(
            `/payments/${paymentId}/refund/confirm`,
            input,
          )
          .then(unwrap),
    },
    bookings: {
      checkInSlots: () =>
        http.get<ApiEnvelope<CheckInSlotOption[]>>("/bookings/check-in-slots").then(unwrap),
      createDraft: (input: BookingDraftInput) =>
        http.post<ApiEnvelope<BookingDraft>>("/bookings/drafts", input).then(unwrap),
      pay: (bookingId: string, input: BookingPaymentInput) =>
        http
          .post<ApiEnvelope<BookingPaymentSession>>(`/bookings/${bookingId}/pay`, input)
          .then(unwrap),
      exchangeMagicLink: (token: string) =>
        http
          .post<ApiEnvelope<BookingTrackingSession>>("/booking/magic-link/exchange", { token }, {
            skipAuthRefresh: true,
          } as RetryConfig)
          .then(unwrap),
      tracking: (bookingCode: string) =>
        http
          .get<ApiEnvelope<BookingTracking>>(
            `/booking/tracking/${encodeURIComponent(bookingCode)}`,
            { skipAuthRefresh: true } as RetryConfig,
          )
          .then(unwrap),
      revokeTrackingSession: () =>
        http
          .post("/booking/session/revoke", undefined, { skipAuthRefresh: true } as RetryConfig)
          .then(() => undefined),
      listFacilityBookings: (facilityId: string, status?: string) =>
        http
          .get<ApiEnvelope<BookingListItem[]>>(`/facilities/${facilityId}/bookings`, {
            params: { status },
          })
          .then(unwrap),
      get: (bookingId: string) =>
        http.get<ApiEnvelope<BookingListItem>>(`/bookings/${bookingId}`).then(unwrap),
      getEligibleUnits: (bookingId: string) =>
        http.get<ApiEnvelope<EligibleUnit[]>>(`/bookings/${bookingId}/eligible-units`).then(unwrap),
      assignUnit: (bookingId: string, input: AssignPhysicalUnitInput) =>
        http
          .post<ApiEnvelope<PhysicalUnitAssignment>>(`/bookings/${bookingId}/assign-unit`, input)
          .then(unwrap),
      assignStaff: (bookingId: string, input: AssignBookingStaffInput) =>
        http
          .post<ApiEnvelope<BookingListItem>>(`/bookings/${bookingId}/assign-staff`, input)
          .then(unwrap),
      listAssignedToMe: (facilityId?: string) =>
        http
          .get<ApiEnvelope<BookingListItem[]>>("/bookings/assigned-to-me", {
            params: { facilityId },
          })
          .then(unwrap),
    },
    inspections: {
      history: (bookingId: string) =>
        http.get<ApiEnvelope<Inspection[]>>(`/bookings/${bookingId}/inspections`).then(unwrap),
      start: (bookingId: string) =>
        http.post<ApiEnvelope<Inspection>>(`/bookings/${bookingId}/inspections`).then(unwrap),
      get: (id: string) => http.get<ApiEnvelope<Inspection>>(`/inspections/${id}`).then(unwrap),
      save: (id: string, input: InspectionDraftInput) =>
        http.patch<ApiEnvelope<Inspection>>(`/inspections/${id}`, input).then(unwrap),
      upload: (id: string, input: InspectionPhotoInput) =>
        http.post<ApiEnvelope<Inspection>>(`/inspections/${id}/photos`, input).then(unwrap),
      photo: (id: string, photoId: string) =>
        http
          .get<ApiEnvelope<InspectionPhotoContent>>(`/inspections/${id}/photos/${photoId}`)
          .then(unwrap),
      removePhoto: (id: string, photoId: string, version: number) =>
        http
          .delete<ApiEnvelope<Inspection>>(`/inspections/${id}/photos/${photoId}`, {
            data: { version },
          })
          .then(unwrap),
      handover: (id: string, version: number) =>
        http.post<ApiEnvelope<Inspection>>(`/inspections/${id}/handover`, { version }).then(unwrap),
      complete: (id: string, version: number) =>
        http.post<ApiEnvelope<Inspection>>(`/inspections/${id}/complete`, { version }).then(unwrap),
    },
    checkIns: {
      lookup: (input: CheckInLookupInput) =>
        http.post<ApiEnvelope<CheckInLookupResult>>("/check-ins/lookup", input).then(unwrap),
      confirm: (bookingId: string) =>
        http
          .post<ApiEnvelope<CheckInConfirmResult>>(`/check-ins/${bookingId}/confirm`)
          .then(unwrap),
    },
    rentals: {
      mine: () => http.get<ApiEnvelope<RentalListItem[]>>("/rentals/mine").then(unwrap),
      get: (rentalId: string) =>
        http.get<ApiEnvelope<RentalDetail>>(`/rentals/${rentalId}`).then(unwrap),
    },
    dashboards: {
      get: (role: UserRole, facilityId?: string) =>
        http
          .get<ApiEnvelope<DashboardSummary>>(`/dashboards/${role}`, {
            params: facilityId ? { facilityId } : undefined,
          })
          .then(unwrap),
    },
    pricing: {
      getConfiguration: (params: Partial<PricingQuery> = {}) =>
        http
          .get<ApiEnvelope<PricingConfiguration>>("/business-rules/pricing", { params })
          .then(unwrap),
      getHistory: (params: Partial<PricingQuery> = {}) =>
        http
          .get<ApiEnvelope<PricingChange[]>>("/business-rules/pricing/history", { params })
          .then(unwrap),
      updateDepositPolicy: (input: UpdateDepositPolicy) =>
        http.patch<ApiEnvelope<PricingUpdateResult>>("/business-rules/pricing", input).then(unwrap),
      updateUnitTypePrice: (unitTypeId: string, input: UpdateUnitTypePrice) =>
        http
          .patch<ApiEnvelope<PricingUpdateResult>>(`/business-rules/pricing/${unitTypeId}`, input)
          .then(unwrap),
    },
    reports: {
      getOverview: (params: Partial<RevenueReportQuery> = {}) =>
        http.get<ApiEnvelope<OperationsOverview>>("/reports/overview", { params }).then(unwrap),
      getRevenue: (params: Partial<RevenueReportQuery> = {}) =>
        http.get<ApiEnvelope<RevenueReport>>("/reports/revenue", { params }).then(unwrap),
      getUtilization: (params: Partial<UtilizationReportQuery> = {}) =>
        http.get<ApiEnvelope<UtilizationReport>>("/reports/utilization", { params }).then(unwrap),
      getRentals: (params: Partial<RentalReportQuery> = {}) =>
        http.get<ApiEnvelope<RentalReport>>("/reports/rentals", { params }).then(unwrap),
      getReconciliation: (params: Partial<UtilizationReportQuery> = {}) =>
        http
          .get<ApiEnvelope<ReconciliationReport>>("/reports/reconciliation", { params })
          .then(unwrap),
      exportReport: async (
        params: ReportExportQuery,
      ): Promise<{ data: string; filename: string }> => {
        const response = await http.get("/reports/export", {
          params,
          responseType: "text",
        });
        const contentDisposition = response.headers["content-disposition"] as string | undefined;
        let filename = `${params.type}-report.csv`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match?.[1]) {
            filename = match[1];
          }
        }
        return { data: response.data as string, filename };
      },
    },
  };
}

export type MetastorageApiClient<Mode extends AuthMode = "mock"> = Omit<
  ReturnType<typeof createMetastorageApiClientImpl>,
  "auth"
> & {
  auth: Omit<ReturnType<typeof createMetastorageApiClientImpl>["auth"], "login" | "me"> & {
    login: (input: LoginInput) => Promise<SessionFor<Mode>>;
    me: () => Promise<SessionFor<Mode>["user"]>;
  };
};

export function createMetastorageApiClient(http: AxiosInstance): MetastorageApiClient<"mock">;
export function createMetastorageApiClient(
  http: AxiosInstance,
  authMode: "mock",
): MetastorageApiClient<"mock">;
export function createMetastorageApiClient(
  http: AxiosInstance,
  authMode: "better-auth",
): MetastorageApiClient<"better-auth">;
export function createMetastorageApiClient(
  http: AxiosInstance,
  authMode: AuthMode,
): MetastorageApiClient<AuthMode>;
export function createMetastorageApiClient(
  http: AxiosInstance,
  authMode: AuthMode = "mock",
): MetastorageApiClient<AuthMode> {
  return createMetastorageApiClientImpl(http, authMode) as MetastorageApiClient<AuthMode>;
}
