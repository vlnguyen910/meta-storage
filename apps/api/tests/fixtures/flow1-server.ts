import { randomUUID } from "node:crypto";
import { db, eq, payments } from "@metastorage/database";
import { buildApp } from "../../src/app";

// Only this isolated E2E entrypoint stubs the external provider. Production and
// normal local development always use the authenticated SePay API.
const target = process.env.BOOKING_TEST_DATABASE_URL;
if (
  process.env.NODE_ENV !== "test" ||
  !target ||
  target !== process.env.DATABASE_URL ||
  !new URL(target).pathname.endsWith("test") ||
  process.env.SEPAY_MERCHANT_ID !== "flow1-test-merchant"
)
  throw new Error("Flow 1 server requires isolated test configuration and fake merchant");

const captured = new Map<string, { orderId: string; amount: string }>();
const originalFetch = globalThis.fetch;
globalThis.fetch = Object.assign(
  async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("https://pgapi-sandbox.sepay.vn/v1/order/detail/"))
      return originalFetch(input, init);
    const invoice = decodeURIComponent(url.split("/").at(-1) ?? "");
    const order = captured.get(invoice);
    return new Response(
      JSON.stringify(
        order
          ? {
              data: {
                order_id: order.orderId,
                order_invoice_number: invoice,
                order_status: "CAPTURED",
                order_amount: order.amount,
                order_currency: "VND",
                transactions: [],
              },
            }
          : {},
      ),
      { status: order ? 200 : 404 },
    );
  },
  { preconnect: originalFetch.preconnect },
);

const app = buildApp();
// Provider control belongs to the test entrypoint, never apps/api/src or Swagger.
app.post<{ Params: { invoice: string } }>(
  "/__test/sepay/orders/:invoice",
  async (request, reply) => {
    const [payment] = await db
      .select({ amount: payments.totalAmount })
      .from(payments)
      .where(eq(payments.paymentCode, request.params.invoice));
    if (!payment) return reply.status(404).send({ found: false });
    captured.set(request.params.invoice, {
      orderId: `SEPAY-E2E-${randomUUID()}`,
      amount: payment.amount,
    });
    return { captured: true };
  },
);

await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 4000) });
