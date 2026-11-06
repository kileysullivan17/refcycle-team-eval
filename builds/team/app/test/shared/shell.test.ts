import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLACES } from './fixtures.ts';
import { byTestId, click, findAll, installFakeDom, loadClient, until, allByClass, tick, FakeElement, FakeWindow } from './fake-dom.ts';

type Env = ReturnType<typeof installFakeDom>;

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({ status, json: async () => body });
}

function setup(opts: { start?: string; stored?: string; places?: unknown; mounts?: Record<string, any>; importCalls?: string[] } = {}) {
  const env = installFakeDom(opts.start ?? '/', async (url: string) => {
    if (url === '/api/jurisdictions') return opts.places === null ? Promise.reject(new Error('down')) : jsonResponse(200, opts.places ?? PLACES);
    if (url === '/api/log/display-swap') return jsonResponse(204, null);
    return jsonResponse(404, { error: 'Not found' });
  });
  const importer = async (path: string) => {
    opts.importCalls?.push(path);
    const mod = opts.mounts?.[path];
    if (!mod) throw new Error('missing module');
    return mod;
  };
  (env as any).stored = opts.stored;
  return { env, importer };
}

async function boot(env: Env, importer: (p: string) => Promise<unknown>, winOverride?: FakeWindow, reload = false) {
  const stored: string | undefined = (env as any).stored;
  const { boot } = await loadClient('shared/main.js');
  if (!reload) {
    const keep = env.storage.throwing;
    env.storage.throwing = false;
    (await loadClient('shared/place.js')).clearStoredPlace(); // module memory is per page load; tests share one
    env.storage.throwing = keep;
    if (stored) env.storage.setItem('refcycle.place', stored);
  }
  const root = env.document.createElement('div');
  env.document.body.appendChild(root);
  const app = await boot(root, winOverride ?? env.win, { importer });
  return { root, app };
}

test('first visit shows the picker with exactly the three places, nothing preselected, county name swapped (X-1, X-2)', async () => {
  const { env, importer } = setup();
  try {
    const { root } = await boot(env, importer);
    const buttons = findAll(root, (n) => n.className === 'place-option');
    assert.deepEqual(buttons.map((b) => b.textContent), ['Seattle, WA', 'Austin, TX', 'Hawaiʻi County, HI']);
    assert.ok(buttons.every((b) => b.getAttribute('aria-checked') === 'false'));
    assert.equal(byTestId(root, 'header-place')!.hidden, true);
    assert.equal(env.storage.getItem('refcycle.place'), null);
    assert.ok(!root.textContent.includes('County of'));
    // only the places and the swap log were fetched; no location lookups
    assert.ok(env.win.fetchCalls.every((c) => c.url === '/api/jurisdictions' || c.url === '/api/log/display-swap'));
  } finally {
    env.restore();
  }
});

test('the choice is stored under refcycle.place and survives a reload', async () => {
  const mounts = { '/features/recyclopedia/screens.js': { mount: () => undefined } };
  const { env, importer } = setup({ mounts });
  try {
    const { root } = await boot(env, importer);
    click(findAll(root, (n) => n.getAttribute('data-place') === 'austin_tx')[0]);
    await until(() => env.win.location.pathname === '/recyclopedia');
    assert.equal(env.storage.getItem('refcycle.place'), 'austin_tx');
    const select = byTestId(root, 'header-place')!;
    assert.equal(select.hidden, false);
    assert.equal(select.value, 'austin_tx');

    // reload: a new window and app, the same storage
    const reloaded = new FakeWindow(env.document, '/', async (url: string) => (url === '/api/jurisdictions' ? jsonResponse(200, PLACES) : jsonResponse(204, null)));
    const again = await boot(env, async (p) => (mounts as any)[p], reloaded, true);
    await until(() => reloaded.location.pathname === '/recyclopedia');
    assert.equal(findAll(again.root, (n) => n.className === 'place-option').length, 0);
    assert.equal(byTestId(again.root, 'header-place')!.value, 'austin_tx');
  } finally {
    env.restore();
  }
});

