import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Appends one JSON line, with a timestamp, to `<dir>/<file>`. The folder is created when missing. */
export async function appendJsonl(dir: string, file: string, record: Record<string, unknown>): Promise<void> {
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...record }) + '\n';
  await appendFile(join(dir, file), line, 'utf8');
}
