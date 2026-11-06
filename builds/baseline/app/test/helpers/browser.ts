import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { REPO_DIR } from '../../src/shared/paths.ts';

/** Finds Chrome and playwright-core (installed with the engine's dev dependencies). Both are optional: browser tests skip without them. */
export function findBrowser(): { chromium: any; executablePath: string } | null {
  try {
    const req = createRequire(path.join(REPO_DIR, 'engine', 'code', 'package.json'));
    const { chromium } = req('playwright-core');
    const executablePath = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && existsSync(p));
    return executablePath ? { chromium, executablePath } : null;
  } catch {
    return null;
  }
}

export async function launch(b: { chromium: any; executablePath: string }) {
  return b.chromium.launch({
    executablePath: b.executablePath,
    headless: true,
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-background-networking', '--disable-component-update'],
  });
}

/** A browser context that can reach only the test server; anything else (map tiles) is refused. */
export async function newContext(browser: any, baseUrl: string, options: Record<string, unknown> = {}) {
  const context = await browser.newContext({ viewport: { width: 430, height: 900 }, baseURL: baseUrl, permissions: ['camera'], ...options });
  await context.route('**/*', (route: any) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
  return context;
}
