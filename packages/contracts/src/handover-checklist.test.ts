import { describe, expect, it } from "vitest";
import {
  createHandoverChecklistCompletionSchema,
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  type HandoverChecklistItemDefinition,
  type HandoverChecklistItemResult,
} from "./handover-checklist";

// Synthetic definitions exercise contract rules without deciding the H6 business item list.
const passItem: HandoverChecklistItemDefinition = {
  code: "REQUIRED_CHECK",
  label: "Required check",
  resultType: "PASS_FAIL",
  required: true,
  mustPass: true,
  noteRequiredWhenFailed: true,
  photoRequired: false,
};
const observation: HandoverChecklistItemDefinition = {
  ...passItem,
  code: "OBSERVATION",
  label: "Observation",
  mustPass: false,
  photoRequired: true,
};
const passed = {
  itemCode: passItem.code,
  resultType: "PASS_FAIL",
  result: "PASS",
  note: null,
  photos: [],
};

describe("confirmed H6 checklist", () => {
  const complete = (): HandoverChecklistItemResult[] =>
    HANDOVER_CHECKLIST_ITEMS.map((item) => ({
      itemCode: item.code,
      resultType: "PASS_FAIL",
      result: "PASS",
      note: null,
      photos: [],
    }));

  it("requires the four agreed inspections and no cleanliness check", () => {
    expect(HANDOVER_CHECKLIST_ITEMS.map((item) => item.code)).toEqual([
      "ASSIGNED_UNIT",
      "DOOR_LOCK",
      "UNIT_CONDITION",
      "EXISTING_INVENTORY",
    ]);
    expect(HandoverChecklistCompletionSchema.safeParse(complete()).success).toBe(true);
  });

  it.each([0, 1, 2, 3])("blocks completion when item %i is missing or failed", (index) => {
    const results = complete();
    expect(
      HandoverChecklistCompletionSchema.safeParse(results.filter((_, i) => i !== index)).success,
    ).toBe(false);
    const failed = results.map((entry, i) => (i === index ? { ...entry, result: "FAIL" } : entry));
    expect(HandoverChecklistCompletionSchema.safeParse(failed).success).toBe(false);
  });

  it("accepts optional evidence without requiring photos", () => {
    const results = complete().map((entry, index) =>
      index === 0 ? { ...entry, photos: ["photo-id"] } : entry,
    );
    expect(HandoverChecklistCompletionSchema.safeParse(results).success).toBe(true);
  });
});

describe("handover checklist completion contract", () => {
  const schema = createHandoverChecklistCompletionSchema([passItem]);

  it("accepts required passing results", () => {
    expect(schema.safeParse([passed]).success).toBe(true);
  });

  it("rejects missing, failed, duplicate and unknown results", () => {
    for (const results of [
      [],
      [{ ...passed, result: "FAIL", note: "Broken" }],
      [passed, passed],
      [passed, { ...passed, itemCode: "UNKNOWN" }],
    ]) {
      expect(schema.safeParse(results).success).toBe(false);
    }
  });

  it("requires a note and photo for a recorded failure without requiring it to pass", () => {
    const recordingSchema = createHandoverChecklistCompletionSchema([observation]);
    const failure = {
      ...passed,
      itemCode: observation.code,
      result: "FAIL",
      note: "Existing damage",
      photos: ["photo-id"],
    };
    expect(recordingSchema.safeParse([failure]).success).toBe(true);
    expect(recordingSchema.safeParse([{ ...failure, note: "  " }]).success).toBe(false);
    expect(recordingSchema.safeParse([{ ...failure, photos: [] }]).success).toBe(false);
  });

  it("checks text and numeric results against their definitions", () => {
    const text = {
      ...passItem,
      resultType: "TEXT" as const,
      mustPass: false,
      noteRequiredWhenFailed: false,
    };
    const textSchema = createHandoverChecklistCompletionSchema([text]);
    expect(
      textSchema.safeParse([{ ...passed, resultType: "TEXT", result: "Baseline" }]).success,
    ).toBe(true);
    expect(textSchema.safeParse([{ ...passed, resultType: "TEXT", result: " " }]).success).toBe(
      false,
    );
    expect(textSchema.safeParse([passed]).success).toBe(false);
    const numberSchema = createHandoverChecklistCompletionSchema([
      { ...text, resultType: "NUMBER" },
    ]);
    expect(numberSchema.safeParse([{ ...passed, resultType: "NUMBER", result: 0 }]).success).toBe(
      true,
    );
    expect(numberSchema.safeParse([{ ...passed, resultType: "NUMBER", result: "0" }]).success).toBe(
      false,
    );
    expect(
      numberSchema.safeParse([{ ...passed, resultType: "NUMBER", result: Infinity }]).success,
    ).toBe(false);
  });

  it("allows omitted optional items but validates supplied results", () => {
    const optionalSchema = createHandoverChecklistCompletionSchema([
      passItem,
      { ...observation, required: false },
    ]);
    expect(optionalSchema.safeParse([passed]).success).toBe(true);
    expect(
      optionalSchema.safeParse([passed, { ...passed, itemCode: observation.code }]).success,
    ).toBe(false);
  });

  it("rejects empty, duplicate and contradictory definitions", () => {
    for (const definitions of [
      [],
      [passItem, passItem],
      [{ ...passItem, required: false }],
      [{ ...passItem, resultType: "TEXT" as const }],
      [{ ...passItem, mustPass: false, resultType: "NUMBER" as const }],
    ]) {
      expect(() => createHandoverChecklistCompletionSchema(definitions)).toThrow();
    }
  });
});
