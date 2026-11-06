// Drives a RefCycle build through its own UI, the way a resident would, and records what the page shows and
// what the page asked the server. Nothing here knows a build's markup: it finds controls by role, label and
// visible text, and by the client routes and API paths that CONTRACTS v1.3 fixes for both builds.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export const PLACE_PATTERNS = {
  seattle_wa: /seattle/i,
  austin_tx: /austin/i,
  hawaii_county_hi: /hawai/i,
};

export const STREAM_LABELS = {
  recycle_bin: 'Recycling',
  compost_bin: 'Compost',
  garbage: 'Garbage',
  drop_off_special: 'Special drop-off',
  deposit_return: 'Deposit return',
};

const RULE_ID_RE = /\b(?:sea|atx|hc)-[a-z]+-\d{3}\b/g;
const ASK_TIMEOUT = 170_000; // the app's own client timeout is 150 s
const IDENTIFY_TIMEOUT = 100_000;
const SITES_TIMEOUT = 40_000;

const dbg = (...a) => { if (process.env.HARNESS_DEBUG) console.error('[dbg]', ...a); };

export class DriveError extends Error {
  constructor(step, message) {
    super(`${step}: ${message}`);
    this.step = step;
  }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Records every /api/ call the page makes, with parsed bodies. Photo bytes are replaced by their size and hash. */
export function attachNetwork(page, t0) {
  const records = [];
  const pending = new Set();
  page.on('response', (res) => {
    const req = res.request();
    const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) return;
    const rec = { t_ms: Date.now() - t0, method: req.method(), path: url.pathname, search: url.search, status: res.status() };
    let body = req.postData();
    if (body) {
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed.image === 'string') {
          parsed.image = { data_url_chars: parsed.image.length, sha256: createHash('sha256').update(parsed.image).digest('hex'), prefix: parsed.image.slice(0, 30) };
        }
        rec.request = parsed;
      } catch {
        rec.request_text = body.slice(0, 2000);
      }
    }
    records.push(rec);
    // The display-swap log is fire-and-forget with keepalive; its body is not needed and can stall.
    if (url.pathname.startsWith('/api/log/')) return;
    const p = res
      .text()
      .then((t) => {
        try {
          rec.response = JSON.parse(t);
        } catch {
          rec.response_text = t.slice(0, 2000);
        }
      })
      .catch((e) => {
        rec.response_error = String(e.message || e);
      })
      .finally(() => pending.delete(p));
    pending.add(p);
  });
  page.on('requestfailed', (req) => {
    const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) return;
    records.push({ t_ms: Date.now() - t0, method: req.method(), path: url.pathname, search: url.search, failed: req.failure()?.errorText ?? 'failed' });
  });
  // A body read can stall (for example a response the page has abandoned), so each wait is bounded.
  const flush = () => Promise.allSettled([...pending].map((p) => Promise.race([p, new Promise((r) => setTimeout(r, 3000))])));
  return { records, t0, flush };
}

/** The resident's view: the main region if there is one, else the body. */
async function screenRoot(page) {
  const main = page.locator('main');
  if ((await main.count()) > 0 && (await main.first().isVisible().catch(() => false))) return main.first();
  return page.locator('body');
}

