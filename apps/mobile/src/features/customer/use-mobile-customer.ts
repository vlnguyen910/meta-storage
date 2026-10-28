import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { MobileScreenProps } from "../../screens/mobile-screen.types";
import { localDateTime, tomorrowLocal } from "../checkout/use-mobile-checkout";
import { DEMO_MESSAGES as m } from "../demo/demo.messages";
import { mobileApi, mobileWorkflows } from "../demo/demo-client";
import { CUSTOMER_MESSAGES as cm } from "./customer.messages";

const requestForm = z
  .object({
    date: z.string().min(1, m.period),
    time: z.string().min(1, m.period),
    reason: z.string().trim().min(1, m.invalid).max(2000, m.invalid),
  })
  .superRefine((v, c) => {
    const at = Date.parse(localDateTime(v.date, v.time));
    if (!Number.isFinite(at) || at <= Date.now())
      c.addIssue({ code: "custom", path: ["date"], message: m.period });
  });
export function useMobileCustomer({ data, route, run, go }: MobileScreenProps) {
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<"RESCHEDULE" | "CANCEL" | "RETURN" | "CHANGE" | null>(null);
  const [target, setTarget] = useState("");
  const form = useForm({
    resolver: zodResolver(requestForm),
    defaultValues: { date: tomorrowLocal(), time: "10:00", reason: "" },
  });
  const booking = data.bookings.find((b) => b.id === route.id);
  const draft = data.drafts.find((d) => d.id === route.id);
  const rental = data.rentals.find((r) => r.id === route.id);
  const rentalBooking = data.bookings.find((b) => b.id === rental?.bookingId);
  const filtered = data.bookings.filter((b) =>
    `${b.bookingCode} ${b.facilityName}`.toLowerCase().includes(search.toLowerCase()),
  );
  return {
    search,
    setSearch,
    sheet,
    setSheet,
    target,
    setTarget,
    form,
    booking,
    draft,
    rental,
    rentalBooking,
    filtered,
    canReschedule:
      data.session?.role === "CUSTOMER" &&
      !!booking &&
      booking.status === "CONFIRMED" &&
      booking.rescheduleCount < 2 &&
      Date.parse(booking.checkInSlotStart) - Date.now() >= 86400000 &&
      !data.inspections.some((inspection) => inspection.bookingId === booking.id),
    canCancel:
      data.session?.role === "CUSTOMER" &&
      !!booking &&
      booking.status === "CONFIRMED" &&
      !data.inspections.some((inspection) => inspection.bookingId === booking.id),
    cancel: () =>
      booking
        ? run(
            () => mobileWorkflows.cancel(booking.id),
            () => setSheet(null),
          )
        : undefined,
    submit: form.handleSubmit((values) => {
      const preferredAt = localDateTime(values.date, values.time);
      if (sheet === "RESCHEDULE" && booking)
        return run(
          () => mobileWorkflows.reschedule(booking.id, { checkInAt: preferredAt }),
          () => setSheet(null),
        );
      if (rental && (sheet === "RETURN" || sheet === "CHANGE"))
        return run(
          () =>
            mobileWorkflows.request(rental.id, {
              type: sheet,
              reason: values.reason,
              preferredAt,
              targetUnitTypeId: sheet === "CHANGE" ? target : undefined,
            }),
          () => setSheet(null),
          m.request,
        );
    }),
    openReschedule: () => {
      form.setValue("reason", cm.changeDate);
      setSheet("RESCHEDULE");
    },
    renew: () =>
      draft
        ? run(
            () => mobileApi.reservations.createHold(draft.id, draft.draftAccessToken),
            () => go("M-CK03", draft.id),
          )
        : undefined,
  };
}
