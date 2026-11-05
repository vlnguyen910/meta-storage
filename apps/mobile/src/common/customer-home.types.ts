import type { AppointmentRecordDto } from "@metastorage/contracts";
import type { ReactNode } from "react";

export type CustomerRoute =
  | { screen: "home" }
  | { screen: "appointments" }
  | { screen: "appointment"; id: string; from: "home" | "appointments" };
export type AppointmentFilter = "all" | "upcoming" | "completed" | "closed";
export interface CustomerIdentity {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
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
}
export interface HomeScreenProps {
  readonly owner: string;
  readonly onAppointments: () => void;
  readonly onAppointment: (id: string) => void;
}
export interface AppointmentsScreenProps {
  readonly owner: string;
  readonly onAppointment: (id: string) => void;
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
