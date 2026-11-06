// The shared item page (CON-1): one screen for Recyclopedia entries, free-text search and Camera scan.
import { ask, getCatalog, getSites, isAbort } from './api.js';
import { append, clear, el, externalLink, link, sourceHost } from './dom.js';
import { icon } from './icons.js';
import { clarifyQuery, disposeHref, showDispose, stateFor, streamLabel, titleFor } from './item-model.js';

const CARD = {
  'card-blue': { cls: 'verdict-card--blue', icon: 'flag' },
  'card-yellow': { cls: 'verdict-card--yellow', icon: 'flag' },
  'card-red': { cls: 'verdict-card--red', icon: 'flag' },
};

export async function mountItem(route, container, ctx) {
  const { entry, q } = route.query;
  let baseQuery = null;
  let sentQuery = null;
  let controller = null;
  let gone = false;

  const root = el('section', { class: 'item-page' });
  container.append(root);
  ctx.setTitle('Item');

  async function resolveQuery() {
    if (entry) {
      const catalog = await getCatalog();
      const found = catalog.entries.find((e) => e.id === entry);
      return found ? found.query : null;
    }
    const text = (q ?? '').trim();
    return text ? text.slice(0, 2000) : null;
  }

  function showLoading(query) {
    clear(root);
    root.append(
      el(
        'div',
        { class: 'loading', role: 'status' },
        el('span', { class: 'spinner', 'aria-hidden': 'true' }),
        el('p', { class: 'loading-text' }, `Checking the local rules for “${ctx.displayText(query, 'item.query')}”`),
      ),
    );
  }

  function showError(retry) {
    clear(root);
    ctx.setTitle('No answer');
    root.append(
      el(
        'div',
        { class: 'state-error', role: 'alert' },
        el('h2', { class: 'screen-title' }, 'No answer available right now'),
        el('p', null, 'RefCycle could not get an answer from the local rules. It will not guess.'),
        el('button', { class: 'button', type: 'button', onclick: retry }, icon('arrow-path'), 'Retry'),
      ),
    );
  }

  function showMissing() {
    clear(root);
    ctx.setTitle('Not found');
    root.append(
      el(
        'div',
        { class: 'state-error' },
        el('h2', { class: 'screen-title' }, 'We could not find that item'),
        el('p', null, link('/recyclopedia', 'Back to Recyclopedia')),
      ),
    );
  }

  async function request(query) {
    controller?.abort();
    controller = new AbortController();
    const mine = controller;
    sentQuery = query;
    showLoading(query);
    try {
      const answer = await ask(ctx.place, query, mine.signal);
      if (gone || mine.signal.aborted) return;
      render(answer, query);
    } catch (error) {
      if (gone || isAbort(error)) return;
      showError(() => request(query));
    }
  }

  function render(a, query) {
    const state = stateFor(a);
    const title = ctx.displayText(titleFor(a, query), 'item.title');
    ctx.setTitle(title);
    clear(root);

    root.append(el('h2', { class: 'screen-title item-title' }, title));

    if (CARD[state]) {
      const label = streamLabel(a.stream);
      root.append(
        el('div', { class: `verdict-card ${CARD[state].cls}`, 'data-state': state }, icon(CARD[state].icon), el('p', { class: 'verdict-label' }, label)),
      );
    } else {
      root.append(refereeCheck(a, state, query));
    }

    if (a.prep.length) {
      root.append(
        el('section', { class: 'block' }, el('h3', { class: 'block-title' }, 'Preparation'), el('ul', { class: 'plain-list' }, a.prep.map((p) => el('li', null, ctx.displayText(p, 'item.prep'))))),
      );
    }

    const whereSlot = el('section', { class: 'block', hidden: true, 'data-slot': 'where' });
    root.append(whereSlot);
    loadWhere(a, whereSlot);

    root.append(
      el(
        'section',
        { class: 'block' },
        el('h3', { class: 'block-title' }, 'From the local rules'),
        el('p', { class: 'explanation', 'data-field': 'explanation' }, ctx.displayText(a.explanation, 'item.explanation')),
      ),
    );

    const heading = a.behavior === 'abstain' ? 'Official source' : 'Sources';
    root.append(
      el(
        'section',
        { class: 'block' },
        el('h3', { class: 'block-title' }, heading),
        el('ul', { class: 'plain-list sources' }, a.source_urls.map((u) => el('li', null, externalLink(u, sourceHost(u), { class: 'source-link' })))),
      ),
    );

    // Upcycle stays hidden (Q21). Dispose opens the locator for this item (CON-2).
    if (showDispose(a)) {
      root.append(el('div', { class: 'actions' }, link(disposeHref(query, a), 'Dispose', { class: 'button', 'data-action': 'dispose' })));
    }
  }

  function refereeCheck(a, state, query) {
    const panel = el('div', { class: 'referee on-sand', 'data-state': state });
    panel.append(el('p', { class: 'referee-kicker' }, 'Referee check'));
    if (state === 'referee-check-clarify') {
      const input = el('input', { class: 'text-input', id: 'clarify-reply', type: 'text', maxlength: '500', autocomplete: 'off', required: true });
      const note = el('p', { class: 'form-note', role: 'status' });
      panel.append(
        el('p', { class: 'referee-title' }, 'One more detail, please'),
        el(
          'form',
          {
            class: 'clarify-form',
            onsubmit: (ev) => {
              ev.preventDefault();
              const next = clarifyQuery(sentQuery, input.value);
              if (!next) {
                note.textContent = input.value.trim() ? 'That reply is too long. Please shorten it.' : 'Type a reply first.';
                return;
              }
              request(next);
            },
          },
          el('label', { for: 'clarify-reply', class: 'clarify-question' }, ctx.displayText(a.clarifying_question, 'item.clarifying_question')),
          input,
          el('button', { class: 'button', type: 'submit' }, 'Send'),
          note,
        ),
      );
    } else if (state === 'referee-check-conditional') {
      panel.append(
        el('p', { class: 'referee-title' }, 'It depends'),
        el(
          'ul',
          { class: 'plain-list cases' },
          a.conditions.map((c) =>
            el('li', { class: 'case' }, el('span', { class: 'case-if' }, ctx.displayText(c.if, 'item.condition')), ' ', el('span', { class: 'case-stream' }, streamLabel(c.stream))),
          ),
        ),
      );
    } else {
      panel.append(el('p', { class: 'referee-title' }, "We don't know"), el('p', null, 'The local rules do not cover this item, so RefCycle will not guess.'));
    }
    return panel;
  }

  async function loadWhere(a, slot) {
    if (a.behavior === 'abstain' || a.rule_ids.length === 0) return;
    try {
      const sites = await getSites(ctx.place, { ruleIds: a.rule_ids, signal: controller?.signal });
      if (gone) return;
      const seen = new Set();
      const items = [];
      for (const r of sites.rules) {
        if (!r.where || seen.has(r.where)) continue;
        seen.add(r.where);
        items.push(el('li', null, ctx.displayText(r.where, 'item.where')));
      }
      if (!items.length) return;
      slot.append(el('h3', { class: 'block-title' }, 'Where to take it'), el('ul', { class: 'plain-list' }, items));
      slot.hidden = false;
    } catch {
      /* the block stays hidden when the route is absent or fails */
    }
  }

  async function start() {
    let query;
    try {
      query = await resolveQuery();
    } catch {
      return showError(start);
    }
    if (gone) return;
    if (!query) return showMissing();
    baseQuery = query;
    request(query);
  }

  const unsubscribe = ctx.onPlaceChange(() => {
    if (baseQuery) request(baseQuery); // X-9: a new place re-asks the original question
  });
  start();

  return () => {
    gone = true;
    controller?.abort();
    unsubscribe();
  };
}
