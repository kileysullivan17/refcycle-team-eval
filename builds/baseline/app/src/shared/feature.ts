import type { IncomingMessage, ServerResponse } from 'node:http';

/** The server-side contract every feature module exports as `handle` (CONTRACTS 2.1). */
export type Handle = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<boolean>;
export interface FeatureModule {
  handle: Handle;
}
