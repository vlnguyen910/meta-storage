// Inspect bounded container structures as well as MIME signatures. Files are always
// served as nosniff image bytes, never as HTML/SVG or provider URLs.
function pngStructure(b: Buffer) {
  if (b.length < 57 || !b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return false;
  let position = 8,
    data = false;
  while (position + 12 <= b.length) {
    const size = b.readUInt32BE(position),
      kind = b.toString("ascii", position + 4, position + 8);
    if (position + size + 12 > b.length) return false;
    if (
      position === 8 &&
      (kind !== "IHDR" || size !== 13 || !b.readUInt32BE(16) || !b.readUInt32BE(20))
    )
      return false;
    if (kind === "IDAT" && size > 0) data = true;
    position += size + 12;
    if (kind === "IEND") return data && size === 0 && position === b.length;
  }
  return false;
}
function jpegStructure(b: Buffer) {
  if (
    b.length < 16 ||
    b[0] !== 255 ||
    b[1] !== 216 ||
    b[b.length - 2] !== 255 ||
    b[b.length - 1] !== 217
  )
    return false;
  let position = 2,
    frame = false;
  while (position + 4 <= b.length) {
    if (b[position++] !== 255) return false;
    while (b[position] === 255) position++;
    const marker = b[position++];
    if (marker === undefined || position + 2 > b.length) return false;
    const size = b.readUInt16BE(position);
    if (size < 2 || position + size > b.length) return false;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      if (size < 8 || !b.readUInt16BE(position + 3) || !b.readUInt16BE(position + 5)) return false;
      frame = true;
    }
    if (marker === 218) return frame && size >= 6 && position + size < b.length - 2;
    position += size;
  }
  return false;
}
function webpStructure(b: Buffer) {
  if (
    b.length < 26 ||
    b.toString("ascii", 0, 4) !== "RIFF" ||
    b.toString("ascii", 8, 12) !== "WEBP" ||
    b.readUInt32LE(4) + 8 !== b.length
  )
    return false;
  let position = 12,
    data = false;
  while (position + 8 <= b.length) {
    const kind = b.toString("ascii", position, position + 4),
      size = b.readUInt32LE(position + 4);
    if (position + size + 8 > b.length) return false;
    if (kind === "VP8 ") {
      if (size < 10 || !b.subarray(position + 11, position + 14).equals(Buffer.from([157, 1, 42])))
        return false;
      data = true;
    }
    if (kind === "VP8L") {
      if (size < 5 || b[position + 8] !== 47) return false;
      data = true;
    }
    // Animated frames are themselves encoded frame data within the WebP container.
    if (kind === "ANMF" && size >= 24) data = true;
    position += 8 + size + (size % 2);
  }
  return data && position === b.length;
}
export function isSupportImage(bytes: Buffer, mime: string) {
  if (mime === "image/png") return pngStructure(bytes);
  if (mime === "image/jpeg") return jpegStructure(bytes);
  if (mime === "image/webp") return webpStructure(bytes);
  return false;
}
