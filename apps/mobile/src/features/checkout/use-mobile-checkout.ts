import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { MobileScreenProps } from "../../screens/mobile-screen.types";
import { DEMO_MESSAGES as messages } from "../demo/demo.messages";
import { mobileApi } from "../demo/demo-client";
import { MOBILE_CHECKOUT_MESSAGES as m } from "./checkout.messages";

export const tomorrowLocal = () =>
  new Date(Date.now() + 86400000 + 7 * 3600000).toISOString().slice(0, 10);
export function localDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "";
  const value = new Date(`${date}T${time}:00+07:00`);
  if (
    !Number.isFinite(value.getTime()) ||
    new Date(value.getTime() + 7 * 3600000).toISOString().slice(0, 16) !== `${date}T${time}`
  )
    return "";
  return value.toISOString();
}
const formSchema = z
  .object({
    fullName: z.string().trim().min(2, messages.invalid),
    email: z.string().email(messages.invalid),
    phone: z.string().regex(/^(0\d{9}|\+[1-9]\d{7,14})$/, messages.invalid),
    date: z.string().min(1, messages.period),
    time: z.string().min(1, messages.period),
    months: z
      .string()
      .refine(
        (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 12,
        messages.period,
      ),
  })
  .superRefine((values, context) => {
    const at = Date.parse(localDateTime(values.date, values.time));
    if (!Number.isFinite(at) || at <= Date.now() || at > Date.now() + 30 * 86400000)
      context.addIssue({ code: "custom", path: ["date"], message: messages.period });
  });
export function useMobileCheckout({ route, data, run, go }: MobileScreenProps) {
  const [facilityId, initialType] = route.id?.split(".") ?? [];
  const [selected, setSelected] = useState(initialType ?? "");
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: data.session?.name ?? "",
      email: data.session?.email ?? "",
      phone: data.session?.phone ?? "",
      date: tomorrowLocal(),
      time: "10:00",
      months: "1",
    },
  });
  const values = form.watch();
  const start = localDateTime(values.date, values.time);
  const availability = useQuery({
    queryKey: ["mobile", "availability", facilityId, start, values.months],
    queryFn: () =>
      mobileApi.catalog.listUnitTypes(facilityId ?? "", {
        checkInAt: start,
        durationMonths: Number(values.months),
      }),
    enabled:
      !!start &&
      Number(values.months) >= 1 &&
      Number(values.months) <= 12 &&
      (route.screen === "M-CK01" || route.screen === "M-CK02"),
    refetchInterval: 30000,
    retry: 1,
  });
  const draft = data.drafts.find((d) => d.id === route.id);
  const booking = data.bookings.find((b) => b.id === route.id);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = draft?.hold
    ? Math.max(0, Math.ceil((Date.parse(draft.hold.expiresAt) - now) / 1000))
    : 0;
  const types = availability.data ?? data.unitTypes.filter((t) => t.facilityId === facilityId);
  const type = types.find((t) => t.unitTypeId === selected);
  return {
    form,
    values,
    selected,
    setSelected,
    types,
    type,
    availability,
    draft,
    booking,
    seconds,
    continue: () => go("M-CK02", `${facilityId}.${selected}`),
    create: form.handleSubmit((input) =>
      run(
        async () => {
          const d = await mobileApi.reservations.createDraft({
            facilityId: facilityId ?? "",
            unitTypeId: selected,
            checkInAt: localDateTime(input.date, input.time),
            durationMonths: Number(input.months),
            contact: {
              fullName: input.fullName,
              email: input.email,
              phone: input.phone.startsWith("0") ? `+84${input.phone.slice(1)}` : input.phone,
            },
          });
          await mobileApi.reservations.createHold(d.id, d.draftAccessToken);
          return d;
        },
        (d) => go("M-CK03", d.id),
      ),
    ),
    renew: () =>
      draft
        ? run(
            () => mobileApi.reservations.createHold(draft.id, draft.draftAccessToken),
            () => go("M-CK03", draft.id),
          )
        : undefined,
    pay: (failed = false) =>
      draft?.hold
        ? run(
            () =>
              mobileApi.reservations.pay(draft.id, {
                holdToken: draft.hold?.holdToken ?? "",
                idempotencyKey: `demo-${draft.id}`,
                paymentMethodToken: failed ? "fail" : "success",
              }),
            (result) => {
              if (result.status === "SUCCEEDED") go("M-CK05", result.booking.id);
            },
          )
        : undefined,
    m,
  };
}
