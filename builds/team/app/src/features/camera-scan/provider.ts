import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv } from '../../../../engine/code/src/config.ts';
import type { ImageInput } from './image.ts';
import { IDENTIFY_REPAIR, IDENTIFY_SYSTEM, IDENTIFY_USER_TEXT } from './prompt.ts';
import type { ImageProvider, ImageReply } from './types.ts';

// Image-model adapters (CONTRACTS section 4). They follow the engine's RemoteProvider
// (engine/code/src/provider.ts): same endpoints and headers, temperature 0 first, and one retry
// without temperature only when the provider rejects that setting.

export const DEFAULT_IMAGE_PROVIDER = 'anthropic';
export const DEFAULT_IMAGE_MODEL = 'claude-sonnet-5-5';

export interface ImageConfig { provider: 'anthropic' | 'openai'; model: string; apiKey: string }

export class ConfigError extends Error {}

// Read per request so a missing key gives HTTP 502 and the server still starts.
export function readImageConfig(env: NodeJS.ProcessEnv = process.env): ImageConfig {
  const provider = env.LLM_IMAGE_PROVIDER?.trim() || DEFAULT_IMAGE_PROVIDER;
  const model = env.LLM_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  if (provider !== 'anthropic' && provider !== 'openai') throw new ConfigError('LLM_IMAGE_PROVIDER must be anthropic or openai');
  const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  const apiKey = env[keyName]?.trim();
  if (!apiKey) throw new ConfigError(`Set ${keyName} in .env`);
  return { provider, model, apiKey };
}

export class RemoteImageProvider implements ImageProvider {
  readonly model: string;
  private useTemperature = true;
  constructor(
    private config: ImageConfig,
    private request: typeof fetch = fetch,
    private timeoutMs = 30000,
  ) {
    this.model = `${config.provider}/${config.model}`;
  }

  buildBody(image: ImageInput, repair?: boolean): Record<string, unknown> {
    const { provider, model } = this.config;
    const system = IDENTIFY_SYSTEM + (repair ? IDENTIFY_REPAIR : '');
    const body: Record<string, unknown> =
      provider === 'anthropic'
        ? {
            model, max_tokens: 1024, temperature: 0, system,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
              { type: 'text', text: IDENTIFY_USER_TEXT },
            ] }],
          }
        : {
            model, temperature: 0, max_completion_tokens: 2048, response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: [
                { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
                { type: 'text', text: IDENTIFY_USER_TEXT },
              ] },
            ],
          };
    if (!this.useTemperature) delete body.temperature;
    return body;
  }

  async identify(image: ImageInput, repair?: boolean): Promise<ImageReply> {
    const { provider, model, apiKey } = this.config;
    const anthropic = provider === 'anthropic';
    const endpoint = anthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions';
    const headers: Record<string, string> = anthropic
      ? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      : { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
    const send = (body: Record<string, unknown>) =>
      this.request(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs), redirect: 'error' });

    let body = this.buildBody(image, repair);
    let response = await send(body);
    if (response.status === 400) {
      const error = (await response.json().catch(() => ({}))) as { error?: { param?: string; message?: string } };
      if (error.error?.param === 'temperature' || /temperature.*(not support|unsupported|deprecated|only.*default)/i.test(error.error?.message ?? '')) {
        this.useTemperature = false;
        body = this.buildBody(image, repair);
        response = await send(body);
      } else throw new Error('Provider rejected request');
    }
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
    const data = (await response.json()) as any;
    const exact = `${provider}/${typeof data.model === 'string' ? data.model : model}`;
    const content = anthropic
      ? data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
      : data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return { model: exact, value: null };
    try {
      return { model: exact, value: JSON.parse(content.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '')) };
    } catch {
      return { model: exact, value: null };
    }
  }
}

const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
const cache = new Map<string, RemoteImageProvider>();

// Default provider source for POST /api/identify. Reads .env and the settings on every call.
export async function getConfiguredProvider(): Promise<ImageProvider> {
  await loadEnv(ENV_FILE);
  const config = readImageConfig(process.env);
  const key = `${config.provider}|${config.model}|${config.apiKey}`;
  let p = cache.get(key);
  if (!p) { p = new RemoteImageProvider(config); cache.clear(); cache.set(key, p); }
  return p;
}
