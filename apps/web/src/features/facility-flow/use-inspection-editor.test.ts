import { HANDOVER_CHECKLIST_ITEMS } from "@metastorage/contracts";
import { describe, expect, it } from "vitest";
import { readResults } from "./use-check-in-flow";

describe("readResults", () => {
  it("keeps valid checklist results and ignores malformed entries", () => {
    const [item] = HANDOVER_CHECKLIST_ITEMS;
    if (!item) throw new Error("Expected a handover checklist item");
    expect(
      readResults({
        results: [
          {
            itemCode: item.code,
            resultType: "PASS_FAIL",
            result: "PASS",
            note: null,
            photos: [],
          },
          { itemCode: item.code, result: "MAYBE" },
        ],
      }),
    ).toHaveLength(1);
  });
});
