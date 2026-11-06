// Browser checks against a fake engine and a fake image provider. Skipped when Chrome or playwright-core is not available.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createHandle as identifyHandle } from '../../src/features/camera-scan/routes.ts';
import type { DecodedImage, ImageProvider } from '../../src/features/camera-scan/identify.ts';
import { createHandle as sitesHandle } from '../../src/features/locator/routes.ts';
import { createHandle as catalogHandle } from '../../src/features/recyclopedia/routes.ts';
import { startApp, type TestApp } from '../helpers/app.ts';
import { findBrowser, launch, newContext } from '../helpers/browser.ts';
import { answer, startFakeEngine, type FakeEngine } from '../helpers/fake-engine.ts';
import { writeSiteFixtures } from '../helpers/site-fixtures.ts';

const found = findBrowser();
const PLACES = [
  { id: 'test_place', name: 'Test Place' },
  { id: 'other_place', name: 'County of Hawaiʻi, HI' },
];

describe('browser', { skip: found ? false : 'Chrome or playwright-core not available' }, () => {
  let engine: FakeEngine;
  let app: TestApp;
  let browser: any;
  let identifyResult: unknown = { status: 'identified', label: 'plastic milk jug' };
  let identifyFail = false;
  const photos: DecodedImage[] = [];

  const script = (j: string, q: string) => {
    const place = j === 'other_place' ? 'other' : 'test';
    if (q === 'bad') return { status: 400, body: { error: 'nope' } };
    if (q === 'bottle') return answer(j, { behavior: 'clarify', stream: null, item_interpreted: 'bottle', clarifying_question: 'Does it have a HI-5 label?', rule_ids: [], explanation: 'More detail is needed to identify one item in the local rules.' });
    if (q.startsWith('bottle ')) return answer(j, { item_interpreted: `resolved ${q}`, stream: 'recycle_bin' });
    switch (q) {
      case 'cardboard': return answer(j, { item_interpreted: 'Cardboard', stream: 'recycle_bin', prep: ['Flatten boxes'], rule_ids: ['t-3'] });
      case 'trash': return answer(j, { item_interpreted: 'Trash', stream: 'garbage', rule_ids: ['t-3'] });
      case 'compost': return answer(j, { item_interpreted: 'Food', stream: 'compost_bin', rule_ids: ['t-3'] });
      case 'tires': return answer(j, { item_interpreted: `Tires in ${place}`, stream: 'drop_off_special', prep: ['Remove rims'], rule_ids: ['t-1'], explanation: 't-1: “quoted” Where: North station' });
      case 'deposit': return answer(j, { item_interpreted: 'Can', stream: 'deposit_return', rule_ids: ['t-1'] });
      case 'limited': return answer(j, { item_interpreted: 'Clear bottle', stream: 'drop_off_special', rule_ids: ['t-2'] });
      case 'nowhere': return answer(j, { item_interpreted: 'Mystery', stream: 'drop_off_special', rule_ids: ['t-5'] });
      case 'oil': return answer(j, { item_interpreted: 'Cooking oil', behavior: 'conditional', stream: null, conditions: [{ if: 'very small, solidified', stream: 'garbage' }, { if: 'larger household quantity', stream: 'drop_off_special' }], rule_ids: ['t-4'], explanation: 't-4: “County of Hawai`i says call” Where: Big Island Biodiesel accepts oil in County of Hawaii' });
      case 'unknown': return answer(j, { item_interpreted: null, behavior: 'abstain', stream: null, rule_ids: [], explanation: 'The pack is silent on this.' });
      case 'hawaii': return answer(j, { item_interpreted: 'County of Hawaiʻi thing', explanation: 'x-1: “County of Hawai`i” County of Hawaii rule' });
      default: return answer(j, { item_interpreted: q, rule_ids: ['t-3'] });
    }
  };

  const provider: ImageProvider = {
    model: 'fake/image',
    async identify(img) {
      photos.push(img);
      if (identifyFail) throw new Error('down');
      return { value: identifyResult, model: 'fake/image-1' };
    },
  };

  before(async () => {
    engine = await startFakeEngine(script, PLACES);
    const f = await writeSiteFixtures();
    app = await startApp({
      engineUrl: engine.url,
      modules: [{ handle: catalogHandle() }, { handle: identifyHandle({ getProvider: () => provider, logFile: path.join(f.dir, 'identify.jsonl') }) }, { handle: sitesHandle(f.rulesDir, f.csv) }],
    });
    browser = await launch(found!);
  });
  after(async () => {
    await browser?.close();
    await app?.close();
    await engine?.close();
  });

  async function open(place: string | null = 'test_place', opts: Record<string, unknown> = {}) {
    const context = await newContext(browser, app.url, opts);
    if (place) await context.addInitScript((p: string) => localStorage.setItem('refcycle.place', p), place);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message));
    return { context, page, errors };
  }
  const text = (page: any, sel = 'body') => page.locator(sel).innerText();

  it('asks for a place on first use, offers exactly the engine places, swaps the Hawaii name and remembers the choice', async () => {
    const { context, page, errors } = await open(null);
    await page.goto('/recyclopedia');
    await page.waitForSelector('.place-choice');
    assert.equal(new URL(page.url()).pathname, '/place');
    const names = await page.locator('.place-choice').allInnerTexts();
    assert.deepEqual(names, ['Test Place', 'Hawaiʻi County, HI']);
    assert.equal(await page.locator('#place-picker').isHidden(), true);
    await page.click('[data-place=other_place]');
    await page.waitForSelector('.card-grid');
    assert.equal(new URL(page.url()).pathname, '/recyclopedia');
    assert.equal(await page.evaluate(() => localStorage.getItem('refcycle.place')), 'other_place');
    assert.equal(await page.locator('#place-select').inputValue(), 'other_place');
    await page.reload();
    await page.waitForSelector('.card-grid');
    assert.equal(await page.evaluate(() => localStorage.getItem('refcycle.place')), 'other_place');
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('drops a stored place the engine does not list', async () => {
    const { context, page } = await open('mars');
    await page.goto('/');
    await page.waitForSelector('.place-choice');
    assert.equal(await page.evaluate(() => localStorage.getItem('refcycle.place')), null);
    await context.close();
  });

  it('shows the engine failing to list places as no answer, with Retry', async () => {
    const dead = await startApp({ engineUrl: 'http://127.0.0.1:1', modules: [] });
    const context = await newContext(browser, dead.url);
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForSelector('.state-error');
    assert.match(await text(page, '.state-error'), /No answer available/);
    assert.equal(await page.locator('.place-choice').count(), 0);
    await context.close();
    await dead.close();
  });

  it('Recyclopedia: 10 category cards, a material page, then an entry that asks the engine with the entry name', async () => {
    const { context, page } = await open();
    await page.goto('/recyclopedia');
    await page.waitForSelector('.category-card');
    assert.equal(await page.locator('.category-card').count(), 10);
    await page.click('[data-category=plastic]');
    await page.waitForSelector('.entry-row');
    assert.equal(await page.locator('.entry-row').first().innerText(), 'Plastic #1 PET');
    const before = engine.calls.length;
    await page.click('[data-entry=plastic-2]');
    await page.waitForSelector('.verdict-card');
    const call = engine.calls.at(-1)!;
    assert.equal(engine.calls.length, before + 1);
    assert.deepEqual([call.jurisdiction, call.query], ['test_place', 'Plastic #2 HDPE']);
    await context.close();
  });

  it('search filters as you type, opens results on submit, and sends unmatched text to the engine as a free question', async () => {
    const { context, page } = await open();
    await page.goto('/recyclopedia');
    await page.fill('#catalog-search', 'plastic');
    await page.waitForSelector('[data-role=results] .entry-row');
    const rows = await page.locator('[data-role=results] .entry-row').allInnerTexts();
    assert.ok(rows.length > 5 && rows.every((r: string) => /plastic/i.test(r)));
    await page.press('#catalog-search', 'Enter');
    await page.waitForSelector('[data-role=results]');
    assert.equal(new URL(page.url()).pathname, '/search');
    await page.goto('/recyclopedia');
    await page.fill('#catalog-search', 'bread bag clips');
    await page.press('#catalog-search', 'Enter');
    await page.waitForSelector('.verdict-card');
    assert.equal(engine.calls.at(-1)!.query, 'bread bag clips');
    assert.equal(await text(page, '.item-title'), 'bread bag clips');
    await context.close();
  });

  it('item page: stream cards, label text, no verdict on referee states, prep, explanation, sources, no Upcycle', async () => {
    const { context, page } = await open();
    const go = async (q: string) => {
      await page.goto(`/item?q=${encodeURIComponent(q)}&origin=search`);
      await page.waitForSelector('.item-title');
    };
    await go('cardboard');
    assert.equal(await text(page, '.verdict-card'), 'Recycling');
    assert.ok(await page.locator('.verdict-card--blue').count());
    assert.match(await text(page, '.item-page'), /Flatten boxes/);
    assert.equal(await page.locator('[data-action=dispose]').count(), 0);
    assert.ok(!/upcycle/i.test(await text(page)));
    await go('compost');
    assert.equal(await text(page, '.verdict-card'), 'Compost');
    await go('trash');
    assert.ok(await page.locator('.verdict-card--yellow').count());
    assert.equal(await text(page, '.verdict-card'), 'Garbage');
    await go('tires');
    assert.ok(await page.locator('.verdict-card--red').count());
    assert.equal(await text(page, '.verdict-card'), 'Special drop-off');
    assert.ok(await page.locator('[data-action=dispose]').count());
    await go('deposit');
    assert.ok(await page.locator('.verdict-card--blue').count());
    assert.ok(await page.locator('[data-action=dispose]').count());
    await go('unknown');
    assert.equal(await page.locator('.verdict-card').count(), 0);
    assert.match(await text(page, '.referee'), /We don't know/);
    assert.equal(await text(page, '.item-title'), 'unknown');
    assert.match(await text(page, '.sources'), /seattle\.gov|austintexas|hawaiizerowaste/);
    assert.equal(await page.locator('[data-action=dispose]').count(), 0);
    assert.ok(!/score!|hazardous/i.test(await text(page)));
    await context.close();
  });

  it('conditional: every case with its stream as text, no card, Dispose when a case is special', async () => {
    const { context, page } = await open();
    await page.goto('/item?q=oil&origin=search');
    await page.waitForSelector('.referee');
    assert.equal(await page.locator('.verdict-card').count(), 0);
    const cases = await page.locator('.case').allInnerTexts();
    assert.equal(cases.length, 2);
    assert.match(cases[0], /very small, solidified\s+Garbage/);
    assert.match(cases[1], /larger household quantity\s+Special drop-off/);
    assert.ok(await page.locator('[data-action=dispose]').count());
    await context.close();
  });

  it('clarify: shows the question and a reply box, then sends original query + space + reply', async () => {
    const { context, page } = await open();
    await page.goto('/item?q=bottle&origin=search');
    await page.waitForSelector('.clarify-form');
    assert.equal(await page.locator('.verdict-card').count(), 0);
    assert.match(await text(page, '.referee'), /Does it have a HI-5 label\?/);
    await page.fill('#clarify-reply', 'yes HI-5');
    await page.click('.clarify-form button');
    await page.waitForSelector('.verdict-card');
    assert.equal(engine.calls.at(-1)!.query, 'bottle yes HI-5');
    await context.close();
  });

  it('HTTP 400 or an unreachable engine shows "no answer", no card and no fallback content, and Retry asks again', async () => {
    const { context, page } = await open();
    await page.goto('/item?q=bad&origin=search');
    await page.waitForSelector('.state-error');
    assert.match(await text(page, '.state-error'), /No answer available right now/);
    assert.equal(await page.locator('.verdict-card, .referee, .explanation').count(), 0);
    const n = engine.calls.length;
    await page.click('.state-error button');
    await page.waitForSelector('.state-error');
    assert.equal(engine.calls.length, n + 1);
    await context.close();
  });

  it('unknown catalog entry shows a not-found message and makes no engine call', async () => {
    const { context, page } = await open();
    const n = engine.calls.length;
    await page.goto('/item?entry=no-such-entry');
    await page.waitForSelector('.state-error');
    assert.match(await text(page, '.state-error'), /could not find/);
    assert.equal(engine.calls.length, n);
    await context.close();
  });

  it('changing the place re-asks the engine for the item on screen (X-9) and the new place sticks', async () => {
    const { context, page } = await open();
    await page.goto('/item?q=tires&origin=search');
    await page.waitForSelector('.verdict-card');
    assert.equal(await text(page, '.item-title'), 'Tires in test');
    await page.selectOption('#place-select', 'other_place');
    await page.waitForFunction(() => document.querySelector('.item-title')?.textContent === 'Tires in other');
    assert.equal(engine.calls.at(-1)!.jurisdiction, 'other_place');
    await context.close();
  });

  it('shows engine text as returned except the place-name and business swaps, and logs each swap', async () => {
    const { context, page } = await open('other_place');
    await page.goto('/item?q=hawaii&origin=search');
    await page.waitForSelector('.explanation');
    assert.equal(await text(page, '.item-title'), 'Hawaiʻi County thing');
    assert.equal(await text(page, '.explanation'), 'x-1: “County of Hawai`i” Hawaiʻi County rule');
    await page.goto('/item?q=oil&origin=search');
    await page.waitForSelector('.explanation');
    const body = await text(page);
    assert.ok(!body.includes('Big Island Biodiesel'));
    assert.match(await text(page, '.explanation'), /“County of Hawai`i says call” Where: a local biodiesel company accepts oil in Hawaiʻi County/);
    await new Promise((r) => setTimeout(r, 300));
    const lines = (await readFile(path.join(app.logsDir, 'display-swaps.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
    assert.ok(lines.some((l) => l.surface === 'item.title' && l.from === 'County of Hawaiʻi' && l.to === 'Hawaiʻi County' && l.place === 'other_place'));
    assert.ok(lines.some((l) => l.from === 'Big Island Biodiesel' && l.to === 'a local biodiesel company'));
    await context.close();
  });

  describe('locator', () => {
    it('Dispose opens the locator for the item: only the sites the cited rules name, with where text and conditions', async () => {
      const { context, page } = await open();
      await page.goto('/item?q=tires&origin=search');
      await page.click('[data-action=dispose]');
      await page.waitForSelector('[data-role=item]');
      const u = new URL(page.url());
      assert.equal(u.pathname, '/locations');
      assert.equal(u.searchParams.get('rule_ids'), 't-1');
      await page.click('[data-view=list]');
      await page.waitForSelector('.site-card');
      const names = await page.locator('.site-name').allInnerTexts();
      assert.deepEqual(names, ['alpha depot', 'Beta Station']);
      assert.match(await text(page, '.locator'), /North station, \$16 per load/);
      assert.match(await text(page, '.locator'), /By appointment\./);
      await context.close();
    });

    it('a location-limited rule shows the single site with a statement that it is the only place, and its field observation date', async () => {
      const { context, page } = await open();
      await page.goto('/item?q=limited&origin=search');
      await page.click('[data-action=dispose]');
      await page.waitForSelector('[data-role=item]');
      await page.click('[data-view=list]');
      await page.waitForSelector('.site-card');
      assert.equal(await page.locator('.site-card').count(), 1);
      assert.equal(await text(page, '[data-role=only-site]'), 'This is the only place that takes this item.');
      assert.match(await text(page, '[data-role=evidence]'), /Field observation dated 2026-03-04/);
      assert.ok(!/withheld/i.test(await text(page)));
      await context.close();
    });

    it('says the pack does not name a place when the cited rule names none, with the official link', async () => {
      const { context, page } = await open();
      await page.goto('/item?q=nowhere&origin=search');
      await page.click('[data-action=dispose]');
      await page.waitForSelector('.locator-notice');
      assert.match(await text(page, '.locator-notice'), /do not name a place/);
      assert.equal(await page.getAttribute('[data-role=official]', 'href'), 'https://example.org/official/test_place');
      assert.equal(await page.locator('.site-card, .map').count(), 0);
      await context.close();
    });

    it('with no item, lists every site for the place sorted by name, and the filter narrows by material', async () => {
      const { context, page } = await open();
      await page.goto('/locations?view=list');
      await page.waitForSelector('.site-card');
      const names: string[] = await page.locator('.site-name').allInnerTexts();
      assert.deepEqual(names, [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
      assert.ok(names.length >= 5);
      assert.ok(!/km|mi\b|miles|rating|reviews/i.test(await text(page, '.locator')));
      await page.selectOption('#material-filter', 'tires');
      await page.waitForFunction(() => document.querySelectorAll('.site-card').length === 2);
      assert.equal(new URL(page.url()).searchParams.get('material'), 'tires');
      await context.close();
    });

    it('map view pins only records with a pin, links to detail, and shows the OpenStreetMap attribution', async () => {
      const { context, page } = await open();
      await page.goto('/locations?view=map');
      await page.waitForSelector('.map[data-ready]');
      assert.ok((await page.locator('.leaflet-marker-icon').count()) >= 1);
      assert.match(await text(page, '.leaflet-control-attribution'), /© OpenStreetMap contributors/);
      assert.equal(await page.getAttribute('.leaflet-control-attribution a', 'href'), 'https://www.openstreetmap.org/copyright');
      await page.click('.leaflet-marker-icon');
      await page.click('.map-popup a');
      await page.waitForSelector('.facility');
      assert.equal(new URL(page.url()).pathname, '/locations/f-1');
      await context.close();
    });

    it('with no pins the map says so and offers List', async () => {
      const { context, page } = await open();
      await page.goto('/item?q=limited&origin=search');
      await page.click('[data-action=dispose]');
      await page.waitForSelector('[data-role=item]');
      await page.waitForSelector('.locator-notice');
      assert.equal(await text(page, '.locator-notice p'), 'No mapped locations yet; see the list');
      await page.click('[data-action=show-list]');
      await page.waitForSelector('.site-card');
      await context.close();
    });

    it('facility detail lists only the items its rules send there, the conditions, and no internal notes', async () => {
      const { context, page } = await open();
      await page.goto('/locations/f-2');
      await page.waitForSelector('[data-role=accepts]');
      assert.deepEqual(await page.locator('[data-role=accepts] li').allInnerTexts(), ['tires', 'paper']);
      assert.match(await text(page, '.facility'), /By appointment\./);
      await page.goto('/locations/f-1');
      await page.waitForSelector('.facility');
      assert.ok(!(await text(page)).includes('secret internal'));
      await page.goto('/locations/nope');
      await page.waitForSelector('.facility h2');
      assert.match(await text(page, '.facility'), /could not find/);
      await context.close();
    });

    it('conditional dispose groups by case: the drop-off case lists sites, the garbage case does not', async () => {
      const { context, page } = await open();
      await page.goto('/item?q=oil&origin=search');
      await page.click('[data-action=dispose]');
      await page.waitForSelector('[data-role=item]');
      await page.click('[data-view=list]');
      await page.waitForSelector('.case-group');
      assert.equal(await page.locator('.case-group').count(), 2);
      assert.equal(await page.locator('[data-case-stream=garbage] .site-card').count(), 0);
      assert.match(await text(page, '[data-case-stream=garbage]'), /not a drop-off place/);
      assert.ok((await page.locator('[data-case-stream=drop_off_special] .site-card').count()) >= 1);
      assert.ok(!(await text(page)).includes('Big Island Biodiesel'));
      await context.close();
    });

    it('events: tentative before the last date, "check the source" after it', async () => {
      for (const [when, expectText, expectNotes] of [['2027-03-01T12:00:00', 'Tentative', true], ['2027-03-07T12:00:00', 'Check the source for the next event', false]] as const) {
        const { context, page } = await open();
        await page.clock.install({ time: new Date(when) });
        await page.goto('/locations?view=list');
        await page.waitForSelector('.site-card');
        const card = page.locator('[data-facility=f-hc-03]');
        assert.equal(await card.locator('[data-role=event-state]').innerText(), expectText);
        assert.equal((await card.innerText()).includes('Tentative 2027-03-06.'), expectNotes);
        assert.match(await card.innerText(), /checked 2026-09-10/);
        await context.close();
      }
    });

    it('place change on a locator item re-asks the engine and uses the new place rules', async () => {
      const { context, page } = await open();
      await page.goto('/item?q=tires&origin=search');
      await page.click('[data-action=dispose]');
      await page.waitForSelector('[data-role=item]');
      await page.click('[data-view=list]');
      await page.waitForSelector('.site-card');
      const n = engine.calls.length;
      await page.selectOption('#place-select', 'other_place');
      await page.waitForFunction(() => document.querySelector('.site-card')?.getAttribute('data-facility') === 'f-7');
      assert.equal(engine.calls.length, n + 1);
      assert.equal(engine.calls.at(-1)!.jurisdiction, 'other_place');
      await context.close();
    });
  });

  describe('camera scan', () => {
    it('viewfinder with Identify, Photos, Snap Tips, close, flash and flip; Identify then confirm with "We think this is"; Yes opens the item page with the label', async () => {
      identifyResult = { status: 'identified', label: 'plastic milk jug' };
      const { context, page, errors } = await open();
      await page.goto('/scan');
      await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement | null)?.videoWidth! > 0);
      for (const label of ['Identify', 'Close', 'Flip camera']) assert.ok(await page.getByRole('button', { name: label }).count(), label);
      assert.ok(await page.locator('label.photos-button').count());
      assert.ok(await page.getByRole('button', { name: 'Snap Tips' }).count());
      assert.ok(await page.locator('.viewfinder-control[aria-label^=Flash]').count());
      await page.click('[aria-label=Identify]');
      await page.waitForSelector('[data-role=prompt]');
      assert.equal(new URL(page.url()).pathname, '/scan/confirm');
      assert.equal(await text(page, '[data-role=prompt]'), 'We think this is: plastic milk jug. Is that right?');
      assert.equal(engine.calls.filter((c) => c.query === 'plastic milk jug').length, 0, 'engine is not asked before confirmation');
      assert.equal(photos.at(-1)!.mediaType, 'image/jpeg');
      await page.click('[data-action=yes]');
      await page.waitForSelector('.verdict-card');
      assert.equal(engine.calls.at(-1)!.query, 'plastic milk jug');
      assert.equal(new URL(page.url()).searchParams.get('origin'), 'scan');
      assert.deepEqual(errors, []);
      await context.close();
    });

    it('Edit lets the resident correct the label before the engine is asked', async () => {
      identifyResult = { status: 'identified', label: 'plastic milk jug' };
      const { context, page } = await open();
      await page.goto('/scan');
      await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement | null)?.videoWidth! > 0);
      await page.click('[aria-label=Identify]');
      await page.waitForSelector('[data-action=edit]');
      await page.click('[data-action=edit]');
      await page.fill('#typed-item', 'glass jar');
      await page.click('.edit-slot button');
      await page.waitForSelector('.verdict-card');
      assert.equal(engine.calls.at(-1)!.query, 'glass jar');
      await context.close();
    });

    it('unclear photo asks to retake or type, and does not call the engine with a guess', async () => {
      identifyResult = { status: 'unclear' };
      const { context, page } = await open();
      const n = engine.calls.length;
      await page.goto('/scan');
      await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement | null)?.videoWidth! > 0);
      await page.click('[aria-label=Identify]');
      await page.waitForSelector('[data-status=unclear]');
      assert.match(await text(page, '.confirm'), /Retake the photo, or type the name of the item/);
      assert.equal(engine.calls.length, n);
      assert.equal(await page.locator('.verdict-card').count(), 0);
      await context.close();
    });

    it('more than one item asks which one and does not merge them', async () => {
      identifyResult = { status: 'multiple', candidates: ['bottle', 'cap'] };
      const { context, page } = await open();
      await page.goto('/scan');
      await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement | null)?.videoWidth! > 0);
      await page.click('[aria-label=Identify]');
      await page.waitForSelector('[data-status=multiple]');
      assert.deepEqual(await page.locator('.candidate').allInnerTexts(), ['bottle', 'cap']);
      await page.click('.candidate >> nth=1');
      await page.waitForSelector('.verdict-card');
      assert.equal(engine.calls.at(-1)!.query, 'cap');
      await context.close();
    });

    it('provider failure offers retake or typing', async () => {
      identifyFail = true;
      const { context, page } = await open();
      await page.goto('/scan');
      await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement | null)?.videoWidth! > 0);
      await page.click('[aria-label=Identify]');
      await page.waitForSelector('#typed-item');
      assert.match(await text(page, '.scan-status'), /could not identify/);
      await page.fill('#typed-item', 'toaster');
      await page.press('#typed-item', 'Enter');
      await page.waitForSelector('.verdict-card');
      assert.equal(engine.calls.at(-1)!.query, 'toaster');
      identifyFail = false;
      await context.close();
    });

    it('camera access denied offers photo upload, and an uploaded photo is identified (CS-9)', async () => {
      identifyResult = { status: 'identified', label: 'microwave oven' };
      const { context, page } = await open();
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
      });
      await page.goto('/scan');
      await page.waitForSelector('.upload-fallback:not([hidden])');
      assert.equal(await page.locator('.viewfinder').isHidden(), true);
      assert.equal(await page.getAttribute('[data-role=photo-input]', 'accept'), 'image/jpeg,image/png,image/webp');
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
      await page.setInputFiles('[data-role=photo-input]', { name: 'a.png', mimeType: 'image/png', buffer: png });
      await page.waitForSelector('[data-role=prompt]');
      assert.match(await text(page, '[data-role=prompt]'), /microwave oven/);
      assert.equal(photos.at(-1)!.mediaType, 'image/jpeg');
      await context.close();
    });

    it('rejects a file that is not JPEG, PNG or WebP without calling the provider', async () => {
      const { context, page } = await open();
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
      });
      await page.goto('/scan');
      await page.waitForSelector('.upload-fallback:not([hidden])');
      const n = photos.length;
      await page.setInputFiles('[data-role=photo-input]', { name: 'a.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
      await page.waitForFunction(() => /JPEG, PNG or WebP/.test(document.querySelector('.scan-status')?.textContent ?? ''));
      assert.equal(photos.length, n);
      await context.close();
    });

    it('opening the confirm screen with nothing identified returns to the viewfinder', async () => {
      const { context, page } = await open();
      await page.goto('/scan/confirm');
      await page.waitForSelector('.viewfinder');
      assert.equal(new URL(page.url()).pathname, '/scan');
      await context.close();
    });
  });

  it('shows "not available yet" when a feature module cannot be loaded, and the rest of the app still works', async () => {
    const { context, page } = await open();
    await context.route('**/features/not-a-feature/**', (route: any) => route.abort());
    await context.route('**/features/camera-scan/screens.js', (route: any) => route.fulfill({ status: 404, body: 'missing' }));
    await page.goto('/scan');
    await page.waitForSelector('.state-error');
    assert.match(await text(page, '.state-error'), /This part of RefCycle is not available yet/);
    await page.goto('/recyclopedia');
    await page.waitForSelector('.card-grid');
    const missing = await page.evaluate(async () => {
      const path = '/features/not-a-feature/screens.js';
      try {
        await import(/* @vite-ignore */ path);
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(missing, true);
    await context.close();
  });

  it('keeps every sand box text and link in ink, and the red card label ink, bold and 19px or larger', async () => {
    const { context, page } = await open();
    await page.goto('/item?q=tires&origin=search');
    await page.waitForSelector('.verdict-card--red');
    const red = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.verdict-card--red .verdict-label')!);
      return { color: s.color, size: parseFloat(s.fontSize), weight: Number(s.fontWeight), family: s.fontFamily };
    });
    assert.equal(red.color, 'rgb(23, 33, 44)');
    assert.ok(red.size >= 19 && red.weight >= 700, JSON.stringify(red));
    assert.match(red.family, /MuseoModerno/);
    await page.goto('/locations?view=list');
    await page.waitForSelector('.site-card');
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('.on-sand, .on-sand *')].filter((n) => getComputedStyle(n).color !== 'rgb(23, 33, 44)').map((n) => n.tagName + '.' + n.className),
    );
    assert.deepEqual(bad, []);
    await context.close();
  });

  it('works at 320px without horizontal scroll', async () => {
    const { context, page } = await open(null, { viewport: { width: 320, height: 700 } });
    await page.goto('/recyclopedia');
    await page.waitForSelector('.place-choice');
    await page.click('[data-place=test_place]');
    await page.waitForSelector('.card-grid');
    for (const p of ['/recyclopedia', '/item?q=tires&origin=search', '/locations?view=list', '/scan']) {
      await page.goto(p);
      await page.waitForTimeout(300);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), p);
    }
    await context.close();
  });
});
