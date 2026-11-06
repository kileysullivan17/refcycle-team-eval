import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Absolute path of the app/ folder, independent of the working directory. */
export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Absolute path of the repository root. */
export const REPO_DIR = path.resolve(APP_DIR, '..');
export const PUBLIC_DIR = path.join(APP_DIR, 'public');
export const DATA_DIR = path.join(APP_DIR, 'data');
export const LOGS_DIR = path.join(APP_DIR, 'logs');
export const RULES_DIR = path.join(REPO_DIR, 'engine', 'rules');
export const FACILITIES_CSV = path.join(REPO_DIR, 'engine', 'data', 'facilities.csv');
