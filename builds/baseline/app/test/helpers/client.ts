import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PUBLIC_DIR } from '../../src/shared/paths.ts';

/** Loads a browser ES module from app/public for a node test. Only pure modules (no DOM at import time) can be loaded this way. */
export async function loadClient<T = any>(relative: string): Promise<T> {
  return (await import(pathToFileURL(path.join(PUBLIC_DIR, relative)).href)) as T;
}