/** Waits until the visible screen stops changing and shows no busy marker. */
export async function settle(page, { maxMs = 20_000, quietMs = 1200 } = {}) {
  const start = Date.now();
  let last = null;
  let stableSince = Date.now();
  while (Date.now() - start < maxMs) {
    let snap;
    try {
      snap = await page.evaluate(() => {
        const root = document.querySelector('main') || document.body;
        const busy = !!document.querySelector('[aria-busy="true"], [role="progressbar"]');
        const spin = [...document.querySelectorAll('.spinner, .loading, [data-loading]')].some((n) => n.offsetParent !== null);
        return { text: root ? root.innerText : '', busy: busy || spin, url: location.href };
      });
    } catch {
      snap = { text: '', busy: true, url: '' };
    }
    const key = `${snap.url}\n${snap.text}`;
    if (key !== last) {
      last = key;
      stableSince = Date.now();
    } else if (!snap.busy && Date.now() - stableSince >= quietMs) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Text, links and controls of the current screen. */
export async function readScreen(page) {
  return page.evaluate(() => {
    const root = document.querySelector('main') || document.body;
    const vis = (n) => !!(n.offsetParent !== null || n.getClientRects().length);
    const text = root ? root.innerText : '';
    const anchors = [...document.querySelectorAll('a[href]')].filter(vis).map((a) => ({ text: a.innerText.trim(), href: a.href }));
    const controls = [...root.querySelectorAll('button, [role=button], input, select, textarea')].filter(vis).map((b) => ({
      tag: b.tagName.toLowerCase(),
      type: b.getAttribute('type'),
      text: (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().slice(0, 200),
    }));
    const headings = [...root.querySelectorAll('h1, h2, h3')].filter(vis).map((h) => h.innerText.trim());
    const header = document.querySelector('header');
    return { url: location.href, title: document.title, header_text: header ? header.innerText : '', headings, text, anchors, controls };
  });
}

/** Fields the grader uses from a screen, read from visible text only. */
export function summarizeItemScreen(screen) {
  const text = screen.text || '';
  const labels = Object.entries(STREAM_LABELS)
    .filter(([, l]) => new RegExp(`(^|[^A-Za-z])${escapeRe(l)}([^A-Za-z]|$)`).test(text))
    .map(([s]) => s);
  return {
    visible_rule_ids: [...new Set(text.match(RULE_ID_RE) || [])],
    visible_stream_labels: labels,
    shows_dont_know: /don[’']?t know|do not know/i.test(text),
    shows_it_depends: /it depends|depends on/i.test(text),
    shows_no_answer: /no answer available/i.test(text),
  };
}

async function firstVisible(locators) {
  for (const loc of locators) {
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const el = loc.nth(i);
      if (await el.isVisible().catch(() => false)) return el;
    }
  }
  return null;
}

/** First use: the place picker appears; pick the place by its visible name. */
export async function pickPlace(page, baseUrl, placeId, steps) {
  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'domcontentloaded' });
  await settle(page, { maxMs: 15_000 });
  const re = PLACE_PATTERNS[placeId];
  const control = await firstVisible([
    page.getByRole('button', { name: re }),
    page.getByRole('link', { name: re }),
    page.getByRole('radio', { name: re }),
    page.getByRole('option', { name: re }),
  ]);
  if (control) {
    const label = (await control.innerText({ timeout: 2000 }).catch(() => '')) || (await control.getAttribute('aria-label', { timeout: 2000 }).catch(() => '')) || '';
    await control.click();
    steps.push({ step: 'pick_place', via: 'control', label: label.trim() });
  } else {
    // A select is the other common picker.
    let done = false;
    for (const sel of await page.locator('select').all()) {
      if (!(await sel.isVisible().catch(() => false))) continue;
      const options = await sel.locator('option').allInnerTexts();
      const match = options.find((o) => re.test(o));
      if (match) {
        await sel.selectOption({ label: match });
        steps.push({ step: 'pick_place', via: 'select', label: match.trim() });
        const go = await firstVisible([page.getByRole('button', { name: /continue|done|save|go|start|ok/i })]);
        if (go) await go.click();
        done = true;
        break;
      }
    }
    if (!done) throw new DriveError('pick_place', 'no place control found on first use');
  }
  await settle(page, { maxMs: 15_000 });
  const stored = await page.evaluate(() => {
    try {
      return localStorage.getItem('refcycle.place');
    } catch {
      return null;
    }
  });
  steps.push({ step: 'place_stored', value: stored });
}

async function openTab(page, baseUrl, namePattern, route, steps) {
  const nav = page.locator('nav');
  const tab = await firstVisible([nav.getByRole('link', { name: namePattern }), nav.getByRole('button', { name: namePattern }), nav.getByRole('tab', { name: namePattern })]);
  if (tab) {
    await tab.click();
    steps.push({ step: 'open_tab', via: 'tab bar', name: String(namePattern) });
  } else {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: 'domcontentloaded' });
    steps.push({ step: 'open_tab', via: 'route', route });
  }
  await settle(page, { maxMs: 15_000 });
}

async function findSearchBox(page) {
  return firstVisible([
    page.getByRole('searchbox'),
    page.locator('input[type=search]'),
    page.getByPlaceholder(/search/i),
    page.getByLabel(/search/i),
  ]);
}

