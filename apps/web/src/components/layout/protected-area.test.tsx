import { UserRole } from "@metastorage/database/schema/user-enums";
import { render, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProtectedArea } from "./protected-area";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (value: object) => unknown) =>
    select({ session: null, hydrated: true, authReady: true }),
}));
vi.mock("@/components/ui/states", () => ({ FullScreenLoading: () => null }));
vi.mock("./app-shell", () => ({ AppShell: () => null }));
it("preserves payment identifiers when a protected result requires sign-in", async () => {
  const target = "/customer/payments/result?paymentId=payment&reservationId=reservation";
  window.history.replaceState(null, "", target);
  try {
    render(
      <ProtectedArea allowedRole={UserRole.STORAGE_CUSTOMER}>
        <div>private</div>
      </ProtectedArea>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/login?returnTo=${encodeURIComponent(target)}`),
    );
  } finally {
    window.history.replaceState(null, "", "/");
  }
});
