import { expect, it, vi } from "vitest";
import PaymentResultPage from "../../app/reservations/payment-result/page";
import { customerRoutes } from "../../config/routes/customer.routes";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

it("preserves the reservation and payment when redirecting the old public return URL", async () => {
  await PaymentResultPage({
    searchParams: Promise.resolve({
      paymentId: "payment",
      reservationId: "reservation",
      status: "success",
      next: "https://untrusted.test",
    }),
  });
  expect(redirect).toHaveBeenCalledWith(
    `${customerRoutes.paymentResult}?paymentId=payment&reservationId=reservation&status=success`,
  );
});
