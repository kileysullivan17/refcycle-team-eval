import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createAppServer, type ServerOptions } from '../../src/server.ts';

export interface TestApp {
  url: string;
  logsDir: string;
  server: Server;
  close(): Promise<void>;
}

/** Starts the app server on a random port with logs in a temporary folder (never app/logs/). */
export async function startApp(options: ServerOptions = {}): Promise<TestApp> {
  const logsDir = await mkdtemp(path.join(tmpdir(), 'refcycle-logs-'));
  const server = await createAppServer({ logsDir, ...options });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    logsDir,
    server,
    close: async () => {
      await new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); });
      await rm(logsDir, { recursive: true, force: true });
    },
  };
}
