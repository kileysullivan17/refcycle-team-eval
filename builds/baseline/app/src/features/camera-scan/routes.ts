import path from 'node:path';
import type { Handle } from '../../shared/feature.ts';
import { HttpError, isJson, methodNotAllowed, readBody, sendJson } from '../../shared/http.ts';
import { appendJsonl } from '../../shared/logs.ts';
import { LOGS_DIR } from '../../shared/paths.ts';
import {
  createRemoteImageProvider,
  decodeImage,
  ImageError,
  normalizeIdentification,
  readImageConfig,
  type ImageProvider,
} from './identify.ts';

// 5 MB of image is about 6.99 MB of base64, plus the JSON wrapper.
const BODY_LIMIT = 7_200_000;

export interface IdentifyDeps {
  /** Returns the provider to use, or null when none is configured. Called per request so a changed .env is not needed. */
  getProvider: () => ImageProvider | null;
  logFile: string;
}

export function createHandle(deps?: Partial<IdentifyDeps>): Handle {
  const logFile = deps?.logFile ?? path.join(LOGS_DIR, 'identify.jsonl');
  let defaultProvider: ImageProvider | null = null;
  let defaultKey = '';
  const getProvider =
    deps?.getProvider ??
    (() => {
      const config = readImageConfig();
      if (!config) return null;
      const key = `${config.provider}|${config.model}|${config.apiKey}`;
      if (key !== defaultKey) {
        defaultProvider = createRemoteImageProvider(config);
        defaultKey = key;
      }
      return defaultProvider;
    });

  return async (req, res, url) => {
    if (url.pathname !== '/api/identify') return false;
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return true;
    }
    const started = Date.now();
    const log = (status: string, label: string | null, model: string | null) =>
      appendJsonl(logFile, { status, label, model, duration_ms: Date.now() - started });

    let image;
    try {
      if (!isJson(req)) throw new ImageError('Content-Type must be application/json');
      let body: unknown;
      try {
        body = JSON.parse((await readBody(req, BODY_LIMIT)).toString('utf8'));
      } catch (error) {
        if (error instanceof HttpError) throw new ImageError(error.message);
        throw new ImageError('Invalid JSON');
      }
      if (typeof body !== 'object' || body === null || Object.keys(body).some((k) => k !== 'image')) {
        throw new ImageError('Send only an image field');
      }
      image = decodeImage((body as { image?: unknown }).image);
    } catch (error) {
      if (!(error instanceof ImageError)) throw error;
      await log('rejected', null, null);
      sendJson(res, 400, { error: error.message });
      return true;
    }

    const provider = getProvider();
    if (!provider) {
      await log('not_configured', null, null);
      sendJson(res, 502, { error: 'Photo identification is not set up. Type the item instead.' });
      return true;
    }
    try {
      const result = await provider.identify(image);
      const found = normalizeIdentification(result.value);
      image = undefined; // the photo lives in memory for this call only (CS-10)
      await log(found.status, found.label, result.model);
      sendJson(res, 200, { status: found.status, label: found.label, candidates: found.candidates, model: result.model });
    } catch {
      await log('provider_error', null, provider.model);
      sendJson(res, 502, { error: 'The photo could not be identified. Retake it or type the item.' });
    }
    return true;
  };
}

export const handle: Handle = createHandle();
