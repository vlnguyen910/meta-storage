import type {
  ApiUnitType,
  CreateReservationDraftInput,
  FacilityCatalogItem,
} from "@metastorage/contracts";
import type { ReactNode } from "react";
import type { useBooking } from "../features/booking/use-booking";

export type BookingStep = 0 | 1 | 2 | 3 | 4;
export type BookingFacility = Pick<FacilityCatalogItem, "id" | "name" | "address">;
export type BookingValues = CreateReservationDraftInput & { contactPhone: string; notes: string };
export type BookingState = ReturnType<typeof useBooking>;
export interface BookingScreenProps {
  readonly state: BookingState;
}
export interface BookingUnitsScreenProps extends BookingScreenProps {
  readonly onChangeFacility: () => void;
}
export interface BookingSuccessScreenProps extends BookingScreenProps {
  readonly onHome: () => void;
  readonly onAppointment: (id: string) => void;
}
export interface BookingNavigatorProps {
  readonly unitTypeId?: string;
  readonly facility: BookingFacility;
  readonly user: { id: string; name: string; email?: string; phone?: string | null };
  readonly onClose: () => void;
  readonly onHome: () => void;
  readonly onChangeFacility: () => void;
  readonly onAppointment: (id: string) => void;
}
export interface BookingFrameProps {
  readonly state: BookingState;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly onNext?: () => void;
  readonly nextLabel?: string;
  readonly nextDisabled?: boolean;
}
export interface BookingSummaryProps {
  readonly state: BookingState;
  readonly showFacility?: boolean;
}
export interface UnitChoiceProps {
  readonly unit: ApiUnitType;
  readonly selected: boolean;
  readonly onSelect: () => void;
}
export interface GatewayProps {
  readonly url: string;
  readonly fields: Record<string, string | number>;
  readonly onReturn: () => void;
  readonly onCheck: () => void;
  readonly onError: () => void;
}
export interface SavedBooking extends Readonly<CreateReservationDraftInput> {
  readonly contactPhone: string;
  readonly draftId: string;
  readonly key: string;
  readonly paymentRequested?: boolean;
  readonly payment?: {
    paymentId: string;
    reservationId: string;
    paymentCode: string;
    expiresAt: string;
  };
}
