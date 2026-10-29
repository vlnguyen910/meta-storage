import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalLoadingProvider } from "@/components/providers/global-loading-provider";
import { bookingLookupMessages as m } from "./booking-lookup.messages";
import { BookingLookupForm } from "./booking-lookup-form";

const { requestGuestAccessLink } = vi.hoisted(() => ({ requestGuestAccessLink: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { legacyBookings: { requestGuestAccessLink } } }));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GlobalLoadingProvider>
        <BookingLookupForm />
      </GlobalLoadingProvider>
    </QueryClientProvider>,
  );
}

describe("BookingLookupForm", () => {
  beforeEach(() => requestGuestAccessLink.mockReset());

  it("requests a private access link using the booking code and booking email", async () => {
    const user = userEvent.setup();
    requestGuestAccessLink.mockResolvedValue({ message: "accepted" });
    renderForm();

    await user.type(screen.getByLabelText(m.bookingCode), "bk-2026-0001");
    await user.type(screen.getByLabelText(m.email), "Guest@Example.com");
    await user.click(screen.getByRole("button", { name: m.submit }));

    await waitFor(() =>
      expect(requestGuestAccessLink).toHaveBeenCalledWith(
        {
          bookingCode: "BK-2026-0001",
          email: "guest@example.com",
          idempotencyKey: expect.any(String),
        },
        expect.objectContaining({ meta: { globalLoading: true } }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(m.success);
  });

  it("validates the email before contacting the API", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(m.bookingCode), "BK-2026-0001");
    await user.type(screen.getByLabelText(m.email), "not-an-email");
    await user.click(screen.getByRole("button", { name: m.submit }));

    expect(await screen.findByText(m.emailInvalid)).toBeInTheDocument();
    expect(requestGuestAccessLink).not.toHaveBeenCalled();
  });
});
