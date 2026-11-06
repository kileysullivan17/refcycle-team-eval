import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/** Appends one JSON line to a log file, creating the folder. Never throws: logging must not block a response. */
export async function appendJsonl(file: string, record: Record<string, unknown>): Promise<boolean> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify({ time: new Date().toISOString(), ...record }) + '\n', 'utf8');
    return true;
  } catch {
    console.error(`Log write failed: ${path.basename(file)}`);
    return false;
  }
}
