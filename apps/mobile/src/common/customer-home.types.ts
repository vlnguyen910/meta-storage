import type { AppointmentRecordDto, FacilityCatalogItem } from "@metastorage/contracts";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import type { useFacilitySearch } from "../features/customer-home/use-facility-search";
import type { CustomerTab } from "./app-ui.types";
import type { BookingFacility } from "./booking.types";
import type { StorageView } from "./my-storage.types";

export type BookingOrigin =
  | { screen: "home" }
  | { screen: "search" }
  | { screen: "storage"; view: StorageView };
export type CustomerRoute =
  | { screen: "home" }
  | { screen: "profile" }
  | { screen: "search" }
  | { screen: "booking"; facility: BookingFacility; unitTypeId?: string; from: BookingOrigin }
  | { screen: "storage"; view: StorageView }
  | { screen: "appointments" }
  | { screen: "appointment"; id: string; from: "home" | "appointments" }
  | {
      screen: "support-new";
      reservationId?: string;
      paymentId?: string;
      from: CustomerSupportOrigin;
    }
  | { screen: "support-ticket"; id: string; created: boolean; from: CustomerSupportOrigin };
export type CustomerSupportOrigin = "profile" | "storage-current" | "storage-transactions";
export type AppointmentFilter = "all" | "upcoming" | "completed" | "closed";
interface CustomerIdentity {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string | null;
  readonly emailVerified?: boolean;
}
export interface CustomerNavigatorProps {
  readonly user: CustomerIdentity;
  readonly onLogout: () => void;
  readonly pending: boolean;
  readonly error?: string;
}
export interface CustomerLayoutProps extends CustomerNavigatorProps {
  readonly children: ReactNode;
  readonly title?: string;
  readonly onBack?: () => void;
  readonly onHome: () => void;
  readonly onStorage: () => void;
  readonly onProfile?: () => void;
  readonly selectedTab?: CustomerTab;
  readonly onUnavailable: () => void;
  readonly notice: boolean;
  readonly onDismissNotice: () => void;
  readonly showTabs?: boolean;
}
export interface CustomerProfileScreenProps extends CustomerNavigatorProps {
  readonly onCreateSupport: () => void;
}
export interface HomeScreenProps {
  readonly owner: string;
  readonly onAppointments: () => void;
  readonly onAppointment: (id: string) => void;
  readonly onSearch: (query: string) => void;
  readonly onStorage: () => void;
  readonly onBook: (facility: BookingFacility) => void;
}
export interface AppointmentsScreenProps {
  readonly owner: string;
  readonly onAppointment: (id: string) => void;
  readonly onUnavailable: () => void;
}
export interface AppointmentDetailScreenProps {
  readonly owner: string;
  readonly id: string;
}
export interface AppointmentCardProps {
  readonly appointment: AppointmentRecordDto;
  readonly onPress: () => void;
  readonly variant?: "summary" | "list";
}
export interface SummaryTileProps {
  readonly title: string;
  readonly value: string;
  readonly caption: string;
  readonly actionLabel: string;
  readonly icon: LucideIcon;
  readonly onPress: () => void;
  readonly warning?: boolean;
}
export interface FacilitySummaryProps {
  readonly name?: string;
  readonly address?: string;
  readonly compact?: boolean;
}
export interface FacilityCardProps {
  readonly facility: FacilityCatalogItem;
  readonly illustration: number;
  readonly onPress: () => void;
  readonly variant?: "rail" | "result";
}
export interface FacilitySearchFilters {
  readonly search: string;
  readonly city: string;
  readonly sort: "name" | "price";
}
export interface FacilitySearchScreenProps {
  readonly state: ReturnType<typeof useFacilitySearch>;
  readonly onBook: (facility: BookingFacility) => void;
}
