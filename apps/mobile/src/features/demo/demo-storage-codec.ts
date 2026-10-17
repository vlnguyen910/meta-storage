import { DEMO_MESSAGES as m } from "./demo.messages";

// Bound UTF-8 bytes, not JavaScript character count, and never split a surrogate pair.
export function secureStoreChunks(value: string): string[] {
  const chunks: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    const length = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes + length > 1500) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += character;
    bytes += length;
  }
  if (chunk) chunks.push(chunk);
  if (chunks.length > 5000) throw new Error(m.storage);
  return chunks;
}
