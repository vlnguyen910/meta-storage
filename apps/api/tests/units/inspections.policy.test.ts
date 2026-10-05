import { describe, expect, test } from "bun:test";
import {
  assertCompletable,
  assertCurrentInspection,
  decodePhoto,
} from "../../src/modules/inspections/inspections.policy";

describe("H6 inspection decision", () => {
  test("existing damage is recordable and does not prevent completion", () => {
    expect(() => assertCompletable(true, "Tường có vết xước trước bàn giao", 1)).not.toThrow();
  });
  test("correct unit, description and photos are all mandatory", () => {
    for (const [correct, notes, count] of [
      [false, "Tốt", 1],
      [null, "Tốt", 1],
      [true, "  ", 1],
      [true, "Tốt", 0],
    ] as const) {
      expect(() => assertCompletable(correct, notes, count)).toThrow();
    }
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