/**
 * Recyclopedia path to an item page, the same rule for every build:
 * type the phrase in the search box and press Enter. If that does not open an item page, pick, in order:
 * an entry whose name equals the phrase; the control that asks about the typed text as written; the first
 * listed entry that contains the phrase.
 */
export async function searchToItem(page, baseUrl, phrase, steps) {
  await openTab(page, baseUrl, /recyclopedia/i, '/recyclopedia', steps);
  const box = await findSearchBox(page);
  if (!box) throw new DriveError('search', 'no search box on the Recyclopedia screen');
  await box.click();
  await box.fill(phrase);
  steps.push({ step: 'type_search', text: phrase });
  const askWait = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/ask', { timeout: 4000 }).catch(() => null);
  await box.press('Enter');
  steps.push({ step: 'press_enter' });
  if (await askWait) {
    steps.push({ step: 'path', path: 'enter_opened_item' });
    return 'enter_opened_item';
  }
  await settle(page, { maxMs: 10_000 });
  const root = await screenRoot(page);
  const exact = new RegExp(`^\\s*${escapeRe(phrase)}\\s*$`, 'i');
  const contains = new RegExp(escapeRe(phrase), 'i');
  const candidates = [
    ['exact_entry', [root.getByRole('link', { name: exact }), root.getByRole('button', { name: exact })]],
    ['ask_typed_text', [askRe(phrase)].flatMap((re) => [root.getByRole('link', { name: re }), root.getByRole('button', { name: re })])],
    ['first_entry', [root.getByRole('link', { name: contains }), root.getByRole('button', { name: contains })]],
  ];
  for (const [how, locs] of candidates) {
    const el = await firstVisible(locs);
    if (!el) continue;
    const label = (await el.innerText({ timeout: 2000 }).catch(() => '')).trim();
    const wait = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/ask', { timeout: 15_000 }).catch(() => null);
    await el.click();
    steps.push({ step: 'path', path: how, clicked: label });
    if (await wait) return how;
    throw new DriveError('search', `clicked "${label}" (${how}) but no answer was requested`);
  }
  throw new DriveError('search', 'no way from the search results to an item page');
}

/** A control that sends the typed text as a free question: "Ask about <phrase>", or a bare "Ask about this". */
function askRe(phrase) {
  return new RegExp(`(^\\s*(ask|search for|look up|get an answer|find out)\\b)|((ask|search for|look up|get an answer|find out).*${escapeRe(phrase)})`, 'i');
}

/** Waits for the item page's answer and reads the screen once it settles. */
export async function readItemPage(page, net, steps, { since = 0 } = {}) {
  const deadline = Date.now() + ASK_TIMEOUT;
  while (Date.now() < deadline) {
    await net.flush();
    const asks = net.records.filter((r) => r.path === '/api/ask' && r.t_ms >= since);
    dbg('wait ask', asks.length, asks.map((r) => Object.keys(r).join('|')));
    if (asks.length && asks.every((r) => 'response' in r || 'response_text' in r || 'failed' in r || 'response_error' in r)) break;
    await page.waitForTimeout(500);
  }
  dbg('ask done');
  const settled = await settle(page, { maxMs: 25_000 });
  dbg('settled', settled);
  await net.flush();
  const screen = await readScreen(page);
  steps.push({ step: 'read_item', settled, url: screen.url });
  return { screen, summary: summarizeItemScreen(screen) };
}

