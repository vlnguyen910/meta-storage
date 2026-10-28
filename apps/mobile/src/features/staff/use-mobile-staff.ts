import { zodResolver } from "@hookform/resolvers/zod";
import {
  type HandoverChecklistItemResult,
  type MobileInspectionInput,
  MobileInspectionInputSchema,
  type MobileReturnReportInput,
  MobileReturnReportInputSchema,
} from "@metastorage/contracts";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { MobileScreenProps } from "../../screens/mobile-screen.types";
import { DEMO_MESSAGES as m } from "../demo/demo.messages";
import { mobileApi, mobileWorkflows } from "../demo/demo-client";
import { canVerifyBooking } from "../demo/demo-policy";
import { newDemoId } from "../demo/demo-seed";

export function useMobileStaff({ route, data, run, go }: MobileScreenProps) {
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [camera, setCamera] = useState<"scan" | "photo" | null>(null);
  const booking = data.bookings.find((b) => b.id === route.id);
  const inspection = data.inspections.find((i) => i.bookingId === route.id);
  const request = data.requests.find((r) => r.id === route.id);
  const form = useForm<MobileInspectionInput>({
    resolver: zodResolver(MobileInspectionInputSchema),
    defaultValues: {
      version: inspection?.version ?? 0,
      notes: inspection?.notes ?? "",
      checklist: inspection?.checklist ?? [],
      photos: inspection?.photos ?? [],
    },
  });
  const report = useForm<MobileReturnReportInput>({
    resolver: zodResolver(MobileReturnReportInputSchema),
    defaultValues: {
      notes: request?.report?.notes ?? "",
      checklist: request?.report?.checklist ?? [],
      photos: request?.report?.photos ?? [],
    },
  });
  const inspectionSnapshot = inspection ? JSON.stringify(inspection) : null;
  useEffect(() => {
    if (inspectionSnapshot) {
      const saved = JSON.parse(inspectionSnapshot) as MobileInspectionInput;
      form.reset({
        version: saved.version,
        notes: saved.notes,
        checklist: saved.checklist,
        photos: saved.photos,
      });
    }
  }, [inspectionSnapshot, form.reset]);
  const checklist = route.screen === "M-FS03" ? report.watch("checklist") : form.watch("checklist");
  const choose = (itemCode: string, result: "PASS" | "FAIL") => {
    const next: HandoverChecklistItemResult[] = [
      ...checklist.filter((i) => i.itemCode !== itemCode),
      { itemCode, resultType: "PASS_FAIL", result, note: null, photos: [] },
    ];
    if (route.screen === "M-FS03") report.setValue("checklist", next);
    else form.setValue("checklist", next);
  };
  const lookup = (value = code) =>
    run(
      () =>
        mobileApi.bookings.checkInLookup({
          type: value.startsWith("demo-qr-") ? "QR_TOKEN" : "BOOKING_CODE",
          value: value.trim(),
        }),
      (result) => go("M-FS04", result.booking.id),
    );
  return {
    code,
    setCode,
    confirmed,
    setConfirmed,
    camera,
    setCamera,
    booking,
    inspection,
    request,
    form,
    report,
    checklist,
    choose,
    canVerify: !!booking && canVerifyBooking(booking),
    lookup,
    verify: () =>
      booking
        ? run(
            async () => {
              return mobileWorkflows.startInspection(booking.id);
            },
            () => go("M-FS05", booking.id),
          )
        : undefined,
    save: form.handleSubmit((values) =>
      inspection
        ? run(
            () => mobileWorkflows.saveInspection(inspection.id, values),
            () => go("M-FS06", inspection.bookingId),
          )
        : undefined,
    ),
    lock: () =>
      inspection
        ? run(
            () => mobileWorkflows.completeInspection(inspection.id, inspection.version),
            () => go("M-FS07", inspection.bookingId),
          )
        : undefined,
    handover: () =>
      inspection
        ? run(
            () => mobileWorkflows.handover(inspection.id, inspection.version, confirmed),
            () => go("M-FS07", inspection.bookingId),
          )
        : undefined,
    send: report.handleSubmit((values) =>
      request
        ? run(
            () => mobileWorkflows.returnReport(request.id, values),
            () => go("M-FS02"),
            m.report,
          )
        : undefined,
    ),
    onCamera: (value: string) => {
      setCamera(null);
      if (camera === "scan") return lookup(value);
      if (route.screen === "M-FS03")
        report.setValue("photos", [...report.getValues("photos"), value].slice(0, 8));
      else
        form.setValue(
          "photos",
          [...form.getValues("photos"), { id: newDemoId(), uri: value }].slice(0, 8),
        );
    },
  };
}
