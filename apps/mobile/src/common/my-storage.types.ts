import type { RentalListItem, RentalPaymentItem } from "@metastorage/contracts";
import type { useMyStorage } from "../features/my-storage/use-my-storage";
import type { BookingFacility } from "./booking.types";
export type StorageView = "current" | "history" | "transactions";
export interface StorageTransaction {
  readonly rental: RentalListItem;
  readonly payment: RentalPaymentItem;
}
type MyStorageState = ReturnType<typeof useMyStorage>;
export interface MyStorageScreenProps {
  readonly state: MyStorageState;
}
export interface StorageHeaderProps {
  readonly state: MyStorageState;
  readonly view: StorageView;
  readonly onView: (view: StorageView) => void;
  readonly onBook: () => void;
}
export interface RentalCardProps {
  readonly rental: RentalListItem;
  readonly now: number;
  readonly compact?: boolean;
  readonly onDetails: () => void;
  readonly onRenew?: () => void;
  readonly onRebook?: () => void;
}
export interface TransactionRowProps {
  readonly transaction: StorageTransaction;
  readonly onPress: () => void;
}
export interface StorageNavigatorProps {
  readonly owner: string;
  readonly view: StorageView;
  readonly onView: (view: StorageView) => void;
  readonly onBook: () => void;
  readonly onRebook: (facility: BookingFacility, unitTypeId: string) => void;
  readonly onUnavailable: () => void;
}

export type StorageSelection =
  | { kind: "rental"; id: string }
  | { kind: "payment"; transaction: StorageTransaction };
export interface StorageOverlaysProps {
  readonly state: MyStorageState;
}

export interface RentalsScreenProps extends MyStorageScreenProps {
  readonly onUnavailable: () => void;
}
export interface RentalHistoryScreenProps extends MyStorageScreenProps {
  readonly onRebook: StorageNavigatorProps["onRebook"];
}