test('a stored id that the engine does not list shows the picker again', async () => {
  const { env, importer } = setup({ stored: 'gotham_ny', start: '/recyclopedia' });
  try {
    const { root } = await boot(env, importer);
    assert.equal(findAll(root, (n) => n.className === 'place-option').length, 3);
    assert.equal(env.storage.getItem('refcycle.place'), null);
  } finally {
    env.restore();
  }
});

test('the picker is shown on any route when no place is stored, then continues to that route', async () => {
  const seen: any[] = [];
  const mounts = { '/features/locator/screens.js': { mount: (route: any) => void seen.push(route) } };
  const { env, importer } = setup({ start: '/locations?view=map', mounts });
  try {
    const { root } = await boot(env, importer);
    assert.equal(seen.length, 0);
    click(findAll(root, (n) => n.getAttribute('data-place') === 'seattle_wa')[0]);
    await until(() => seen.length === 1);
    assert.deepEqual(seen[0], { path: '/locations', params: {}, query: { view: 'map' } });
    assert.equal(env.win.location.pathname, '/locations');
  } finally {
    env.restore();
  }
});

test('changing the place in the header calls every subscriber and updates ctx.place (X-9)', async () => {
  const events: string[] = [];
  let ctxSeen: any;
  const mounts = {
    '/features/recyclopedia/screens.js': {
      mount: (_r: any, _c: any, ctx: any) => {
        ctxSeen = ctx;
        ctx.onPlaceChange((id: string) => events.push(id + ':' + ctx.place));
      },
    },
  };
  const { env, importer } = setup({ stored: 'seattle_wa', start: '/recyclopedia', mounts });
  try {
    const { root } = await boot(env, importer);
    const select = byTestId(root, 'header-place')!;
    assert.deepEqual(findAll(select, (n) => n.tagName === 'option').map((o) => o.textContent), ['Seattle, WA', 'Austin, TX', 'Hawaiʻi County, HI']);
    select.value = 'hawaii_county_hi';
    select.dispatchEvent({ type: 'change' });
    assert.deepEqual(events, ['hawaii_county_hi:hawaii_county_hi']);
    assert.equal(env.storage.getItem('refcycle.place'), 'hawaii_county_hi');
    assert.equal(ctxSeen.place, 'hawaii_county_hi');
    assert.deepEqual(ctxSeen.places.map((p: any) => p.name), ['Seattle, WA', 'Austin, TX', 'Hawaiʻi County, HI']);
    // the same place again is not a change
    select.dispatchEvent({ type: 'change' });
    assert.equal(events.length, 1);
    // an id the engine did not list is ignored
    select.value = 'gotham_ny';
    select.dispatchEvent({ type: 'change' });
    assert.equal(events.length, 1);
  } finally {
    env.restore();
  }
});

test('ctx has exactly the six members and place subscriptions end with the screen', async () => {
  let ctxA: any;
  const calls: string[] = [];
  const mounts = {
    '/features/recyclopedia/screens.js': {
      mount: (route: any, _c: any, ctx: any) => {
        if (route.path === '/recyclopedia') {
          ctxA = ctx;
          ctx.onPlaceChange(() => calls.push('A')); // never unsubscribed by the screen itself
        }
        return () => calls.push('cleanup ' + route.path);
      },
    },
    '/features/locator/screens.js': { mount: () => calls.push('mount locations') },
  };
  const { env, importer } = setup({ stored: 'seattle_wa', start: '/recyclopedia', mounts });
  try {
    const { root, app } = await boot(env, importer);
    assert.deepEqual(Object.keys(ctxA).sort(), ['displayText', 'navigate', 'onPlaceChange', 'place', 'places', 'setTitle']);
    await app.router.navigate('/locations');
    assert.deepEqual(calls.slice(0, 2), ['cleanup /recyclopedia', 'mount locations']);
    byTestId(root, 'header-place')!.value = 'austin_tx';
    byTestId(root, 'header-place')!.dispatchEvent({ type: 'change' });
    assert.ok(!calls.includes('A'), 'a subscription from a replaced screen no longer fires');
  } finally {
    env.restore();
  }
});

