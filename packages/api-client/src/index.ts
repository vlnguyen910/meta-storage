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
  CheckInLookupInput,
  CheckInLookupResult,
  CheckInSlotOption,
  ClientSession,
  ConfirmInspectionHandoverInput,
  ConfirmManualRefundInput,
  ConfirmReservationInput,
  CookieSession,
  CustomerAvailability,
  CustomerAvailabilityQuery,
  CustomerBookingDetail,
  CustomerBookingPage,
  CustomerBookingPageQuery,
  CustomerRegistrationStats,
  CustomerSignUpInput,
  DashboardSummary,
  EligibleUnit,
  Facility,
  FacilityListParams,
  FacilityQuery,
  FacilityRentalHistoryQuery,
  FacilityRentalItem,
  FacilityRentalListQuery,
  FacilityRentalPage,
  FacilityRentalPaymentPage,
  FacilityStaffMember,
  InspectionEvidenceInput,
  InspectionRecord,
  LoginInput,
  ManualRefund,
  ManualRefundConfirmation,
  ManualRefundQuery,
  MonthlyRevenueQuery,
  MonthlyRevenueReport,
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
  RentalPage,
  RentalPageQuery,
  RentalReport,
  RentalReportQuery,
  ReportExportQuery,
  RequestGuestAccessLink,
  Reservation,
  ReservationDraft,
  ReservationDraftInput,
  ReservationHold,
  ReservationQuote,
  ReservationQuoteInput,
  ResetPasswordInput,
  RevenueReport,
  RevenueReportQuery,
  Session,
  SessionTokens,
  SessionUser,
  SocialAuthInput,
  SocialAuthResponse,
  StaffTasksQuery,
  StorageUnitMaintenanceTransition,
  StorageUnitResponse,
  UnitTypeListParams,
  UpdateDepositPolicy,
  UpdateInspectionInput,
  UpdateStorageUnitStatusBody,
  UpdateUnitTypePrice,
  UpdateUserRoleWithoutCustomerInput,
  UpdateUserStatusInput,
  User,
  UserListQuery,
  UtilizationReport,
  UtilizationReportQuery,
} from "@metastorage/contracts";
import type { UserRole } from "@metastorage/database/schema/user-enums";
import axios, { type AxiosError, type AxiosInstance } from "axios";
import { createFacilityWorkspaceClient } from "./facility-workspace";
import { createFlow3Client } from "./flow3";
import { createFlow5Client } from "./flow5";
import { createSupportClient } from "./support";
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
    ...createFlow3Client(http),
    ...createFlow5Client(http),
    ...createSupportClient(http),
    ...createFacilityWorkspaceClient(http),
    http,
    notifications: {
      webSocketUrl: (origin: string) => {
        const base = (http.defaults.baseURL ?? "/api").replace(/\/$/, "");
        const url = new URL(`${base}/notifications/ws`, origin);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        return url.toString();
      },
    },
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
        authMode === "mock"
          ? http.post<ApiEnvelope<null>>("/auth/forgot-password", { email }).then(unwrap)
          : http.post("/auth/request-password-reset", { email }).then(() => undefined),
      resetPassword: (input: ResetPasswordInput) =>
        http
          .post("/auth/reset-password", {
            token: input.token,
            newPassword: input.newPassword,
          })
          .then(() => undefined),
      resendVerificationEmail: (email: string, callbackURL: string) =>
        http.post("/auth/send-verification-email", { email, callbackURL }).then(() => undefined),
      registerCustomer: (input: CustomerSignUpInput) =>
        http
          .post<{ message: string }>("/auth/customer-sign-up", input)
          .then((response) => response.data),
      signInSocial: async (input: SocialAuthInput): Promise<SocialAuthResponse> => {
        if (authMode === "mock") {
          return { url: input.callbackURL, redirect: true };
        }
        const response = await http.post<SocialAuthResponse>("/auth/sign-in/social", {
          provider: input.provider,
          callbackURL: input.callbackURL,
          errorCallbackURL: input.errorCallbackURL,
          disableRedirect: true,
        });
        return response.data;
      },
      linkSocial: async (input: SocialAuthInput): Promise<SocialAuthResponse> => {
        if (authMode === "mock") {
          return { url: input.callbackURL, redirect: true };
        }
        const response = await http.post<SocialAuthResponse>("/auth/link-social", {
          provider: input.provider,
          callbackURL: input.callbackURL,
          errorCallbackURL: input.errorCallbackURL,
          disableRedirect: true,
        });
        return response.data;
      },
    },
    users: {
      list: (params: Partial<UserListQuery> = { limit: 100 }) =>
        http.get<ApiEnvelope<User[]>>("/users", { params }).then(unwrap),
      get: (userId: string) => http.get<ApiEnvelope<User>>(`/users/${userId}`).then(unwrap),
      setStatus: (userId: string, input: UpdateUserStatusInput) =>
        http.patch<ApiEnvelope<User>>(`/users/${userId}/status`, input).then(unwrap),
      customerRegistrations: (year?: number) =>
        http
          .get<ApiEnvelope<CustomerRegistrationStats>>("/users/customer-registrations", {
            params: { year },
          })
          .then(unwrap),
      setRole: (userId: string, role: UpdateUserRoleWithoutCustomerInput["role"]) =>
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
      availability: (facilityId: string, params: CustomerAvailabilityQuery, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<CustomerAvailability>>(`/facilities/${facilityId}/availability`, {
            params,
            signal,
          })
          .then(unwrap),
      getStaff: (facilityId: string) =>
        http
          .get<ApiEnvelope<FacilityStaffMember[]>>(`/facilities/${facilityId}/staff`)
          .then(unwrap),
    },
    storageUnits: {
      get: (id: string) =>
        http.get<ApiEnvelope<StorageUnitResponse>>(`/storage-units/${id}`).then(unwrap),
      updateStatus: (id: string, input: UpdateStorageUnitStatusBody) =>
        http
          .patch<ApiEnvelope<StorageUnitResponse>>(`/storage-units/${id}/status`, input)
          .then(unwrap),
      transition: (id: string, input: StorageUnitMaintenanceTransition) =>
        http
          .post<ApiEnvelope<StorageUnitResponse>>(`/storage-units/${id}/transitions`, input)
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
      cancel: (bookingId: string) =>
        http
          .post<ApiEnvelope<import("@metastorage/contracts").BookingClosure>>(
            `/bookings/${encodeURIComponent(bookingId)}/cancel`,
          )
          .then(unwrap),
      mine: (params: Partial<CustomerBookingPageQuery> = {}) =>
        http.get<ApiEnvelope<CustomerBookingPage>>("/bookings/mine", { params }).then(unwrap),
      getMine: (bookingId: string) =>
        http.get<ApiEnvelope<CustomerBookingDetail>>(`/bookings/mine/${bookingId}`).then(unwrap),
      requestGuestAccessLink: (input: RequestGuestAccessLink) =>
        http
          .post<ApiEnvelope<{ message: string }>>("/booking/access-link", input, {
            skipAuthRefresh: true,
          } as RetryConfig)
          .then(unwrap),
      checkInSlots: () =>
        http.get<ApiEnvelope<CheckInSlotOption[]>>("/bookings/check-in-slots").then(unwrap),
      checkInLookup: (input: CheckInLookupInput) =>
        http
          .post<ApiEnvelope<CheckInLookupResult>>("/bookings/check-in/lookup", input)
          .then(unwrap),
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
      listAssignedToMe: (
        facilityId?: string,
        dates: Pick<StaffTasksQuery, "fromDate" | "toDate"> = {},
      ) =>
        http
          .get<ApiEnvelope<BookingListItem[]>>("/bookings/assigned-to-me", {
            params: { ...dates, facilityId },
          })
          .then(unwrap),
    },
    inspections: {
      history: (bookingId: string) =>
        http
          .get<ApiEnvelope<InspectionRecord[]>>(`/inspections/bookings/${bookingId}`)
          .then(unwrap),
      start: (bookingId: string) =>
        http.post<ApiEnvelope<InspectionRecord>>(`/inspections/bookings/${bookingId}`).then(unwrap),
      get: (id: string) =>
        http.get<ApiEnvelope<InspectionRecord>>(`/inspections/${id}`).then(unwrap),
      save: (id: string, input: UpdateInspectionInput) =>
        http.patch<ApiEnvelope<InspectionRecord>>(`/inspections/${id}`, input).then(unwrap),
      upload: (id: string, input: InspectionEvidenceInput) =>
        http
          .patch<ApiEnvelope<InspectionRecord>>(`/inspections/${id}`, { addEvidence: [input] })
          .then(unwrap),
      removePhoto: (id: string, photoId: string) =>
        http
          .patch<ApiEnvelope<InspectionRecord>>(`/inspections/${id}`, {
            removeEvidenceIds: [photoId],
          })
          .then(unwrap),
      handover: (id: string, input: ConfirmInspectionHandoverInput) =>
        http.post<ApiEnvelope<InspectionRecord>>(`/inspections/${id}/handover`, input).then(unwrap),
    },
    rentals: {
      facilityList: (facilityId: string, params: Partial<FacilityRentalListQuery> = {}) =>
        http
          .get<ApiEnvelope<FacilityRentalPage>>(`/rentals/facility/${facilityId}`, { params })
          .then(unwrap),
      facilityDetail: (facilityId: string, rentalId: string) =>
        http
          .get<ApiEnvelope<FacilityRentalItem>>(`/rentals/facility/${facilityId}/${rentalId}`)
          .then(unwrap),
      facilityPayments: (
        facilityId: string,
        rentalId: string,
        params: Partial<FacilityRentalHistoryQuery> = {},
      ) =>
        http
          .get<ApiEnvelope<FacilityRentalPaymentPage>>(
            `/rentals/facility/${facilityId}/${rentalId}/payments`,
            { params },
          )
          .then(unwrap),
      mine: (params: Partial<RentalPageQuery> = {}) =>
        http.get<ApiEnvelope<RentalPage>>("/rentals/mine", { params }).then(unwrap),
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
      getMonthlyRevenue: (params: MonthlyRevenueQuery = {}) =>
        http
          .get<ApiEnvelope<MonthlyRevenueReport>>("/reports/revenue/monthly", { params })
          .then(unwrap),
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
