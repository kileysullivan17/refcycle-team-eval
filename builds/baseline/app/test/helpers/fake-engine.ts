import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Answer {
  jurisdiction: string;
  item_interpreted: string | null;
  behavior: 'answer' | 'abstain' | 'clarify' | 'conditional';
  stream: string | null;
  conditions: Array<{ if: string; stream: string }> | null;
  clarifying_question: string | null;
  prep: string[];
  explanation: string;
  rule_ids: string[];
  source_urls: string[];
  model: string;
}

export const OFFICIAL: Record<string, string> = {
  seattle_wa: 'https://www.seattle.gov/utilities/your-services/collection-and-disposal/where-does-it-go',
  austin_tx: 'https://www.austintexas.gov/recycling',
  hawaii_county_hi: 'https://www.hawaiizerowaste.org/recycle/drop-off/',
};

export const JURISDICTIONS = [
  { id: 'seattle_wa', name: 'Seattle, WA' },
  { id: 'austin_tx', name: 'Austin, TX' },
  { id: 'hawaii_county_hi', name: 'County of Hawaiʻi, HI' },
];

export function answer(jurisdiction: string, over: Partial<Answer>): Answer {
  return {
    jurisdiction,
    item_interpreted: 'test item',
    behavior: 'answer',
    stream: 'recycle_bin',
    conditions: null,
    clarifying_question: null,
    prep: [],
    explanation: 'x-001: “quoted source line”',
    rule_ids: ['x-001'],
    source_urls: [OFFICIAL[jurisdiction] ?? OFFICIAL.seattle_wa],
    model: 'fake/engine',
    ...over,
  };
}

export type Script = (jurisdiction: string, query: string) => Answer | { status: number; body: unknown } | Promise<Answer | { status: number; body: unknown }>;

export interface FakeEngine {
  url: string;
  server: Server;
  calls: Array<{ jurisdiction: string; query: string; raw: string }>;
  close(): Promise<void>;
}

/** A stand-in for the pinned engine: GET /api/jurisdictions and POST /api/ask, answers from `script`. */
export async function startFakeEngine(script: Script, jurisdictions: Array<{ id: string; name: string }> = JURISDICTIONS): Promise<FakeEngine> {
  const calls: FakeEngine['calls'] = [];
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'GET' && req.url === '/api/jurisdictions') return void res.end(JSON.stringify(jurisdictions));
    if (req.method === 'POST' && req.url === '/api/ask') {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: { jurisdiction?: string; query?: string };
      try {
        body = JSON.parse(raw);
      } catch {
        res.statusCode = 400;
        return void res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
      calls.push({ jurisdiction: body.jurisdiction ?? '', query: body.query ?? '', raw });
      const out = await script(body.jurisdiction ?? '', body.query ?? '');
      if ('status' in out && 'body' in out) {
        res.statusCode = out.status as number;
        return void res.end(JSON.stringify(out.body));
      }
      return void res.end(JSON.stringify(out));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    server,
    calls,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}
