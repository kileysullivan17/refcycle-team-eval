// Hand-written engine responses, one per display state (CONTRACTS section 3 and 8), and a fake engine.
// Every response is validated with the engine's own AnswerSchema, so a fixture can never drift from it.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AnswerSchema, AskRequest, type Answer } from '../../../engine/code/src/contract.ts';

const OFFICIAL = 'https://www.seattle.gov/utilities/your-services/collection-and-disposal/where-does-it-go';

function make(partial: Partial<Answer> & Pick<Answer, 'behavior'>): Answer {
  const base: Answer = {
    jurisdiction: 'seattle_wa',
    item_interpreted: 'Test item',
    behavior: 'answer',
    stream: null,
    conditions: null,
    clarifying_question: null,
    prep: [],
    explanation: 'sea-test-001: “Quoted source line.”',
    rule_ids: ['sea-test-001'],
    source_urls: [OFFICIAL],
    model: 'fake/fake-model',
  };
  return AnswerSchema.parse({ ...base, ...partial });
}

export const FIXTURES = {
  recycle: make({ behavior: 'answer', stream: 'recycle_bin', item_interpreted: 'Plastic bottle', prep: ['Empty the bottle'] }),
  compost: make({ behavior: 'answer', stream: 'compost_bin', item_interpreted: 'Food scraps' }),
  deposit: make({ behavior: 'answer', stream: 'deposit_return', item_interpreted: 'Deposit container', rule_ids: ['hc-deposit-005'] }),
  garbage: make({ behavior: 'answer', stream: 'garbage', item_interpreted: 'Light bulb' }),
  special: make({ behavior: 'answer', stream: 'drop_off_special', item_interpreted: 'Paint', rule_ids: ['sea-special-022', 'hc-hhw-010'] }),
  clarify: make({
    behavior: 'clarify',
    item_interpreted: null,
    clarifying_question: 'Is it a bottle or a tub?',
    prep: [],
    explanation: 'More detail is needed to find the rule.',
    rule_ids: [],
  }),
  conditional: make({
    behavior: 'conditional',
    item_interpreted: 'Plastic #2 HDPE',
    conditions: [
      { if: 'It is a bottle with a deposit mark', stream: 'deposit_return' },
      { if: 'It is a tub or cup', stream: 'recycle_bin' },
    ],
    rule_ids: ['hc-plastic-012', 'hc-deposit-005'],
  }),
  conditionalPlain: make({
    behavior: 'conditional',
    item_interpreted: 'Cardboard',
    conditions: [
      { if: 'It is clean', stream: 'recycle_bin' },
      { if: 'It is food-soiled', stream: 'garbage' },
    ],
    rule_ids: ['sea-paper-002', 'sea-garbage-023'],
  }),
  abstain: make({
    behavior: 'abstain',
    item_interpreted: null,
    explanation: 'We could not find a rule for this item in the local rules.',
    rule_ids: [],
  }),
  countyText: make({
    behavior: 'answer',
    stream: 'drop_off_special',
    jurisdiction: 'hawaii_county_hi',
    item_interpreted: 'Cooking oil',
    prep: ['Take it to a County of Hawai`i site'],
    explanation:
      'hc-oil-015: Taken by Big Island Biodiesel. “County of Hawaiʻi lists Big Island Biodiesel” and County of Hawai’i staff.',
    rule_ids: ['hc-oil-015'],
    source_urls: ['https://www.hawaiizerowaste.org/recycle/drop-off/'],
  }),
} as const;

export const PLACES = [
  { id: 'seattle_wa', name: 'Seattle, WA' },
  { id: 'austin_tx', name: 'Austin, TX' },
  { id: 'hawaii_county_hi', name: 'County of Hawaiʻi, HI' },
];

export interface FakeEngine {
  server: Server;
  url: string;
  requests: { method: string; url: string; body: string; contentType: string | undefined }[];
  close(): Promise<void>;
}

/** A fake engine. `respond` picks the answer for an ask; it defaults to the plain recycle fixture. */
export async function startFakeEngine(
  respond: (ask: { jurisdiction: string; query: string }) => { status?: number; body: unknown } = () => ({ body: FIXTURES.recycle }),
): Promise<FakeEngine> {
  const requests: FakeEngine['requests'] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(Buffer.from(c));
    const body = Buffer.concat(chunks).toString('utf8');
    requests.push({ method: req.method ?? '', url: req.url ?? '', body, contentType: req.headers['content-type'] });
    const send = (status: number, json: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(json));
    };
    if (req.method === 'GET' && req.url === '/api/jurisdictions') return send(200, PLACES);
    if (req.method === 'POST' && req.url === '/api/ask') {
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return send(400, { error: 'Content-Type must be application/json' });
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        return send(400, { error: 'Invalid JSON' });
      }
      const parsed = AskRequest.safeParse(parsedBody);
      if (!parsed.success) return send(400, { error: 'Provide jurisdiction and query as non-empty strings (query at most 2000 characters), with no extra keys' });
      const out = respond(parsed.data);
      return send(out.status ?? 200, out.body);
    }
    return send(404, { error: 'Not found' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
