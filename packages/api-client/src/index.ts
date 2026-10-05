import type {
  ApiEnvelope,
  ApiFacilityAssignment,
  ApiUnitType,
  AssignBookingStaffInput,
  AssignPhysicalUnitInput,
  BookingListItem,
  CatalogFacility,
  CatalogFacilityListParams,
  CatalogUnitType,
  CheckInConfirmResult,
  CheckInLookupInput,
  CheckInLookupResult,
  ClientSession,
  ConfirmReservationInput,
  CookieSession,
  CustomerSignUpInput,
  DashboardSummary,
  EligibleUnit,
  Facility,
  FacilityListParams,
  FacilityStaffMember,
  Inspection,
  InspectionDraftInput,
  InspectionPhotoContent,
  InspectionPhotoInput,
  LoginInput,
  PaginatedResult,
  PaymentCheckoutInput,
  PaymentResponse,
  PaymentResult,
  PaymentStatusResponse,
  PhysicalUnitAssignment,
  RentalDetail,
  RentalListItem,
  Reservation,
  ReservationDraft,
  ReservationDraftInput,
  ReservationHold,
  ReservationQuote,
  ReservationQuoteInput,
  Session,
  SessionTokens,
  SessionUser,
  UnitAvailabilityOption,
  UnitTypeListParams,
  User,
  UserRole,
} from "@metastorage/contracts";
import axios, { type AxiosError, type AxiosInstance } from "axios";
import type { HttpClientOptions, RetryConfig } from "./types";

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
      listUnitTypes: (facilityId: string) =>
        http
          .get<ApiEnvelope<CatalogUnitType[]>>(`/catalog/facilities/${facilityId}/unit-types`)
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
      status: (paymentId: string) =>
        http.get<ApiEnvelope<PaymentStatusResponse>>(`/payments/${paymentId}/status`).then(unwrap),
      confirmSandbox: (paymentId: string) =>
        http
          .post<ApiEnvelope<PaymentResult>>(`/payments/${paymentId}/confirm-sandbox`)
          .then(unwrap),
    },
    bookings: {
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
