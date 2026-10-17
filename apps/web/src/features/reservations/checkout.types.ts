import type { ReactNode } from "react";
import type { useReservationCheckout } from "./use-reservation-checkout";

export type CheckoutState = ReturnType<typeof useReservationCheckout>;
export interface CheckoutPanelProps {
  title: string;
  children: ReactNode;
  onEdit?: () => void;
}
