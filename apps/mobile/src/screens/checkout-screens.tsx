import { Controller } from "react-hook-form";
import { View } from "react-native";
import { BookingQr } from "../components/ui/booking-qr";
import {
  Button,
  Card,
  dateTime,
  Field,
  Heading,
  money,
  Notice,
  Row,
} from "../components/ui/mobile-ui";
import { MOBILE_CHECKOUT_MESSAGES as m } from "../features/checkout/checkout.messages";
import { useMobileCheckout } from "../features/checkout/use-mobile-checkout";
import { DEMO_MESSAGES as dm } from "../features/demo/demo.messages";
import type { MobileScreenProps } from "./mobile-screen.types";

export function CheckoutScreens(props: MobileScreenProps) {
  const flow = useMobileCheckout(props);
  const { route, go, pending } = props;
  if ((route.screen === "M-CK03" || route.screen === "M-CK04") && flow.booking?.paidAt) {
    return (
      <>
        <Heading>{m.review}</Heading>
        <Notice>{dm.alreadyPaid}</Notice>
        <Button label={m.viewBooking} onPress={() => go("M-C03", flow.booking?.id)} />
      </>
    );
  }
  if (route.screen === "M-CK01")
    return (
      <>
        <Heading>{m.choose}</Heading>
        <Notice>{dm.prices}</Notice>
        {flow.availability.isError ? (
          <>
            <Notice error>{dm.capacity}</Notice>
            <Button label={m.restart} onPress={() => void flow.availability.refetch()} />
          </>
        ) : null}
        {flow.types.map((type) => (
          <Card key={type.unitTypeId} title={`${type.unitType} • ${type.sizeLabel}`}>
            <Row label={m.monthly} value={money(type.monthlyPrice)} />
            <Row label={m.deposit} value={money(type.monthlyPrice)} />
            <Notice>{type.availableCount ? m.available(type.availableCount) : m.soldOut}</Notice>
            <Button
              label={flow.selected === type.unitTypeId ? m.selected : m.choose}
              secondary={flow.selected !== type.unitTypeId}
              disabled={!type.availableCount || flow.availability.isLoading}
              hint={!type.availableCount ? m.soldOut : undefined}
              onPress={() => flow.setSelected(type.unitTypeId)}
            />
          </Card>
        ))}
        <Button label={m.continue} disabled={!flow.type?.availableCount} onPress={flow.continue} />
      </>
    );
  if (route.screen === "M-CK02")
    return (
      <>
        <Heading>{m.details}</Heading>
        <Card title={`${flow.type?.unitType ?? m.selected} • ${flow.type?.sizeLabel ?? ""}`}>
          {(["fullName", "phone", "email", "date", "time", "months"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={flow.form.control}
              render={({ field, fieldState }) => (
                <Field
                  ref={field.ref}
                  label={m[name === "fullName" ? "name" : name]}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize={name === "fullName" ? "words" : "none"}
                  keyboardType={
                    name === "email"
                      ? "email-address"
                      : name === "phone"
                        ? "phone-pad"
                        : name === "months"
                          ? "number-pad"
                          : "default"
                  }
                  hint={name === "date" ? m.dateHint : name === "time" ? m.timeHint : undefined}
                  error={fieldState.error?.message}
                />
              )}
            />
          ))}
          <Button
            label={m.create}
            disabled={pending || !flow.type?.availableCount}
            hint={!flow.type?.availableCount ? m.soldOut : undefined}
            onPress={() => void flow.create()}
          />
        </Card>
        <Notice>{dm.prices}</Notice>
      </>
    );
  if (route.screen === "M-CK05") {
    const b = flow.booking;
    if (!b?.paidAt) return <Notice error>{dm.missing}</Notice>;
    return (
      <>
        <Heading>{m.success}</Heading>
        <Notice>{m.paid}</Notice>
        <Card>
          <Row label={m.code} value={b.bookingCode} />
          <BookingQr value={`demo-qr-${b.id}`} label={m.code} />
          <Row label={m.slot} value={dateTime(b.checkInSlotStart)} />
          <Row label={m.rent} value={money(b.rentalAmount)} />
          <Row label={m.deposit} value={money(b.depositAmount)} />
          <Row label={m.total} value={money(b.totalAmount)} />
        </Card>
        <Notice>{dm.pendingAssignment}</Notice>
        <Button label={m.viewBooking} onPress={() => go("M-C03", b.id)} />
        <Button label={m.browse} secondary onPress={() => go("M-P01")} />
        {!props.data.session ? <Notice>{m.guest}</Notice> : null}
      </>
    );
  }
  const draft = flow.draft;
  if (!draft?.pricing) return <Notice error>{dm.missing}</Notice>;
  return (
    <View>
      <Heading>{route.screen === "M-CK04" ? m.payment : m.review}</Heading>
      <Notice>{flow.seconds ? m.countdown(flow.seconds) : dm.expired}</Notice>
      <Card title={m.contact}>
        <Row label={m.name} value={draft.contact.fullName} />
        <Row label={m.email} value={draft.contact.email} />
        <Row label={m.phone} value={draft.contact.phone} />
        <Row label={m.slot} value={dateTime(draft.checkInAt)} />
        <Row label={m.months} value={String(draft.durationMonths)} />
      </Card>
      <Card title={m.review}>
        <Row label={m.rent} value={money(draft.pricing.rentalFeeAmount)} />
        <Row label={m.deposit} value={money(draft.pricing.depositAmount)} />
        <Row label={m.total} value={money(draft.pricing.totalAmount)} />
        <Notice>{m.waiting}</Notice>
        <Notice>{dm.prices}</Notice>
      </Card>
      {!flow.seconds ? (
        <Button label={m.restart} disabled={pending} onPress={() => void flow.renew()} />
      ) : route.screen === "M-CK04" ? (
        <>
          <Notice>{dm.mock}</Notice>
          <Button label={m.simulate} disabled={pending} onPress={() => void flow.pay()} />
          <Button label={m.fail} secondary disabled={pending} onPress={() => void flow.pay(true)} />
        </>
      ) : (
        <Button label={m.pay} disabled={pending} onPress={() => go("M-CK04", draft.id)} />
      )}
    </View>
  );
}
