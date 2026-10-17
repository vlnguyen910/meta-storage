import { HANDOVER_CHECKLIST_ITEMS } from "@metastorage/contracts";
import { Controller } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { MobilePhoto } from "../components/ui/mobile-photo";
import { Button, Card, dateTime, Field, Heading, Notice, Row } from "../components/ui/mobile-ui";
import { DEMO_MESSAGES as dm } from "../features/demo/demo.messages";
import { STAFF_MESSAGES as m } from "../features/staff/staff.messages";
import { StaffCamera } from "../features/staff/staff-camera";
import { useMobileStaff } from "../features/staff/use-mobile-staff";
import type { MobileScreenProps } from "./mobile-screen.types";

export function StaffScreens(props: MobileScreenProps) {
  const flow = useMobileStaff(props);
  const { route, data, go, pending } = props;
  const b = flow.booking;
  const inspection = flow.inspection;
  const summary = b ? (
    <Card title={b.bookingCode}>
      <Row label={m.person} value={b.contactName} />
      <Row label={m.unit} value={b.assignedUnit?.physicalUnitCode ?? dm.pendingAssignment} />
      <Row label={m.slot} value={dateTime(b.checkInSlotStart)} />
    </Card>
  ) : null;
  const checklist = (
    <Card title={m.checklist}>
      {HANDOVER_CHECKLIST_ITEMS.map((item) => {
        const result = flow.checklist.find((r) => r.itemCode === item.code);
        return (
          <View key={item.code} className="mb-4">
            <Text className="mb-2 font-semibold leading-5 text-[#131B2E]">{item.label}</Text>
            <View className="gap-2">
              <Button
                label={m.pass}
                accessibilityLabel={`${item.label}: ${m.pass}`}
                secondary={result?.result !== "PASS"}
                disabled={pending}
                onPress={() => flow.choose(item.code, "PASS")}
              />
              <Button
                label={m.fail}
                accessibilityLabel={`${item.label}: ${m.fail}`}
                danger={result?.result === "FAIL"}
                secondary={result?.result !== "FAIL"}
                disabled={pending}
                onPress={() => flow.choose(item.code, "FAIL")}
              />
            </View>
          </View>
        );
      })}
    </Card>
  );
  return (
    <View>
      {route.screen === "M-FS01" ? (
        <>
          <Heading>{m.tasks}</Heading>
          <Button label={m.lookup} secondary onPress={() => go("M-FS04")} />
          <Button label={m.returns} secondary onPress={() => go("M-FS02")} />
          {data.bookings.map((b) => (
            <Card key={b.id} title={b.bookingCode}>
              <Text className="mb-3 text-[#52635A]">
                {b.facilityName} • {b.contactName}
              </Text>
              <Row label={m.unit} value={b.assignedUnit?.physicalUnitCode ?? ""} />
              <Row label={m.slot} value={dateTime(b.checkInSlotStart)} />
              <Button
                label={b.status === "CHECKED_IN" ? m.done : m.lookup}
                disabled={b.status !== "CONFIRMED"}
                hint={b.status !== "CONFIRMED" ? m.closedTask : undefined}
                onPress={() => go("M-FS04", b.id)}
              />
            </Card>
          ))}
          {!data.bookings.length ? <Notice>{m.empty}</Notice> : null}
        </>
      ) : null}
      {route.screen === "M-FS02" ? (
        <>
          <Heading>{m.returns}</Heading>
          <Notice>{m.authority}</Notice>
          {data.requests
            .filter((r) => r.type === "RETURN")
            .map((r) => (
              <Card
                key={r.id}
                title={
                  data.bookings.find((b) =>
                    data.rentals.some(
                      (rental) => rental.id === r.rentalId && rental.bookingId === b.id,
                    ),
                  )?.assignedUnit?.physicalUnitCode
                }
              >
                <Row label={m.returnTime} value={dateTime(r.preferredAt)} />
                <Row label={m.reason} value={r.reason} />
                <Button
                  label={r.status === "REPORT_SENT" ? m.reportSent : m.report}
                  secondary
                  onPress={() => go("M-FS03", r.id)}
                />
              </Card>
            ))}
          {!data.requests.length ? <Notice>{m.empty}</Notice> : null}
        </>
      ) : null}
      {route.screen === "M-FS03" ? (
        <>
          <Heading>{m.report}</Heading>
          <Notice>{m.authority}</Notice>
          {!flow.request ? (
            <Notice error>{dm.missing}</Notice>
          ) : flow.request.status === "REPORT_SENT" ? (
            <Card>
              <Notice>{m.reportSent}</Notice>
              <Text className="leading-6 text-[#131B2E]">{flow.request.report?.notes}</Text>
              {HANDOVER_CHECKLIST_ITEMS.map((item) => (
                <Row
                  key={item.code}
                  label={item.label}
                  value={
                    flow.request?.report?.checklist.find((entry) => entry.itemCode === item.code)
                      ?.result === "PASS"
                      ? m.pass
                      : m.fail
                  }
                />
              ))}
              {flow.request.report?.photos.map((uri) => (
                <MobilePhoto key={uri} label={m.photoLabel} source={{ uri }} />
              ))}
            </Card>
          ) : (
            <>
              <Notice>{m.returnGuide}</Notice>
              {checklist}
              <Controller
                name="notes"
                control={flow.report.control}
                render={({ field, fieldState }) => (
                  <Field
                    ref={field.ref}
                    label={m.notes}
                    multiline
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              {flow.report.watch("photos").map((uri) => (
                <View key={uri}>
                  <MobilePhoto label={m.photoLabel} source={{ uri }} />
                  <Button
                    label={m.remove}
                    secondary
                    onPress={() =>
                      flow.report.setValue(
                        "photos",
                        flow.report.getValues("photos").filter((photo) => photo !== uri),
                      )
                    }
                  />
                </View>
              ))}
              <Button
                label={m.capture}
                secondary
                disabled={flow.report.watch("photos").length >= 8}
                onPress={() => flow.setCamera("photo")}
              />
              <Button
                label={m.send}
                disabled={pending || flow.checklist.length !== HANDOVER_CHECKLIST_ITEMS.length}
                hint={
                  flow.checklist.length !== HANDOVER_CHECKLIST_ITEMS.length
                    ? dm.inspection
                    : undefined
                }
                onPress={() => void flow.send()}
              />
            </>
          )}
        </>
      ) : null}
      {route.screen === "M-FS04" ? (
        <>
          <Heading>{m.lookup}</Heading>
          <Field
            label={m.code}
            value={flow.code}
            onChangeText={flow.setCode}
            autoCapitalize="characters"
          />
          <Button
            label={m.search}
            disabled={pending || !flow.code.trim()}
            onPress={() => void flow.lookup()}
          />
          <Button label={m.scan} secondary onPress={() => flow.setCamera("scan")} />
          {summary}
          {b ? (
            <Button
              label={m.verify}
              disabled={pending || !flow.canVerify}
              hint={!flow.canVerify ? dm.notReady : undefined}
              onPress={() => void flow.verify()}
            />
          ) : null}
        </>
      ) : null}
      {route.screen === "M-FS05" ? (
        <>
          <Heading>{m.inspect}</Heading>
          {summary}
          {!inspection ? (
            <Notice error>{dm.inspection}</Notice>
          ) : inspection.status !== "DRAFT" ? (
            <>
              <Notice>{m.locked}</Notice>
              <Button label={m.continue} onPress={() => go("M-FS07", inspection.bookingId)} />
            </>
          ) : (
            <>
              {checklist}
              <Controller
                name="notes"
                control={flow.form.control}
                render={({ field, fieldState }) => (
                  <Field
                    ref={field.ref}
                    label={m.notes}
                    multiline
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Card title={m.photo}>
                {flow.form.watch("photos").map((photo) => (
                  <View key={photo.id}>
                    <MobilePhoto label={m.photoLabel} source={{ uri: photo.uri }} />
                    <Button
                      label={m.remove}
                      secondary
                      onPress={() =>
                        flow.form.setValue(
                          "photos",
                          flow.form.getValues("photos").filter((p) => p.id !== photo.id),
                        )
                      }
                    />
                  </View>
                ))}
                <Button
                  label={m.capture}
                  secondary
                  disabled={flow.form.watch("photos").length >= 8}
                  onPress={() => flow.setCamera("photo")}
                />
              </Card>
              <Button label={m.save} disabled={pending} onPress={() => void flow.save()} />
            </>
          )}
        </>
      ) : null}
      {route.screen === "M-FS06" ? (
        <>
          <Heading>{m.review}</Heading>
          {summary}
          {inspection ? (
            <>
              <Card title={m.checklist}>
                {HANDOVER_CHECKLIST_ITEMS.map((item) => (
                  <Row
                    key={item.code}
                    label={item.label}
                    value={
                      inspection.checklist.find((r) => r.itemCode === item.code)?.result === "PASS"
                        ? m.pass
                        : m.fail
                    }
                  />
                ))}
                <Text className="leading-6 text-[#52635A]">{inspection.notes}</Text>
                {inspection.photos.map((photo) => (
                  <MobilePhoto key={photo.id} label={m.photoLabel} source={{ uri: photo.uri }} />
                ))}
              </Card>
              <Notice>{m.notActive}</Notice>
              <Button
                label={m.lock}
                disabled={
                  pending ||
                  inspection.status !== "DRAFT" ||
                  inspection.checklist.length !== HANDOVER_CHECKLIST_ITEMS.length ||
                  inspection.checklist.some((i) => i.result !== "PASS")
                }
                hint={m.completeChecklist}
                onPress={() => void flow.lock()}
              />
              <Button
                label={m.edit}
                secondary
                disabled={inspection.status !== "DRAFT"}
                onPress={() => go("M-FS05", inspection.bookingId)}
              />
            </>
          ) : (
            <Notice error>{dm.inspection}</Notice>
          )}
        </>
      ) : null}
      {route.screen === "M-FS07" ? (
        <>
          <Heading>{m.handover}</Heading>
          {summary}
          {inspection?.status === "HANDED_OVER" ? (
            <>
              <Notice>{m.done}</Notice>
              <Button label={m.tasks} onPress={() => go("M-FS01")} />
            </>
          ) : (
            <>
              <Notice>{dm.inspection}</Notice>
              <Pressable
                accessibilityRole="checkbox"
                aria-checked={flow.confirmed}
                accessibilityLabel={m.confirmed}
                accessibilityState={{ checked: flow.confirmed }}
                onPress={() => flow.setConfirmed((v) => !v)}
                className="mb-4 min-h-12 flex-row items-center gap-3 rounded-[4px] border border-[#BFCAC4] bg-white p-4"
              >
                <Text className="text-xl text-[#125345]">{flow.confirmed ? "☑" : "☐"}</Text>
                <Text className="flex-1 leading-6 text-[#131B2E]">{m.confirmed}</Text>
              </Pressable>
              <Button
                label={m.activate}
                disabled={pending || !flow.confirmed || inspection?.status !== "COMPLETED"}
                hint={m.confirmedHint}
                onPress={() => void flow.handover()}
              />
            </>
          )}
        </>
      ) : null}
      <StaffCamera
        mode={flow.camera}
        onResult={(value) => void flow.onCamera(value)}
        onClose={() => flow.setCamera(null)}
      />
    </View>
  );
}
