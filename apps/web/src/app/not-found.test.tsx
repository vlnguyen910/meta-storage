import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import NotFound from "./not-found";

const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack }),
}));

describe("NotFound", () => {
  beforeEach(() => {
    mockBack.mockReset();
  });

  it("renders 404 page correctly with heading, search input, and quick links", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: AUTH_MESSAGES.notFoundTitle })).toBeInTheDocument();
    expect(screen.getByText(AUTH_MESSAGES.notFoundStatusEyebrow)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(AUTH_MESSAGES.notFoundSearchPlaceholder),
    ).toBeInTheDocument();
    expect(screen.getByText(AUTH_MESSAGES.navFacilitiesTitle)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: new RegExp(AUTH_MESSAGES.backToHome, "i") }),
    ).toBeInTheDocument();
  });
});
