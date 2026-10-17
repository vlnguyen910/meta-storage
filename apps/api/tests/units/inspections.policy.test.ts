import { describe, expect, test } from "bun:test";
import { HANDOVER_CHECKLIST_ITEMS } from "@metastorage/contracts";
import {
  assertCompletable,
  assertCurrentInspection,
  decodePhoto,
} from "../../src/modules/inspections/inspections.policy";

describe("H6 inspection decision", () => {
  const passing = HANDOVER_CHECKLIST_ITEMS.map((item) => ({
    itemCode: item.code,
    resultType: "PASS_FAIL" as const,
    result: "PASS" as const,
    note: null,
    photos: [],
  }));
  test("four PASS results complete without notes or photos", () => {
    expect(() => assertCompletable(passing)).not.toThrow();
  });
  test("missing, failed, duplicate and unknown results cannot complete", () => {
    for (const results of [
      [],
      passing.slice(1),
      passing.map((r, i) => (i === 1 ? { ...r, result: "FAIL" as const } : r)),
      [...passing, passing[0]],
      [...passing, { ...passing[0], itemCode: "UNKNOWN" }],
    ])
      expect(() => assertCompletable(results)).toThrow();
  });
  test("a verification tied to a previous assignment cannot be reused", () => {
    expect(() =>
      assertCurrentInspection({
        bookingStatus: "CONFIRMED",
        verificationStatus: "VERIFIED",
        assignmentStatus: "ACTIVE",
        verifiedAssignmentId: "old",
        assignmentId: "new",
      }),
    ).toThrow();
  });
  test("unverified and no-show bookings cannot start inspection", () => {
    for (const [bookingStatus, verificationStatus] of [
      ["NO_SHOW", "VERIFIED"],
      ["CONFIRMED", "INVALIDATED"],
    ] as const) {
      expect(() =>
        assertCurrentInspection({
          bookingStatus,
          verificationStatus,
          assignmentStatus: "ACTIVE",
          verifiedAssignmentId: "a",
          assignmentId: "a",
        }),
      ).toThrow();
    }
  });
  test("reject arbitrary data disguised as an image", () => {
    expect(() =>
      decodePhoto("image/png", Buffer.from("not an image").toString("base64")),
    ).toThrow();
    expect(() => decodePhoto("image/jpeg", "!")).toThrow();
  });
});