/** From the item page: Dispose (or the item's own locations control), then the list of sites. */
export async function openLocatorFromItem(page, net, steps) {
  const root = await screenRoot(page);
  const dispose = await firstVisible([
    root.getByRole('link', { name: /dispose/i }),
    root.getByRole('button', { name: /dispose/i }),
    root.getByRole('link', { name: /where to take|find (a )?(place|location|drop.?off)|show (places|locations|sites)|see (places|locations)|locations for/i }),
    root.getByRole('button', { name: /where to take|find (a )?(place|location|drop.?off)|show (places|locations|sites)|see (places|locations)|locations for/i }),
  ]);
  if (!dispose) {
    steps.push({ step: 'dispose', found: false });
    return null;
  }
  const label = (await dispose.innerText({ timeout: 2000 }).catch(() => '')).trim();
  const before = Date.now();
  const sitesWait = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sites', { timeout: SITES_TIMEOUT }).catch(() => null);
  await dispose.click();
  steps.push({ step: 'dispose', found: true, label });
  await sitesWait;
  await settle(page, { maxMs: 20_000 });
  // The list view shows every site by name; a map shows only pinned ones.
  const list = await firstVisible([
    (await screenRoot(page)).getByRole('button', { name: /^\s*list( view)?\s*$/i }),
    (await screenRoot(page)).getByRole('link', { name: /^\s*list( view)?\s*$/i }),
    (await screenRoot(page)).getByRole('tab', { name: /^\s*list( view)?\s*$/i }),
  ]);
  if (list) {
    const pressed = await list.getAttribute('aria-pressed');
    const selected = await list.getAttribute('aria-selected');
    if (pressed !== 'true' && selected !== 'true') {
      await list.click();
      steps.push({ step: 'list_view', clicked: true });
      await settle(page, { maxMs: 15_000 });
    } else steps.push({ step: 'list_view', already: true });
  } else steps.push({ step: 'list_view', found: false });
  await net.flush();
  const screen = await readScreen(page);
  steps.push({ step: 'read_locator', url: screen.url, waited_ms: Date.now() - before });
  return { screen, dispose_label: label };
}

/** Camera scan: open the scan screen, give the photo to its file input, then confirm the suggested label. */
export async function scanPhoto(page, baseUrl, net, photoPath, steps, { fakeControlFile, photoId } = {}) {
  await openTab(page, baseUrl, /camera|scan/i, '/scan', steps);
  let input = page.locator('input[type=file]');
  if ((await input.count()) === 0) {
    const reveal = await firstVisible([page.getByRole('button', { name: /photos?|upload|choose|camera roll|gallery/i }), page.getByText(/^\s*photos?\s*$/i)]);
    if (reveal) {
      await reveal.click().catch(() => {});
      steps.push({ step: 'reveal_file_input' });
      await settle(page, { maxMs: 5000 });
    }
    input = page.locator('input[type=file]');
  }
  if ((await input.count()) === 0) throw new DriveError('scan', 'no file input on the scan screen');
  if (fakeControlFile) writeFileSync(fakeControlFile, photoId);
  const t = Date.now();
  const idWait = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/identify', { timeout: IDENTIFY_TIMEOUT }).catch(() => null);
  await input.first().setInputFiles(photoPath);
  steps.push({ step: 'upload_photo', file: photoPath.split('/').pop() });
  const idRes = await idWait;
  if (!idRes) throw new DriveError('scan', 'no identification request after the photo was chosen');
  await settle(page, { maxMs: 20_000 });
  await net.flush();
  const confirmScreen = await readScreen(page);
  const id = net.records.filter((r) => r.path === '/api/identify').pop();
  const status = id?.response?.status ?? null;
  steps.push({ step: 'identified', status, ms: Date.now() - t });
  const result = { confirm_screen: confirmScreen, identify_status: status, identify_label: id?.response?.label ?? null, confirmed: false };
  if (status !== 'identified') {
    // A follow-up question (which item, or retake / type). The harness does not answer it.
    await page.waitForTimeout(3000);
    await net.flush();
    return result;
  }
  const root = await screenRoot(page);
  const yes = await firstVisible([
    root.getByRole('button', { name: /^\s*(yes|yes,? that'?s (it|right)|that'?s right|correct|confirm|looks right)\b/i }),
    root.getByRole('link', { name: /^\s*(yes|yes,? that'?s (it|right)|that'?s right|correct|confirm|looks right)\b/i }),
  ]);
  if (!yes) throw new DriveError('scan', 'no control to confirm the suggested label');
  const yesText = (await yes.innerText({ timeout: 2000 }).catch(() => '')).trim();
  const since = Date.now() - net.t0;
  await yes.click();
  result.confirmed = true;
  steps.push({ step: 'confirm_label', clicked: yesText });
  result.ask_since = since;
  return result;
}

export const helpers = { norm, escapeRe, RULE_ID_RE };
