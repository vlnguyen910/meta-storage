export type MobileCheckoutBridge = {
  returnUrl?: string;
  checkoutUrl: string;
  checkoutFormFields: Record<string, string | number>;
};
