import { expect, it, vi } from "vitest";
import { readFileBase64 } from "./read-file-base64";

it("reads only the base64 payload", async () => {
  expect(await readFileBase64(new File(["hello"], "test.txt"))).toBe("aGVsbG8=");
});
it("rejects failed file reads", async () => {
  const spy = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (
    this: FileReader,
  ) {
    this.dispatchEvent(new ProgressEvent("error"));
  });
  try {
    await expect(readFileBase64(new File([], "test.txt"))).rejects.toThrow("file-read");
  } finally {
    spy.mockRestore();
  }
});
