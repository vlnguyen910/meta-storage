import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentScreen } from "./assignment-screen";

const authState = vi.hoisted(() => ({
  session: { user: { id: "fm-1", role: "FACILITY_MANAGER" } },
}));

const mockBooking = vi.hoisted(() => ({
  data: {
    id: "booking-1",
    bookingCode: "BK-8300-000001",
    contactName: "Lê Thị Mai Linh",
    contactPhone: "+84900000001",
    facilityName: "metastorage Sài Gòn Central",
    facilityId: "facility-1",
    unitTypeName: "Kho tiêu chuẩn (2 m²)",
    unitTypeSizeLabel: "2 m²",
    requestedMonths: 1,
    totalAmount: 1800000,
    checkInSlotStart: new Date().toISOString(),
    rentalEndAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
    assignedUnit: null,
    assignedStaff: null,
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));

const mockUnits = vi.hoisted(() => ({
  data: [
    {
      id: "u-1",
      code: "HCM-01-001",
      floor: 1,
      status: "OCCUPIED",
      isAvailableForPeriod: false,
      locationDescription: "Khu demo Flow 2",
    },
    {
      id: "u-2",
      code: "HCM-01-002",
      floor: 1,
      status: "OCCUPIED",
      isAvailableForPeriod: false,
      locationDescription: "Khu demo Flow 2",
    },
    {
      id: "u-9",
      code: "HCM-01-009",
      floor: 0,
      status: "AVAILABLE",
      isAvailableForPeriod: true,
      locationDescription: "Khu demo Flow 2",
    },
    {
      id: "u-10",
      code: "HCM-01-010",
      floor: 0,
      status: "MAINTENANCE",
      isAvailableForPeriod: false,
      locationDescription: "Khu demo Flow 2",
    },
    {
      id: "u-11",
      code: "HCM-01-011",
      floor: 0,
      status: "AVAILABLE",
      isAvailableForPeriod: true,
      locationDescription: "Khu demo Flow 2",
    },
    {
      id: "u-22",
      code: "HCM-01-022",
      floor: 1,
      status: "AVAILABLE",
      isAvailableForPeriod: true,
      locationDescription: "Khu demo Flow 3",
    },
  ],
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ bookingId: "booking-1" }),
}));

vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (s: typeof authState) => unknown) => select(authState),
}));

vi.mock("@/features/check-in/hooks", () => ({
  useBooking: () => mockBooking,
  useEligibleUnits: () => mockUnits,
  useAssignPhysicalUnitMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<AssignmentScreen />, { wrapper });
}

describe("AssignmentScreen unit sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBooking.data.assignedUnit = null;
  });

  it("prioritizes available units first, then orders by unit code ascending", () => {
    renderComponent();

    const radioInputs = screen.getAllByRole("radio");
    const renderedCodes = radioInputs.map((input) => input.getAttribute("aria-label"));

    // Available units: HCM-01-009, HCM-01-011, HCM-01-022
    // Unavailable units: HCM-01-001, HCM-01-002, HCM-01-010
    expect(renderedCodes).toEqual([
      "HCM-01-009",
      "HCM-01-011",
      "HCM-01-022",
      "HCM-01-001",
      "HCM-01-002",
      "HCM-01-010",
    ]);
  });

  it("prioritizes currently assigned unit at the top during reassignment", () => {
    mockBooking.data.assignedUnit = {
      physicalUnitId: "u-11",
      physicalUnitCode: "HCM-01-011",
    } as unknown as typeof mockBooking.data.assignedUnit;

    renderComponent();

    const radioInputs = screen.getAllByRole("radio");
    const renderedCodes = radioInputs.map((input) => input.getAttribute("aria-label"));

    // Currently assigned unit: HCM-01-011 (first)
    // Other available units: HCM-01-009, HCM-01-022
    // Unavailable units: HCM-01-001, HCM-01-002, HCM-01-010
    expect(renderedCodes).toEqual([
      "HCM-01-011",
      "HCM-01-009",
      "HCM-01-022",
      "HCM-01-001",
      "HCM-01-002",
      "HCM-01-010",
    ]);
  });
});
