import { Controller } from "react-hook-form";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
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
import { CUSTOMER_MESSAGES as m } from "../features/customer/customer.messages";
import { useMobileCustomer } from "../features/customer/use-mobile-customer";
import { DEMO_MESSAGES as dm } from "../features/demo/demo.messages";
import type { MobileScreenProps } from "./mobile-screen.types";

export function CustomerScreens(props: MobileScreenProps) {
  const flow = useMobileCustomer(props);
  const { data, route, go, pending } = props;
  const b = flow.booking ?? flow.rentalBooking;
  const details = b ? (
    <Card title={b.facilityName}>
      <Row label={m.code} value={b.bookingCode} />
      <Notice>{m.status[b.status]}</Notice>
      <Row label={m.type} value={`${b.unitTypeName} • ${b.unitTypeSizeLabel}`} />
      <Row label={m.unit} value={b.assignedUnit?.physicalUnitCode ?? m.waiting} />
      <Row label={m.slot} value={dateTime(b.checkInSlotStart)} />
      <Row label={m.end} value={dateTime(b.rentalEndAt)} />
      <Row label={m.rent} value={money(b.rentalAmount)} />
      <Row label={m.deposit} value={money(b.depositAmount)} />
      <Row label={m.total} value={money(b.totalAmount)} />
    </Card>
  ) : null;
  return (
    <View>
      {route.screen === "M-C01" ? (
        <>
          <Heading>{m.welcome(data.session?.name ?? "")}</Heading>
          <Card title={m.overview}>
            <Button label={`${m.paid} (${data.bookings.length})`} onPress={() => go("M-C02")} />
            <Button
              label={`${m.holds} (${data.drafts.filter((d) => !data.bookings.some((b) => b.id === d.id)).length})`}
              secondary
              onPress={() => go("M-C04")}
            />
            <Button
              label={`${m.rentals} (${data.rentals.length})`}
              secondary
              onPress={() => go("M-C06")}
            />
          </Card>
          {data.bookings
            .filter((b) => b.status === "CONFIRMED")
            .slice(0, 1)
            .map((b) => (
              <Card key={b.id} title={b.bookingCode}>
                <Text className="mb-3 text-[#52635A]">{dateTime(b.checkInSlotStart)}</Text>
                <Button label={m.detail} onPress={() => go("M-C03", b.id)} />
              </Card>
            ))}
          <Button label={m.find} secondary onPress={() => go("M-P01")} />
        </>
      ) : null}
      {route.screen === "M-C02" ? (
        <>
          <Heading>{m.paid}</Heading>
          <Field label={m.search} value={flow.search} onChangeText={flow.setSearch} />
          {!flow.filtered.length ? (
            <Notice>{m.empty}</Notice>
          ) : (
            flow.filtered.map((item) => (
              <Card key={item.id} title={item.bookingCode}>
                <Notice>{m.status[item.status]}</Notice>
                <Text className="mb-3 text-[#52635A]">{item.facilityName}</Text>
                <Row label={m.total} value={money(item.totalAmount)} />
                <Button label={m.detail} onPress={() => go("M-C03", item.id)} />
              </Card>
            ))
          )}
        </>
      ) : null}
      {route.screen === "M-C03" ? (
        <>
          <Heading>{m.paid}</Heading>
          {details ?? <Notice error>{dm.missing}</Notice>}
          {b?.paidAt ? (
            <Card title={m.qr}>
              <BookingQr value={`demo-qr-${b.id}`} label={m.qr} />
              <Text className="text-center font-bold text-[#125345]">{b.bookingCode}</Text>
            </Card>
          ) : null}
          {b ? (
            <>
              <Notice>{m.reschedules(b.rescheduleCount)}</Notice>
              <Button
                label={m.changeDate}
                disabled={!flow.canReschedule || pending}
                hint={
                  data.session?.role !== "CUSTOMER"
                    ? dm.customerOnly
                    : !flow.canReschedule
                      ? dm.reschedule
                      : undefined
                }
                onPress={flow.openReschedule}
              />
              <Button
                label={m.cancel}
                danger
                disabled={!flow.canCancel || pending}
                hint={
                  data.session?.role !== "CUSTOMER"
                    ? dm.customerOnly
                    : !flow.canCancel
                      ? dm.cancel
                      : undefined
                }
                onPress={() => flow.setSheet("CANCEL")}
              />
            </>
          ) : null}
        </>
      ) : null}
      {route.screen === "M-C04" ? (
        <>
          <Heading>{m.holds}</Heading>
          {data.drafts
            .filter((d) => !data.bookings.some((b) => b.id === d.id))
            .map((d) => (
              <Card key={d.id} title={data.facilities.find((f) => f.id === d.facilityId)?.name}>
                <Notice>
                  {d.hold && Date.parse(d.hold.expiresAt) > Date.now() ? m.activeHold : m.expired}
                </Notice>
                <Row label={m.slot} value={dateTime(d.checkInAt)} />
                <Button label={m.detail} onPress={() => go("M-C05", d.id)} />
              </Card>
            ))}
          {!data.drafts.some((d) => !data.bookings.some((b) => b.id === d.id)) ? (
            <Notice>{m.empty}</Notice>
          ) : null}
        </>
      ) : null}
      {route.screen === "M-C05" ? (
        <>
          <Heading>{m.holds}</Heading>
          {flow.draft ? (
            <Card>
              <Notice>
                {flow.draft.hold && Date.parse(flow.draft.hold.expiresAt) > Date.now()
                  ? m.activeHold
                  : m.expired}
              </Notice>
              <Row label={m.rent} value={money(flow.draft.pricing?.rentalFeeAmount ?? 0)} />
              <Row label={m.deposit} value={money(flow.draft.pricing?.depositAmount ?? 0)} />
              <Notice>{dm.prices}</Notice>
              {flow.draft.hold && Date.parse(flow.draft.hold.expiresAt) > Date.now() ? (
                <Button label={m.pay} onPress={() => go("M-CK04", flow.draft?.id)} />
              ) : (
                <Button label={m.restart} disabled={pending} onPress={() => void flow.renew()} />
              )}
            </Card>
          ) : (
            <Notice error>{dm.missing}</Notice>
          )}
        </>
      ) : null}
      {route.screen === "M-C06" ? (
        <>
          <Heading>{m.rentals}</Heading>
          {data.rentals.map((r) => {
            const b = data.bookings.find((b) => b.id === r.bookingId);
            return (
              <Card key={r.id} title={b?.assignedUnit?.physicalUnitCode ?? b?.facilityName}>
                <Row label={m.end} value={b ? dateTime(b.rentalEndAt) : ""} />
                <Button label={m.detail} onPress={() => go("M-C07", r.id)} />
              </Card>
            );
          })}
          {!data.rentals.length ? <Notice>{m.empty}</Notice> : null}
        </>
      ) : null}
      {route.screen === "M-C07" ? (
        <>
          <Heading>{m.rentalDetail}</Heading>
          {details ?? <Notice error>{dm.missing}</Notice>}
          {flow.rental ? (
            <>
              <Button
                label={m.return}
                secondary
                onPress={() => {
                  flow.form.setValue("reason", "");
                  flow.setSheet("RETURN");
                }}
              />
              <Button
                label={m.change}
                onPress={() => {
                  flow.form.setValue("reason", "");
                  flow.setTarget(flow.rentalBooking?.unitTypeId ?? "");
                  flow.setSheet("CHANGE");
                }}
              />
              <Notice>{dm.financeTbd}</Notice>
              <Card title={m.requests}>
                {data.requests
                  .filter((r) => r.rentalId === flow.rental?.id)
                  .map((r) => (
                    <View key={r.id} className="mb-3">
                      <Text className="font-semibold text-[#131B2E]">
                        {r.type === "RETURN" ? m.return : m.change}
                      </Text>
                      <Text className="text-sm text-[#52635A]">
                        {m.requestStatus[r.status]} • {r.reason}
                      </Text>
                    </View>
                  ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
      <Modal
        visible={!!flow.sheet}
        transparent
        animationType="slide"
        onRequestClose={() => flow.setSheet(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end bg-black/40"
        >
          <View
            accessibilityViewIsModal
            className="max-h-[90%] rounded-t-xl border border-[#BFCAC4] bg-[#F6F8F6] p-5 pb-8"
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Heading>
                {flow.sheet === "CANCEL"
                  ? m.cancel
                  : flow.sheet === "RESCHEDULE"
                    ? m.changeDate
                    : flow.sheet === "RETURN"
                      ? m.return
                      : m.change}
              </Heading>
              {flow.sheet === "CANCEL" ? (
                <>
                  <Notice>{m.cancelPolicy}</Notice>
                  <Button
                    label={m.confirmCancel}
                    danger
                    disabled={pending}
                    onPress={() => void flow.cancel()}
                  />
                </>
              ) : (
                <>
                  {(
                    ["date", "time", ...(flow.sheet === "RESCHEDULE" ? [] : ["reason"])] as (
                      | "date"
                      | "time"
                      | "reason"
                    )[]
                  ).map((name) => (
                    <Controller
                      key={name}
                      name={name}
                      control={flow.form.control}
                      render={({ field, fieldState }) => (
                        <Field
                          ref={field.ref}
                          label={m[name]}
                          value={field.value}
                          onChangeText={field.onChange}
                          error={fieldState.error?.message}
                          multiline={name === "reason"}
                          hint={name === "date" ? m.periodHint : undefined}
                        />
                      )}
                    />
                  ))}
                  {flow.sheet === "CHANGE" ? (
                    <Card title={m.target}>
                      {data.unitTypes
                        .filter((t) => t.facilityId === flow.rentalBooking?.facilityId)
                        .map((t) => (
                          <Button
                            key={t.unitTypeId}
                            label={`${t.unitType} • ${t.sizeLabel}`}
                            secondary={flow.target !== t.unitTypeId}
                            onPress={() => flow.setTarget(t.unitTypeId)}
                          />
                        ))}
                    </Card>
                  ) : null}
                  <Notice>{flow.sheet === "RESCHEDULE" ? dm.reschedule : dm.financeTbd}</Notice>
                  <Button
                    label={flow.sheet === "RESCHEDULE" ? m.reschedule : m.confirm}
                    disabled={pending}
                    onPress={() => void flow.submit()}
                  />
                </>
              )}
              <Button
                label={m.back}
                secondary
                disabled={pending}
                onPress={() => flow.setSheet(null)}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