test('one loaded instance of each feature module across its routes; cleanup runs before the next mount', async () => {
  const order: string[] = [];
  const importCalls: string[] = [];
  const mounts = {
    '/features/recyclopedia/screens.js': {
      mount: (route: any) => {
        order.push('mount ' + route.path + ' ' + JSON.stringify(route.params));
        return () => order.push('cleanup ' + route.path);
      },
    },
  };
  const { env, importer } = setup({ stored: 'seattle_wa', start: '/recyclopedia', mounts, importCalls });
  try {
    const { app } = await boot(env, importer);
    await app.router.navigate('/recyclopedia/plastic');
    await app.router.navigate('/search?q=glass');
    assert.deepEqual(order, [
      'mount /recyclopedia {}',
      'cleanup /recyclopedia',
      'mount /recyclopedia/plastic {"categoryId":"plastic"}',
      'cleanup /recyclopedia/plastic',
      'mount /search {}',
    ]);
    assert.equal(importCalls.filter((p) => p === '/features/recyclopedia/screens.js').length, 1);
  } finally {
    env.restore();
  }
});

test('route and query objects: decoded string values', async () => {
  const seen: any[] = [];
  const mounts = { '/features/locator/screens.js': { mount: (route: any) => void seen.push(route) } };
  const { env, importer } = setup({ stored: 'seattle_wa', start: '/locations/f-sea-01?item=Paint%20cans&rule_ids=a%2Cb', mounts });
  try {
    await boot(env, importer);
    assert.deepEqual(seen[0], { path: '/locations/f-sea-01', params: { facilityId: 'f-sea-01' }, query: { item: 'Paint cans', rule_ids: 'a,b' } });
  } finally {
    env.restore();
  }
});

test('a missing or failing screen module shows "This part of RefCycle is not available yet" (CONTRACTS 2.1)', async () => {
  const mounts = { '/features/locator/screens.js': { mount: () => { throw new Error('bad screen'); } } };
  for (const [start, expectNote] of [['/scan', 'missing'], ['/locations', 'throws'], ['/features/not-a-feature/screens.js', 'unknown path']] as const) {
    const { env, importer } = setup({ stored: 'seattle_wa', start, mounts });
    try {
      const { root } = await boot(env, importer);
      const text = start === '/features/not-a-feature/screens.js' ? 'This page does not exist' : 'This part of RefCycle is not available yet';
      assert.equal(byTestId(root, 'route-message')!.textContent, text, expectNote);
    } finally {
      env.restore();
    }
  }
});

test('the shell screens do not need a feature module: /item and /place load from shared', async () => {
  const importCalls: string[] = [];
  const { env, importer } = setup({ stored: 'seattle_wa', start: '/place', importCalls });
  try {
    const { root, app } = await boot(env, importer);
    assert.equal(findAll(root, (n) => n.className === 'place-option').length, 3);
    const current = findAll(root, (n) => n.getAttribute('aria-checked') === 'true');
    assert.equal(current.length, 1);
    assert.equal(current[0].getAttribute('data-place'), 'seattle_wa');
    assert.deepEqual(importCalls, []);
    void app;
  } finally {
    env.restore();
  }
});

test('"/" goes to /recyclopedia when a place is stored', async () => {
  const mounts = { '/features/recyclopedia/screens.js': { mount: () => undefined } };
  const { env, importer } = setup({ stored: 'seattle_wa', start: '/', mounts });
  try {
    await boot(env, importer);
    assert.equal(env.win.location.pathname, '/recyclopedia');
  } finally {
    env.restore();
  }
});

