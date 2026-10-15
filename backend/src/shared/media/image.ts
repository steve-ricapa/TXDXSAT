/**
 * Image validation and metadata sniffing.
 *
 * The declared MIME type (from the multipart part) is never trusted on its own:
 * the real format is detected from the file signature ("magic bytes"), which is
 * what defeats a `.png` file that is actually executable content.
 */

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export interface ImageInfo {
  mime: ImageMime;
  width: number | null;
  height: number | null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(buffer: Buffer, signature: Buffer, offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  return buffer.subarray(offset, offset + signature.length).equals(signature);
}

/** Detect the image format from the byte signature, or null when unknown. */
export function sniffImageMime(buffer: Buffer): ImageMime | null {
  if (startsWith(buffer, PNG_SIGNATURE)) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionFor(mime: ImageMime): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}

/** Best-effort intrinsic size. Returns null dimensions when unknown. */
export function readImageSize(buffer: Buffer): { width: number | null; height: number | null } {
  const mime = sniffImageMime(buffer);
  if (mime === "image/png") return readPngSize(buffer);
  if (mime === "image/jpeg") return readJpegSize(buffer);
  if (mime === "image/webp") return readWebpSize(buffer);
  return { width: null, height: null };
}

export function inspectImage(buffer: Buffer): ImageInfo | null {
  const mime = sniffImageMime(buffer);
  if (!mime) return null;
  const { width, height } = readImageSize(buffer);
  return { mime, width, height };
}

function readPngSize(buffer: Buffer) {
  if (buffer.length < 24) return { width: null, height: null };
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegSize(buffer: Buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1] ?? 0;
    // SOF0..SOF15 (excluding DHT=0xC4, JPG=0xC8, DAC=0xCC) carry the dimensions.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) break;
    offset += 2 + segmentLength;
  }
  return { width: null, height: null };
}

function readWebpSize(buffer: Buffer) {
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X" && buffer.length >= 30) {
    const width = 1 + (buffer.readUIntLE(24, 3) & 0xffffff);
    const height = 1 + (buffer.readUIntLE(27, 3) & 0xffffff);
    return { width, height };
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    // Lossy: 14-bit dimensions live at offset 26 (after the start code).
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return { width: null, height: null };
}
