// The shared item page (CON-1, CONTRACTS section 8). Recyclopedia and Camera scan both open it.
// It renders exactly one state, driven only by the engine's `behavior` and `stream` (RC-5, X-6).
// It writes no recycling text of its own: every sentence about disposal is the engine's, or a pack's
// `where` text from /api/sites, passed through displayText and inserted with textContent.
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { askEngine, fetchWhere } from './api.js';
import { loadCatalog } from './catalog.js';
import { STREAM_LABELS, cardStateFor } from './streams.js';

export const ERROR_TEXT = 'No answer available right now';
export const ABSTAIN_TEXT = "We don't know";

function safeHref(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Dispose shows on card-red, on card-blue for deposit_return, and on conditional with such a case (G19). */
export function showsDispose(answer) {
  if (answer.behavior === 'answer') {
    return answer.stream === 'drop_off_special' || answer.stream === 'deposit_return';
  }
  if (answer.behavior === 'conditional') {
    return answer.conditions.some((c) => c.stream === 'drop_off_special' || c.stream === 'deposit_return');
  }
  return false;
}

export function disposeHref(query, ruleIds) {
  return '/locations?item=' + encodeURIComponent(query) + '&rule_ids=' + ruleIds.map(encodeURIComponent).join(',');
}

/** The state name for an engine answer, from CONTRACTS section 8. */
export function stateFor(answer) {
  if (answer.behavior === 'answer') return cardStateFor(answer.stream);
  if (answer.behavior === 'clarify') return 'referee-check-clarify';
  if (answer.behavior === 'conditional') return 'referee-check-conditional';
  return 'referee-check-abstain';
}

export function mount(route, container, ctx, deps = {}) {
  const ask = deps.askEngine || askEngine;
  const getWhere = deps.fetchWhere || fetchWhere;
  const getCatalog = deps.loadCatalog || loadCatalog;
  const t = (text, surface) => ctx.displayText(text, surface);

  const entryId = route.query.entry;
  const typed = (route.query.q || '').trim();

  let disposed = false;
  let run = 0; // a newer request makes older results stale
  let controller = null;
  let currentQuery = null; // the query as last sent; a clarify reply extends it (G20)

  const page = el('div', { class: 'item', 'aria-live': 'polite' });
  container.appendChild(page);

  function setState(state, ...children) {
    clear(page);
    page.setAttribute('data-state', state);
    for (const child of children) if (child) page.appendChild(child);
  }

  function showLoading(query) {
    ctx.setTitle(query);
    setState(
      'loading',
      el('p', { class: 'item-query', 'data-testid': 'loading-query', text: query }),
      el('p', { class: 'spinner', role: 'status', 'aria-label': 'Loading' }, icon('arrow-path', 'spin')),
    );
  }

  function showError() {
    ctx.setTitle('Item');
    setState(
      'error',
      el('p', { class: 'item-error', 'data-testid': 'error-message', text: ERROR_TEXT }),
      el('button', { type: 'button', class: 'button', 'data-testid': 'retry', on: { click: () => begin() } }, 'Retry'),
    );
  }

  function list(className, items, surface) {
    return el('ul', { class: className }, ...items.map((text) => el('li', { text: t(text, surface) })));
  }

  function renderAnswer(answer, query) {
    const title = answer.item_interpreted ? t(answer.item_interpreted, 'item.title') : '';
    ctx.setTitle(title || query);

    const parts = [];
    const state = stateFor(answer);

    if (answer.behavior === 'answer') {
      parts.push(
        el(
          'section',
          { class: 'card ' + state, 'data-testid': 'verdict-card', 'data-stream': answer.stream },
          el('p', { class: 'card-label', text: STREAM_LABELS[answer.stream] }),
        ),
      );
    } else if (answer.behavior === 'clarify') {
      const input = el('input', {
        type: 'text',
        class: 'text-input',
        name: 'reply',
        'aria-label': 'Your reply',
        maxlength: String(Math.max(1, 2000 - query.length - 1)),
        autocomplete: 'off',
        'data-testid': 'clarify-input',
      });
      const send = el('button', { type: 'submit', class: 'button', 'data-testid': 'clarify-send' }, 'Send');
      const submit = (event) => {
        if (event && event.preventDefault) event.preventDefault();
        const reply = input.value.trim();
        if (!reply) return;
        begin(query + ' ' + reply);
      };
      parts.push(
        el(
          'section',
          { class: 'referee', 'data-testid': 'referee' },
          el('h2', { class: 'referee-title', text: 'Referee check' }),
          el('p', { class: 'referee-question', 'data-testid': 'clarify-question', text: t(answer.clarifying_question, 'item.clarifying_question') }),
          el('form', { class: 'reply-form', on: { submit } }, input, send),
        ),
      );
    } else if (answer.behavior === 'conditional') {
      parts.push(
        el(
          'section',
          { class: 'referee', 'data-testid': 'referee' },
          el('h2', { class: 'referee-title', text: 'Referee check' }),
          el(
            'ul',
            { class: 'cases', 'data-testid': 'cases' },
            ...answer.conditions.map((c) =>
              el(
                'li',
                { class: 'case', 'data-stream': c.stream },
                el('p', { class: 'case-if', text: t(c.if, 'item.condition') }),
                el('p', { class: 'case-stream', text: STREAM_LABELS[c.stream] }),
              ),
            ),
          ),
        ),
      );
    } else {
      parts.push(
        el(
          'section',
          { class: 'referee', 'data-testid': 'referee' },
          el('h2', { class: 'referee-title', text: 'Referee check' }),
          el('p', { class: 'referee-abstain', 'data-testid': 'abstain-message', text: ABSTAIN_TEXT }),
        ),
      );
    }

    if (answer.prep.length) {
      parts.push(el('section', { class: 'block', 'data-testid': 'prep' }, el('h2', { class: 'block-title', text: 'Prep' }), list('plain-list', answer.prep, 'item.prep')));
    }

    parts.push(
      el(
        'section',
        { class: 'block' },
        el('h2', { class: 'block-title', text: 'Explanation' }),
        el('p', { class: 'explanation', 'data-testid': 'explanation', text: t(answer.explanation, 'item.explanation') }),
      ),
    );

    const where = el('section', { class: 'block', hidden: true, 'data-testid': 'where' });
    parts.push(where);

    const links = answer.source_urls.map((u) => {
      const href = safeHref(u);
      return el('li', null, href ? el('a', { href, target: '_blank', rel: 'noopener noreferrer', text: u }) : el('span', { text: u }));
    });
    if (links.length) {
      parts.push(
        el(
          'section',
          { class: 'block', 'data-testid': 'sources' },
          el('h2', { class: 'block-title', text: answer.behavior === 'abstain' ? 'Official source' : 'Sources' }),
          el('ul', { class: 'plain-list' }, ...links),
        ),
      );
    }

    if (showsDispose(answer)) {
      parts.push(
        el('a', { class: 'button button-dispose', href: disposeHref(query, answer.rule_ids), 'data-testid': 'dispose' }, 'Dispose'),
      );
    }

    setState(state, ...parts);

    if ((answer.behavior === 'answer' || answer.behavior === 'conditional') && answer.rule_ids.length) {
      const mine = run;
      getWhere({ place: ctx.place, ruleIds: answer.rule_ids, signal: controller ? controller.signal : undefined }).then((texts) => {
        if (disposed || mine !== run || !texts || !texts.length) return; // hide the block on any failure
        where.appendChild(el('h2', { class: 'block-title', text: 'Where' }));
        where.appendChild(list('plain-list', texts, 'item.where'));
        where.removeAttribute('hidden');
      });
    }
  }

  function send(query) {
    run += 1;
    const mine = run;
    if (controller) controller.abort();
    controller = new AbortController();
    currentQuery = query;
    showLoading(query);
    ask({ place: ctx.place, query, signal: controller.signal }).then((result) => {
      if (disposed || mine !== run) return;
      if (!result.ok) showError();
      else renderAnswer(result.answer, query);
    });
  }

  // Resolves the query for this route, then asks. Retry runs it again.
  function begin(overrideQuery) {
    if (overrideQuery) return send(overrideQuery);
    if (currentQuery) return send(currentQuery);
    if (entryId) {
      run += 1;
      const mine = run;
      showLoading('');
      getCatalog().then(
        (catalog) => {
          if (disposed || mine !== run) return;
          const entry = catalog.entries.find((e) => e.id === entryId);
          if (entry) send(entry.query);
          else showError();
        },
        () => {
          if (!disposed && mine === run) showError();
        },
      );
      return undefined;
    }
    if (typed) return send(typed);
    ctx.navigate('/recyclopedia');
    return undefined;
  }

  const unsubscribe = ctx.onPlaceChange(() => {
    if (currentQuery) send(currentQuery); // X-9
  });

  begin();

  return () => {
    disposed = true;
    run += 1;
    if (controller) controller.abort();
    if (unsubscribe) unsubscribe();
  };
}