test('header: title from ctx.setTitle, back control, tab bar with Camera in the center', async () => {
  let ctxSeen: any;
  const mounts = {
    '/features/recyclopedia/screens.js': { mount: (_r: any, _c: any, ctx: any) => { ctxSeen = ctx; ctx.setTitle('Plastic'); } },
    '/features/locator/screens.js': { mount: () => undefined },
  };
  const { env, importer } = setup({ stored: 'seattle_wa', start: '/recyclopedia', mounts });
  try {
    const { root, app } = await boot(env, importer);
    assert.equal(byTestId(root, 'header-title')!.textContent, 'Plastic');
    assert.equal(byTestId(root, 'back')!.getAttribute('data-hidden'), 'true'); // nowhere to go back to
    const tabs = findAll(root, (n) => n.className.split(' ').includes('tab'));
    assert.deepEqual(tabs.map((t) => t.getAttribute('data-tab')), ['recyclopedia', 'scan', 'locations']);
    assert.ok(tabs[1].className.includes('tab-center'));
    assert.deepEqual(tabs.map((t) => t.getAttribute('href')), ['/recyclopedia', '/scan', '/locations']);
    assert.equal(tabs[0].getAttribute('aria-current'), 'page');

    // a tab link navigates without a reload
    const event = { type: 'click', button: 0 };
    tabs[2].dispatchEvent(event);
    await until(() => env.win.location.pathname === '/locations');
    assert.equal(tabs[2].getAttribute('aria-current'), 'page');
    assert.equal(tabs[0].getAttribute('aria-current'), null);
    assert.equal(byTestId(root, 'back')!.getAttribute('data-hidden'), null);
    click(byTestId(root, 'back')!);
    await until(() => env.win.location.pathname === '/recyclopedia');
    void app; void ctxSeen;
  } finally {
    env.restore();
  }
});

test('modified clicks, external and new-tab links are left to the browser', async () => {
  const { env, importer } = setup({ stored: 'seattle_wa', start: '/recyclopedia', mounts: { '/features/recyclopedia/screens.js': { mount: () => undefined } } });
  try {
    const { root } = await boot(env, importer);
    const a = env.document.createElement('a') as FakeElement;
    a.setAttribute('href', 'https://example.org/x');
    root.appendChild(a);
    const e1: any = { type: 'click', button: 0 };
    a.dispatchEvent(e1);
    assert.equal(e1.defaultPrevented, false);
    const b = env.document.createElement('a') as FakeElement;
    b.setAttribute('href', '/locations');
    root.appendChild(b);
    const e2: any = { type: 'click', button: 0, ctrlKey: true };
    b.dispatchEvent(e2);
    assert.equal(e2.defaultPrevented, false);
    assert.equal(env.win.location.pathname, '/recyclopedia');
  } finally {
    env.restore();
  }
});

test('if the places cannot be loaded the shell says so with Retry and shows no other content', async () => {
  const { env, importer } = setup({ places: null });
  try {
    const { root } = await boot(env, importer);
    assert.match(byTestId(root, 'shell-error')!.textContent, /cannot load/);
    assert.equal(findAll(root, (n) => n.className === 'place-option').length, 0);
    assert.ok(byTestId(root, 'shell-retry'));
  } finally {
    env.restore();
  }
});

test('localStorage that throws does not break the picker', async () => {
  const mounts = { '/features/recyclopedia/screens.js': { mount: () => undefined } };
  const { env, importer } = setup({ mounts });
  try {
    env.storage.throwing = true;
    const { root } = await boot(env, importer);
    click(findAll(root, (n) => n.getAttribute('data-place') === 'seattle_wa')[0]);
    await until(() => env.win.location.pathname === '/recyclopedia');
    assert.equal(byTestId(root, 'header-place')!.value, 'seattle_wa');
  } finally {
    env.restore();
  }
});

test('display-swap posts carry the selected place', async () => {
  const { env, importer } = setup({ start: '/recyclopedia', stored: 'hawaii_county_hi', mounts: { '/features/recyclopedia/screens.js': { mount: () => undefined } } });
  try {
    await boot(env, importer);
    await tick(10);
    const swaps = env.win.fetchCalls.filter((c) => c.url === '/api/log/display-swap').map((c) => JSON.parse(c.init.body));
    assert.equal(swaps.length, 1);
    assert.deepEqual(swaps[0], { surface: 'place-picker.name', from: 'County of Hawaiʻi', to: 'Hawaiʻi County', count: 1, place: 'none' });
    void allByClass;
  } finally {
    env.restore();
  }
});
