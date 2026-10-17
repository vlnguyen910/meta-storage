import { z } from "zod";
import { HANDOVER_CHECKLIST_MESSAGES as messages } from "./handover-checklist.messages";

export const HandoverChecklistItemDefinitionSchema = z
  .strictObject({
    code: z.string().trim().min(1),
    label: z.string().trim().min(1),
    resultType: z.enum(["PASS_FAIL", "TEXT", "NUMBER"]),
    required: z.boolean(),
    mustPass: z.boolean(),
    noteRequiredWhenFailed: z.boolean(),
    photoRequired: z.boolean(),
  })
  .superRefine((item, ctx) => {
    if (item.mustPass && (!item.required || item.resultType !== "PASS_FAIL")) {
      ctx.addIssue({ code: "custom", path: ["mustPass"], message: messages.invalidPassRule });
    }
    if (item.noteRequiredWhenFailed && item.resultType !== "PASS_FAIL") {
      ctx.addIssue({
        code: "custom",
        path: ["noteRequiredWhenFailed"],
        message: messages.invalidFailureNoteRule,
      });
    }
  });

export const HandoverChecklistDefinitionSchema = z
  .array(HandoverChecklistItemDefinitionSchema)
  .min(1, messages.emptyDefinition)
  .superRefine((items, ctx) => {
    const codes = new Set<string>();
    items.forEach((item, index) => {
      if (codes.has(item.code)) {
        ctx.addIssue({ code: "custom", path: [index, "code"], message: messages.duplicateCode });
      }
      codes.add(item.code);
    });
  });

const resultDetails = {
  itemCode: z.string().trim().min(1),
  note: z.string().trim().nullable(),
  photos: z.array(z.string().trim().min(1)),
};

export const HandoverChecklistItemResultSchema = z.discriminatedUnion("resultType", [
  z.strictObject({
    ...resultDetails,
    resultType: z.literal("PASS_FAIL"),
    result: z.enum(["PASS", "FAIL"]),
  }),
  z.strictObject({
    ...resultDetails,
    resultType: z.literal("TEXT"),
    result: z.string().trim().min(1),
  }),
  z.strictObject({
    ...resultDetails,
    resultType: z.literal("NUMBER"),
    result: z.number().finite(),
  }),
]);

export type HandoverChecklistItemDefinition = z.infer<typeof HandoverChecklistItemDefinitionSchema>;
export type HandoverChecklistItemResult = z.infer<typeof HandoverChecklistItemResultSchema>;

export const HANDOVER_CHECKLIST_VERSION = "H6_V1";

/** H6 item list confirmed by the task owner on 2026-10-02. */
export const HANDOVER_CHECKLIST_ITEMS: readonly HandoverChecklistItemDefinition[] = Object.freeze(
  [
    { code: "ASSIGNED_UNIT", label: messages.assignedUnit },
    { code: "DOOR_LOCK", label: messages.doorLock },
    { code: "UNIT_CONDITION", label: messages.unitCondition },
    { code: "EXISTING_INVENTORY", label: messages.existingInventory },
  ].map((item) =>
    Object.freeze({
      ...item,
      resultType: "PASS_FAIL" as const,
      required: true,
      mustPass: true,
      noteRequiredWhenFailed: false,
      photoRequired: false,
    }),
  ),
);

/** Validate completion against the same definition used to render the checklist. */
export function createHandoverChecklistCompletionSchema(
  definitions: readonly HandoverChecklistItemDefinition[],
) {
  const items = HandoverChecklistDefinitionSchema.parse(definitions);
  const byCode = new Map(items.map((item) => [item.code, item]));

  return z.array(HandoverChecklistItemResultSchema).superRefine((results, ctx) => {
    const seen = new Set<string>();
    results.forEach((entry, index) => {
      const item = byCode.get(entry.itemCode);
      if (seen.has(entry.itemCode)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "itemCode"],
          message: messages.duplicateResult,
        });
      }
      seen.add(entry.itemCode);
      if (!item) {
        ctx.addIssue({ code: "custom", path: [index, "itemCode"], message: messages.unknownItem });
        return;
      }
      if (entry.resultType !== item.resultType) {
        ctx.addIssue({
          code: "custom",
          path: [index, "resultType"],
          message: messages.wrongResultType,
        });
        return;
      }
      if (item.mustPass && entry.result !== "PASS") {
        ctx.addIssue({ code: "custom", path: [index, "result"], message: messages.mustPass });
      }
      if (item.noteRequiredWhenFailed && entry.result === "FAIL" && !entry.note) {
        ctx.addIssue({
          code: "custom",
          path: [index, "note"],
          message: messages.missingFailureNote,
        });
      }
      if (item.photoRequired && entry.photos.length === 0) {
        ctx.addIssue({ code: "custom", path: [index, "photos"], message: messages.missingPhoto });
      }
    });
    for (const item of items) {
      if (item.required && !seen.has(item.code)) {
        ctx.addIssue({
          code: "custom",
          path: [],
          message: `${messages.missingItem}: ${item.code}`,
        });
      }
    }
  });
}

export const HandoverChecklistCompletionSchema =
  createHandoverChecklistCompletionSchema(HANDOVER_CHECKLIST_ITEMS);
