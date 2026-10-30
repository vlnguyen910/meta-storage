import {
  type AppointmentRecordDto,
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  type HandoverChecklistItemResult,
  HandoverChecklistItemResultSchema,
  INSPECTION_PHOTO_MAX_COUNT,
  type InspectionRecord,
  type UpdateInspectionInput,
} from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MobilePhoto } from "../../components/ui/mobile-photo";
import { Button, Card, dateTime, Field, Heading, Notice, Row } from "../../components/ui/mobile-ui";
import { StatusPill } from "../../components/ui/workspace-ui";
import { STAFF_API_UI as M } from "./staff-api.messages";
import { staffError, useStaffCheckIn } from "./use-staff-workspace";

export function StaffCheckInView({
  owner,
  appointment,
}: {
  owner: string;
  appointment: AppointmentRecordDto;
}) {
  const flow = useStaffCheckIn(owner, appointment.id);
  const [received, setReceived] = useState(false);
  const done = flow.appointment.data?.status === "COMPLETED";
  const verified = flow.task?.status === "IN_PROGRESS" || Boolean(flow.record);
  const reasons = flow.appointment.data?.assignedUnit ? [] : ["UNIT_NOT_ASSIGNED"];
  const canProceed = flow.appointment.data?.status === "CONFIRMED" && reasons.length === 0;
  return (
    <>
      <Heading>{`${appointment.assignedUnit?.physicalUnitCode ?? M.bookings} · ${formatReference(appointment.reservationId ?? appointment.id, appointment.reservationId ? "BK" : "LH")}`}</Heading>
      <Card>
        <Row label={M.customer} value={appointment.customerName ?? M.customer} />
        <Row label={M.phone} value={appointment.contactPhone ?? ""} />
        <Row
          label={M.unit}
          value={
            flow.appointment.data?.assignedUnit?.physicalUnitCode ??
            appointment.assignedUnit?.physicalUnitCode ??
            M.noUnit
          }
        />
        <Row
          label={M.time}
          value={dateTime(
            `${appointment.scheduledDate}T${appointment.slotStart ?? "00:00:00"}+07:00`,
          )}
        />
        {done ? (
          <Notice>{M.handedOver}</Notice>
        ) : (
          <StatusPill label={M.status[appointment.status] ?? appointment.status} tone="blue" />
        )}
      </Card>
      {(flow.appointment.isPending || (verified && flow.history.isPending)) && (
        <ActivityIndicator color="#065f46" accessibilityLabel={M.loading} />
      )}
      {flow.error && (
        <>
          <Notice error>{staffError(flow.error)}</Notice>
          <Button
            secondary
            label={M.retry}
            onPress={() => {
              void flow.appointment.refetch();
              if (verified) void flow.history.refetch();
            }}
          />
        </>
      )}
      {!done && flow.appointment.isSuccess && (
        <>
          {!verified && (
            <Card title={M.verify}>
              <Text className="mb-4 leading-6 text-slate-500">{M.lookupRequired}</Text>
              {reasons.length > 0 && (
                <Notice>{reasons.map((reason) => M.reasons[reason] ?? reason).join(" ")}</Notice>
              )}
              <Button
                label={M.verify}
                disabled={!canProceed || !flow.tasks.data || flow.busy}
                onPress={() => flow.begin.mutate()}
              />
            </Card>
          )}
          {verified && flow.history.isSuccess && !flow.record && (
            <Button
              label={M.inspect}
              disabled={flow.busy}
              onPress={() =>
                flow.start.mutate(flow.appointment.data?.assignedUnit?.physicalUnitId ?? "")
              }
            />
          )}
          {flow.record && (
            <InspectionEditor
              key={`${flow.record.id}:${flow.record.status}`}
              record={flow.record}
              busy={flow.busy}
              onPhoto={(camera) => flow.photo.mutate(camera)}
              onRemovePhoto={(id) => flow.removePhoto.mutate(id)}
              onSave={(input) => flow.save.mutate(input)}
            />
          )}
          {flow.record?.status === "PASSED" && (
            <Card>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: received, disabled: flow.busy }}
                disabled={flow.busy}
                onPress={() => setReceived((value) => !value)}
                className="mb-5 min-h-12 flex-row items-center gap-3"
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-md border ${received ? "border-emerald-800 bg-emerald-800" : "border-slate-300 bg-white"}`}
                >
                  <Text className="font-bold text-white">{received ? "✓" : ""}</Text>
                </View>
                <Text className="flex-1 text-sm leading-6 text-slate-700">{M.received}</Text>
              </Pressable>
              <Button
                label={M.handover}
                disabled={!received || flow.busy}
                onPress={() => flow.handover.mutate()}
              />
            </Card>
          )}
        </>
      )}
    </>
  );
}
function InspectionEditor({
  record,
  busy,
  onSave,
  onPhoto,
  onRemovePhoto,
}: {
  record: InspectionRecord;
  busy: boolean;
  onSave: (input: UpdateInspectionInput) => void;
  onPhoto: (camera: boolean) => void;
  onRemovePhoto: (id: string) => void;
}) {
  const [results, setResults] = useState<HandoverChecklistItemResult[]>(() =>
    Array.isArray(record.checklist.results)
      ? record.checklist.results.flatMap((item) => {
          const parsed = HandoverChecklistItemResultSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
      : [],
  );
  const [notes, setNotes] = useState(record.notes ?? "");
  const [condition, setCondition] = useState<"GOOD" | "MINOR_DAMAGE" | "MAJOR_DAMAGE">(
    record.condition ?? "GOOD",
  );
  const locked = record.status === "PASSED" || record.status === "FAILED";
  const canPass =
    HandoverChecklistCompletionSchema.safeParse(results).success && condition !== "MAJOR_DAMAGE";
  const input = (status: "IN_PROGRESS" | "PASSED"): UpdateInspectionInput => ({
    status,
    condition,
    notes,
    checklist: { ...record.checklist, results },
  });
  return (
    <Card title={M.checklist}>
      {HANDOVER_CHECKLIST_ITEMS.map((item) => (
        <View key={item.code} className="mb-5 rounded-xl bg-slate-50 p-3">
          <Text className="mb-3 font-semibold leading-6 text-slate-800">{item.label}</Text>
          <View className="flex-row gap-2">
            {(["PASS", "FAIL"] as const).map((result) => {
              const selected =
                results.find((entry) => entry.itemCode === item.code)?.result === result;
              return (
                <Pressable
                  key={result}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.label}: ${result === "PASS" ? M.pass : M.fail}`}
                  accessibilityState={{ checked: selected, disabled: locked || busy }}
                  disabled={locked || busy}
                  onPress={() =>
                    setResults((previous) => [
                      ...previous.filter((entry) => entry.itemCode !== item.code),
                      {
                        itemCode: item.code,
                        resultType: "PASS_FAIL",
                        result,
                        note: previous.find((entry) => entry.itemCode === item.code)?.note ?? null,
                        photos:
                          previous.find((entry) => entry.itemCode === item.code)?.photos ?? [],
                      },
                    ])
                  }
                  className={`min-h-11 flex-1 items-center justify-center rounded-lg border ${selected ? (result === "PASS" ? "border-emerald-700 bg-emerald-50" : "border-rose-600 bg-rose-50") : "border-slate-200 bg-white"}`}
                >
                  <Text
                    className={`font-semibold ${selected ? (result === "PASS" ? "text-emerald-800" : "text-rose-700") : "text-slate-500"}`}
                  >
                    {result === "PASS" ? M.pass : M.fail}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Text className="mb-2 font-semibold text-slate-900">{M.condition}</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {(["GOOD", "MINOR_DAMAGE", "MAJOR_DAMAGE"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: condition === value, disabled: locked || busy }}
            disabled={locked || busy}
            onPress={() => setCondition(value)}
            className={`min-h-11 justify-center rounded-lg border px-3 ${condition === value ? "border-emerald-700 bg-emerald-50" : "border-slate-200"}`}
          >
            <Text className="text-sm text-slate-700">
              {value === "GOOD" ? M.good : value === "MINOR_DAMAGE" ? M.minor : M.major}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label={M.notes}
        multiline
        maxLength={4000}
        editable={!locked && !busy}
        value={notes}
        onChangeText={setNotes}
      />
      {record.evidence.map((photo) => (
        <View key={photo.id}>
          <MobilePhoto label={M.photos} source={{ uri: photo.url }} />
          {!locked && (
            <Button
              danger
              label={M.removePhoto}
              disabled={busy}
              onPress={() => onRemovePhoto(photo.id)}
            />
          )}
        </View>
      ))}
      {!locked && (
        <>
          <Button
            secondary
            label={M.addPhoto}
            disabled={busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
            onPress={() => onPhoto(false)}
          />
          <Button
            secondary
            label={M.takePhoto}
            disabled={busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
            onPress={() => onPhoto(true)}
          />
        </>
      )}
      {!locked && (
        <>
          <Button
            label={M.saveDraft}
            secondary
            disabled={busy}
            onPress={() => onSave(input("IN_PROGRESS"))}
          />
          <Button
            label={M.savePassed}
            disabled={busy || !canPass}
            onPress={() => onSave(input("PASSED"))}
          />
        </>
      )}
    </Card>
  );
}
