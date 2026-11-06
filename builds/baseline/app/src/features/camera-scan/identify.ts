import { z } from 'zod';

/** CONTRACTS 4 */
export interface ImageConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  apiKey: string;
}

export type IdentifyStatus = 'identified' | 'unclear' | 'multiple';
export interface Identification {
  status: IdentifyStatus;
  label: string | null;
  candidates: string[];
}

export interface DecodedImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
}

/** The only thing the app needs from a provider: the model's raw JSON value and the exact model string. */
export interface ImageProvider {
  readonly model: string;
  identify(image: DecodedImage): Promise<{ value: unknown; model: string }>;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LABEL = 120;

export function readImageConfig(env: NodeJS.ProcessEnv = process.env): ImageConfig | null {
  const provider = (env.LLM_IMAGE_PROVIDER?.trim() || 'anthropic') as string;
  if (provider !== 'anthropic' && provider !== 'openai') return null;
  const model = env.LLM_IMAGE_MODEL?.trim() || 'claude-sonnet-5-5';
  const apiKey = env[provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY']?.trim();
  if (!apiKey) return null;
  return { provider, model, apiKey };
}

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Validates a data URL: JPEG, PNG or WebP, at most 5 MB decoded, and the bytes must match the declared type. */
export function decodeImage(dataUrl: unknown): DecodedImage {
  if (typeof dataUrl !== 'string') throw new ImageError('Send an image as a data URL');
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) throw new ImageError('The image must be a JPEG, PNG or WebP data URL');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length === 0) throw new ImageError('The image is empty');
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageError('The image is larger than 5 MB');
  const kind = m[1];
  const ok =
    kind === 'jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8
      : kind === 'png'
        ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP';
  if (!ok) throw new ImageError('The image bytes do not match their type');
  return { mediaType: `image/${kind}` as DecodedImage['mediaType'], base64: m[2] };
}

export const IDENTIFY_INSTRUCTIONS = [
  'You help a recycling guide work out what physical item is in a photo.',
  'Say ONLY what the item is. Never say whether it is recyclable, which bin or stream it belongs in, or how to dispose of it.',
  'Use a generic item name with no brand names and no model names, for example "plastic milk jug" or "microwave oven".',
  'Reply with one JSON object and nothing else: {"status":"identified"|"unclear"|"multiple","label":string|null,"candidates":string[]}.',
  'identified: one item is clearly the subject; put its generic name in label and leave candidates empty.',
  'unclear: the photo is blurry, dark, cropped, empty or the item cannot be told; label null, candidates empty.',
  'multiple: more than one distinct item could be the subject; label null and candidates holds up to 4 generic names.',
].join(' ');

const Raw = z.object({
  status: z.enum(['identified', 'unclear', 'multiple']),
  label: z.string().nullable().optional(),
  candidates: z.array(z.unknown()).optional(),
});

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Turns the model's raw value into the contract response. Only status, label and candidates survive: any other
 * field (a stream, a verdict, disposal advice) is dropped here (CS-4). Throws ImageError when the value is not usable.
 */
export function normalizeIdentification(value: unknown): Identification {
  const parsed = Raw.safeParse(value);
  if (!parsed.success) throw new ImageError('The identification result could not be read');
  const raw = parsed.data;
  if (raw.status === 'identified') {
    const label = clean(raw.label ?? '');
    if (!label || label.length > MAX_LABEL) return { status: 'unclear', label: null, candidates: [] };
    return { status: 'identified', label, candidates: [] };
  }
  if (raw.status === 'multiple') {
    const candidates = [
      ...new Set(
        (raw.candidates ?? [])
          .filter((c): c is string => typeof c === 'string')
          .map(clean)
          .filter((c) => c.length > 0 && c.length <= MAX_LABEL),
      ),
    ].slice(0, 4);
    return { status: 'multiple', label: null, candidates };
  }
  return { status: 'unclear', label: null, candidates: [] };
}

export function parseModelJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
  } catch {
    return null;
  }
}

/** Provider adapter for the two supported APIs. `request` is injectable so tests never reach a network. */
export function createRemoteImageProvider(config: ImageConfig, request: typeof fetch = fetch, timeoutMs = 60_000): ImageProvider {
  let useTemperature = true;
  const requested = `${config.provider}/${config.model}`;
  return {
    model: requested,
    async identify(image) {
      const anthropic = config.provider === 'anthropic';
      const endpoint = anthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions';
      const dataUrl = `data:${image.mediaType};base64,${image.base64}`;
      const body: Record<string, unknown> = anthropic
        ? {
            model: config.model,
            max_tokens: 400,
            temperature: 0,
            system: IDENTIFY_INSTRUCTIONS,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
                  { type: 'text', text: 'What is the item in this photo?' },
                ],
              },
            ],
          }
        : {
            model: config.model,
            temperature: 0,
            max_completion_tokens: 400,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: IDENTIFY_INSTRUCTIONS },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: dataUrl } },
                  { type: 'text', text: 'What is the item in this photo?' },
                ],
              },
            ],
          };
      const headers: Record<string, string> = anthropic
        ? { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }
        : { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` };
      if (!useTemperature) delete body.temperature;
      const send = () => request(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
      let response = await send();
      if (response.status === 400) {
        const err = (await response.json().catch(() => ({}))) as { error?: { param?: string; message?: string } };
        if (err.error?.param === 'temperature' || /temperature.*(not support|unsupported|deprecated|only.*default)/i.test(err.error?.message ?? '')) {
          useTemperature = false;
          delete body.temperature;
          response = await send();
        } else throw new Error('Provider rejected request');
      }
      if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
      const data = (await response.json()) as any;
      const model = `${config.provider}/${typeof data.model === 'string' ? data.model : config.model}`;
      const content = anthropic
        ? data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
        : data.choices?.[0]?.message?.content;
      return { model, value: typeof content === 'string' ? parseModelJson(content) : null };
    },
  };
}
