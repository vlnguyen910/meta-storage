import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import type { AppointmentFilter } from "../../common/customer-home.types";
import {
  appointmentEnd,
  appointmentStart,
  isOpenAppointment,
  matchesAppointmentFilter,
  nextCheckIn,
  shiftDate,
  vietnamDate,
  weekStart,
} from "../../common/customer-home.utils";
import { api } from "../../lib/api";
import { WEB_BASE_URL } from "../../lib/runtime-config";
import { CUSTOMER_HOME as M } from "./customer-home.messages";

export function useCustomerLinks() {
  const [error, setError] = useState<string>();
  async function openWeb(path: string) {
    setError(undefined);
    try {
      await Linking.openURL(`${WEB_BASE_URL}${path}`);
    } catch {
      setError(M.openWebError);
    }
  }
  return { openWeb, error };
}
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function useCustomerAppointments(owner: string) {
  return useQuery({
    queryKey: ["customer-home-appointments", owner],
    queryFn: () => api.appointments.mine(),
    staleTime: 30000,
  });
}
export function useCustomerHome(owner: string) {
  const now = useNow();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const appointments = useCustomerAppointments(owner);
  const rentals = useQuery({
    queryKey: ["customer-home-rentals", owner],
    queryFn: () => api.rentals.mine({ view: "current", limit: 100 }),
    staleTime: 30000,
  });
  const facilities = useQuery({
    queryKey: ["customer-home-facilities", submittedSearch],
    queryFn: () =>
      api.facilities.catalog({
        search: submittedSearch || undefined,
        page: 1,
        pageSize: 6,
        sort: "name",
      }),
    staleTime: 60000,
  });
  const links = useCustomerLinks();
  const items = appointments.data ?? [];
  return {
    appointments,
    rentals,
    facilities,
    now,
    search,
    submittedSearch,
    setSearch,
    ...links,
    next: nextCheckIn(items, now),
    todayCount: items.filter(
      (a) =>
        a.scheduledDate === vietnamDate(now) && isOpenAppointment(a) && appointmentEnd(a) >= now,
    ).length,
    rentalCount: rentals.data
      ? `${rentals.data.items.filter((r) => r.status === "ACTIVE").length}${rentals.data.nextCursor ? "+" : ""}`
      : "—",
    find: () => setSubmittedSearch(search.trim()),
    refresh: () => Promise.all([appointments.refetch(), rentals.refetch(), facilities.refetch()]),
    refreshing: appointments.isRefetching || rentals.isRefetching || facilities.isRefetching,
  };
}
export function useAppointmentList(owner: string) {
  const query = useCustomerAppointments(owner);
  const now = useNow();
  const [filter, setFilter] = useState<AppointmentFilter>("all");
  const [week, setWeek] = useState(() => weekStart(vietnamDate()));
  const [day, setDay] = useState<string>();
  const [facility, setFacility] = useState("");
  const items = query.data ?? [];
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(week, i));
  const visible = items
    .filter(
      (a) =>
        matchesAppointmentFilter(a, filter, now) &&
        (!facility || a.facilityId === facility) &&
        (day ? a.scheduledDate === day : a.scheduledDate >= week && a.scheduledDate <= days[6]),
    )
    .sort((a, b) => appointmentStart(a) - appointmentStart(b));
  return {
    query,
    now,
    filter,
    setFilter,
    week,
    days,
    day,
    setDay,
    facility,
    setFacility,
    visible,
    counts: Object.fromEntries(
      (["all", "upcoming", "completed", "closed"] as const).map((key) => [
        key,
        items.filter((a) => matchesAppointmentFilter(a, key, now)).length,
      ]),
    ) as Record<AppointmentFilter, number>,
    facilities: [
      ...new Map(items.map((a) => [a.facilityId, a.facility?.name ?? M.unknownFacility])).entries(),
    ],
    moveWeek: (offset: number) => {
      setWeek(shiftDate(week, offset * 7));
      setDay(undefined);
    },
    resetWeek: () => {
      setWeek(weekStart(vietnamDate(now)));
      setDay(undefined);
    },
  };
}
export function useAppointmentDetail(owner: string, id: string) {
  const now = useNow();
  const query = useQuery({
    queryKey: ["customer-home-appointment", owner, id],
    queryFn: () => api.appointments.get(id),
    staleTime: 10000,
  });
  const appointment = query.data;
  const unitTypeId = appointment?.unitType?.id ?? appointment?.reservation?.unitTypeId;
  const units = useQuery({
    queryKey: ["customer-home-unit-types", appointment?.facilityId],
    queryFn: () => api.facilities.listUnitTypes(appointment?.facilityId ?? "", { limit: 100 }),
    enabled: Boolean(appointment && unitTypeId),
    staleTime: 60000,
  });
  const unitType = units.data?.find((unit) => unit.id === unitTypeId);
  const qrUrl =
    appointment?.appointmentType === "CHECK_IN" &&
    isOpenAppointment(appointment) &&
    appointment.reservation?.status === "CONFIRMED"
      ? `${WEB_BASE_URL}/customer/reservations/${appointment.reservation.id}`
      : undefined;
  return { query, appointment, unitType, units, now, qrUrl };
}
