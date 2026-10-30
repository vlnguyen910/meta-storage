import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { customerRoutes } from "@/config/routes";
import { BookingTrackingScreen } from "./booking-tracking-screen";

const { replace, useBookingTracking } = vi.hoisted(() => ({
  replace: vi.fn(),
  useBookingTracking: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));
vi.mock("./use-booking-tracking", () => ({ useBookingTracking }));

it("clears retired guest credentials and opens current reservations without calling legacy APIs", () => {
  window.history.replaceState(null, "", "/booking/tracking?bookingCode=old#token=private");
  render(<BookingTrackingScreen />);
  expect(window.location.search).toBe("");
  expect(window.location.hash).toBe("");
  expect(replace).toHaveBeenCalledWith(customerRoutes.reservations);
  expect(useBookingTracking).not.toHaveBeenCalled();
});
