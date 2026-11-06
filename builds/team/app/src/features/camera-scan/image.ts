// Validation of the image data URL sent to POST /api/identify (CONTRACTS section 4, G2).
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';
export interface ImageInput { mediaType: MediaType; base64: string; bytes: number }

export class ImageError extends Error {}

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/i;

function startsWith(buf: Buffer, bytes: number[]): boolean {
  return buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);
}

// Leading bytes must match the declared type, so a renamed file or a GIF cannot pass.
export function matchesType(buf: Buffer, type: MediaType): boolean {
  if (type === 'image/jpeg') return startsWith(buf, [0xff, 0xd8, 0xff]);
  if (type === 'image/png') return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP';
}

export function parseImageDataUrl(value: string): ImageInput {
  const m = DATA_URL.exec(value);
  if (!m) throw new ImageError('Image must be a base64 data URL of type JPEG, PNG or WebP');
  const declared = m[1].toLowerCase();
  if (declared !== 'image/jpeg' && declared !== 'image/png' && declared !== 'image/webp') {
    throw new ImageError('Image must be JPEG, PNG or WebP');
  }
  const b64 = m[2];
  // Size from the base64 length first, so an oversized image is never decoded.
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const approx = Math.floor((b64.length * 3) / 4) - padding;
  if (approx > MAX_IMAGE_BYTES) throw new ImageError('Image is larger than 5 MB');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length === 0) throw new ImageError('Image is empty');
  if (buf.length > MAX_IMAGE_BYTES) throw new ImageError('Image is larger than 5 MB');
  if (!matchesType(buf, declared)) throw new ImageError('Image content does not match its declared type');
  return { mediaType: declared, base64: b64, bytes: buf.length };
}
