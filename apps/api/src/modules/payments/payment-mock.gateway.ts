import type { PaymentGateway } from "./payments.types";

export type { GatewayPaymentResult, PaymentGateway } from "./payments.types";

export class MockPaymentGateway implements PaymentGateway {
  readonly provider = "mock";

  async charge(input: {
    amount: string;
    currency: string;
    paymentMethodToken: string;
    idempotencyKey: string;
  }) {
    return {
      providerPaymentId: `mock_${input.idempotencyKey}`,
      status:
        input.paymentMethodToken.toLowerCase() === "fail"
          ? ("FAILED" as const)
          : ("SUCCEEDED" as const),
    };
  }
}
