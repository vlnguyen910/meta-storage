import type { FacilityTaskDetail } from "@metastorage/contracts";
import {
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  type HandoverChecklistItemResult,
  HandoverChecklistItemResultSchema,
  INSPECTION_PHOTO_MAX_COUNT,
  type InspectionRecord,
  type UpdateInspectionInput,
} from "@metastorage/contracts";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MobilePhoto } from "../../components/ui/mobile-photo";
import { Button, Card, Field, Heading, Notice, Row } from "../../components/ui/mobile-ui";
import { StatusPill } from "../../components/ui/workspace-ui";
import { STAFF_API_UI as M } from "../../features/staff-api/staff-api.messages";
import { staffError, useStaffUnitInspection } from "../../features/staff-api/use-staff-workspace";

type Condition = NonNullable<InspectionRecord["condition"]>;
type FeedbackKind = "success" | "error";

export function StaffUnitInspectionView({
  owner,
  task,
  onNotify,
}: {
  owner: string;
  task: FacilityTaskDetail;
  onNotify: (kind: FeedbackKind, message: string) => void;
}) {
  const flow = useStaffUnitInspection(owner, task);
  const record = flow.record;
  const [results, setResults] = useState<HandoverChecklistItemResult[]>([]);
  const [condition, setCondition] = useState<Condition>("GOOD");
  const [notes, setNotes] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const hydratedRecordId = useRef<string | null>(null);

  useEffect(() => {
    if (!record || hydratedRecordId.current === record.id) return;
    hydratedRecordId.current = record.id;
    setResults(
      Array.isArray(record.checklist.results)
        ? record.checklist.results.flatMap((item) => {
            const parsed = HandoverChecklistItemResultSchema.safeParse(item);
            return parsed.success ? [parsed.data] : [];
          })
        : [],
    );
    setCondition(record.condition ?? "GOOD");
    setNotes(record.notes ?? "");
  }, [record]);

  useEffect(() => {
    setPhotoIndex((current) => Math.min(current, Math.max(0, (record?.evidence.length ?? 0) - 1)));
  }, [record?.evidence.length]);

  const checklistComplete = HandoverChecklistCompletionSchema.safeParse(results).success;
  const locked = record?.status === "PASSED" || record?.status === "FAILED";
  const selectedPhoto = record?.evidence[photoIndex];

  function setChecklistResult(code: string, result: "PASS" | "FAIL") {
    setResults((previous) => [
      ...previous.filter((item) => item.itemCode !== code),
      {
        itemCode: code,
        resultType: "PASS_FAIL",
        result,
        note: previous.find((item) => item.itemCode === code)?.note ?? null,
        photos: previous.find((item) => item.itemCode === code)?.photos ?? [],
      },
    ]);
  }

  function submit(status: "IN_PROGRESS" | "PASSED" | "FAILED") {
    if (!record) return;
    const input: UpdateInspectionInput = {
      status,
      condition,
      notes,
      checklist: { ...record.checklist, results },
    };
    flow.save.mutate(input, {
      onSuccess: (updated) => {
        onNotify(
          "success",
          updated.status === "PASSED" || updated.status === "FAILED"
            ? M.unitInspectionCompleted
            : M.inspectionDraftSuccess,
        );
      },
      onError: (error) => onNotify("error", staffError(error)),
    });
  }

  if (task.referenceType !== "STORAGE_UNIT")
    return <Notice error>{M.unitInspectionContextError}</Notice>;

  return (
    <View>
      <View className="mb-4">
        <Heading>{M.unitInspectionTitle}</Heading>
        <Text className="mt-1 font-body text-[12px] leading-5 text-muted">
          {task.description || M.unitInspectionDescription}
        </Text>
      </View>
      <Card title={M.unitInspectionTitle}>
        <View className="mb-3 flex-row flex-wrap gap-2">
          <StatusPill
            label={M.status[task.status] ?? task.status}
            tone={locked ? "green" : "blue"}
          />
          {record ? (
            <StatusPill
              label={M.status[record.status] ?? record.status}
              tone={
                record.status === "FAILED" ? "red" : record.status === "PASSED" ? "green" : "blue"
              }
            />
          ) : null}
        </View>
        <Row label={M.unit} value={record?.unitCode ?? task.referenceId} />
        <Row label={M.manager} value={task.assignerName} />
        <Row label={M.assignedAt} value={task.assignedAt} />
      </Card>

      {flow.error ? <Notice error>{staffError(flow.error)}</Notice> : null}
      {flow.start.isPending || flow.isPending ? (
        <View className="py-4">
          <ActivityIndicator accessibilityLabel={M.loading} color="#165f4d" />
        </View>
      ) : null}

      {!record ? (
        <Card>
          <Text className="mb-4 font-body text-[13px] leading-6 text-muted">
            {M.unitInspectionStartHint}
          </Text>
          <Button
            label={task.status === "IN_PROGRESS" ? M.unitInspectionContinue : M.unitInspectionStart}
            loading={flow.start.isPending}
            disabled={flow.start.isPending || task.status === "CANCELLED"}
            onPress={() =>
              flow.start.mutate(undefined, {
                onSuccess: () => onNotify("success", M.inspectionStartedSuccess),
                onError: (error) => onNotify("error", staffError(error)),
              })
            }
          />
        </Card>
      ) : (
        <>
          <Card title={M.unitInspectionChecklist}>
            {HANDOVER_CHECKLIST_ITEMS.map((item) => {
              const selected = results.find((result) => result.itemCode === item.code);
              return (
                <View key={item.code} className="mb-4 rounded-xl bg-slate-50 p-3">
                  <Text className="mb-3 font-body-semibold text-[13px] leading-5 text-ink">
                    {item.label}
                  </Text>
                  <View className="flex-row gap-2">
                    {(["PASS", "FAIL"] as const).map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityLabel={`${item.label}: ${value === "PASS" ? M.pass : M.fail}`}
                        accessibilityState={{
                          checked: selected?.result === value,
                          disabled: locked || flow.busy,
                        }}
                        disabled={locked || flow.busy}
                        onPress={() => setChecklistResult(item.code, value)}
                        className={`min-h-11 flex-1 items-center justify-center rounded-lg border ${selected?.result === value ? "border-primary bg-primary" : "border-outline-variant bg-surface"}`}
                      >
                        <Text
                          className={`font-semibold ${selected?.result === value ? "text-primary-foreground" : "text-muted"}`}
                        >
                          {value === "PASS" ? M.pass : M.fail}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {selected?.result === "FAIL" ? (
                    <Field
                      label={M.returnChecklistNote}
                      value={selected.note ?? ""}
                      maxLength={1000}
                      editable={!locked && !flow.busy}
                      onChangeText={(note) =>
                        setResults((previous) =>
                          previous.map((entry) =>
                            entry.itemCode === item.code ? { ...entry, note } : entry,
                          ),
                        )
                      }
                    />
                  ) : null}
                </View>
              );
            })}
            <Text className="mb-2 font-body-semibold text-label text-ink">{M.condition}</Text>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {(["GOOD", "MINOR_DAMAGE", "MAJOR_DAMAGE"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: condition === value,
                    disabled: locked || flow.busy,
                  }}
                  disabled={locked || flow.busy}
                  onPress={() => setCondition(value)}
                  className={`min-h-11 justify-center rounded-lg border px-3 ${condition === value ? "border-primary bg-primary-soft" : "border-outline-variant bg-surface"}`}
                >
                  <Text className="font-body-medium text-[12px] text-ink">
                    {value === "GOOD" ? M.good : value === "MINOR_DAMAGE" ? M.minor : M.major}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label={M.notes}
              multiline
              maxLength={4000}
              editable={!locked && !flow.busy}
              value={notes}
              onChangeText={setNotes}
            />
          </Card>

          <Card title={M.photos}>
            <Text className="mb-3 font-body text-[12px] text-muted">
              {record.evidence.length}/{INSPECTION_PHOTO_MAX_COUNT}
            </Text>
            {selectedPhoto ? (
              <View className="mb-3">
                <MobilePhoto
                  label={M.photos}
                  source={{ uri: selectedPhoto.url }}
                  tall
                  previewable
                />
                {record.evidence.length > 1 ? (
                  <View className="my-2 flex-row justify-between">
                    <Button
                      variant="outline"
                      label={M.previousPhoto}
                      disabled={photoIndex === 0 || flow.busy}
                      onPress={() => setPhotoIndex((index) => Math.max(0, index - 1))}
                    />
                    <Button
                      variant="outline"
                      label={M.nextPhoto}
                      disabled={photoIndex >= record.evidence.length - 1 || flow.busy}
                      onPress={() =>
                        setPhotoIndex((index) => Math.min(record.evidence.length - 1, index + 1))
                      }
                    />
                  </View>
                ) : null}
                {!locked ? (
                  <Button
                    danger
                    label={M.removePhoto}
                    disabled={flow.busy}
                    onPress={() =>
                      flow.removePhoto.mutate(selectedPhoto.id, {
                        onSuccess: () => onNotify("success", M.evidenceRemovedSuccess),
                        onError: (error) => onNotify("error", staffError(error)),
                      })
                    }
                  />
                ) : null}
              </View>
            ) : null}
            {!locked ? (
              <>
                <Button
                  secondary
                  label={M.addPhoto}
                  disabled={flow.busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
                  onPress={() =>
                    flow.photo.mutate(false, {
                      onSuccess: (result) => result && onNotify("success", M.evidenceAddedSuccess),
                      onError: (error) => onNotify("error", staffError(error)),
                    })
                  }
                />
                <Button
                  secondary
                  label={M.takePhoto}
                  disabled={flow.busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
                  onPress={() =>
                    flow.photo.mutate(true, {
                      onSuccess: (result) => result && onNotify("success", M.evidenceAddedSuccess),
                      onError: (error) => onNotify("error", staffError(error)),
                    })
                  }
                />
              </>
            ) : null}
          </Card>

          {!locked ? (
            <Card>
              <Button
                variant="outline"
                label={M.saveDraft}
                disabled={flow.busy}
                onPress={() => submit("IN_PROGRESS")}
              />
              <Button
                label={M.unitInspectionPass}
                disabled={flow.busy || !checklistComplete}
                loading={flow.save.isPending}
                onPress={() => submit("PASSED")}
              />
              <Button
                danger
                label={M.unitInspectionFail}
                disabled={flow.busy || !checklistComplete}
                loading={flow.save.isPending}
                onPress={() => submit("FAILED")}
              />
            </Card>
          ) : (
            <Card>
              <Notice>
                {record.status === "FAILED" ? M.unitInspectionFailed : M.unitInspectionPassed}
              </Notice>
            </Card>
          )}
        </>
      )}
    </View>
  );
}
