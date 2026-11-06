// Recyclopedia screens: landing, material page and search (RC-1 to RC-3, RC-9).
import { getCatalog } from '/shared/api.js';
import { clear, el, link } from '/shared/dom.js';
import { icon } from '/shared/icons.js';
import { askHref, filterEntries, submitTarget } from './search.js';

function entryRow(entry, ctx) {
  return el(
    'li',
    null,
    el('a', { href: `/item?entry=${encodeURIComponent(entry.id)}`, 'data-link': '', class: 'entry-row', 'data-entry': entry.id }, el('span', null, ctx.displayText(entry.name, 'recyclopedia.entry')), icon('chevron-right')),
  );
}

function searchBox({ value, entries, ctx, onInput, navigate }) {
  const input = el('input', { class: 'text-input search-input', type: 'search', name: 'q', id: 'catalog-search', placeholder: 'Search items and materials', autocomplete: 'off', maxlength: '2000', value, 'aria-label': 'Search items and materials' });
  input.value = value || '';
  const form = el(
    'form',
    {
      class: 'search-form',
      role: 'search',
      onsubmit: (ev) => {
        ev.preventDefault();
        const target = submitTarget(entries, input.value);
        if (target) navigate(target);
      },
    },
    input,
    el('button', { class: 'button search-button', type: 'submit', 'aria-label': 'Search' }, icon('magnifying-glass')),
  );
  input.addEventListener('input', () => onInput(input.value));
  return { form, input };
}

function results(entries, text, ctx) {
  const matches = filterEntries(entries, text);
  const list = el('ul', { class: 'entry-list', 'data-role': 'results' }, matches.map((e) => entryRow(e, ctx)));
  const wrap = el('div', { class: 'results' });
  if (!matches.length) wrap.append(el('p', { class: 'muted', role: 'status' }, `No catalog entry matches “${text.trim()}”.`));
  else wrap.append(list);
  wrap.append(el('p', null, el('a', { href: askHref(text), 'data-link': '', class: 'ask-link' }, `Ask RefCycle about “${text.trim()}”`)));
  return wrap;
}

function errorState(retry) {
  return el('div', { class: 'state-error', role: 'alert' }, el('h2', { class: 'screen-title' }, 'No answer available right now'), el('p', null, 'The Recyclopedia list could not be loaded.'), el('button', { class: 'button', type: 'button', onclick: retry }, icon('arrow-path'), 'Retry'));
}

export async function mount(route, container, ctx) {
  let gone = false;
  const draw = async () => {
    clear(container);
    let catalog;
    try {
      catalog = await getCatalog();
    } catch {
      if (!gone) container.append(errorState(draw));
      ctx.setTitle('Recyclopedia');
      return;
    }
    if (gone) return;
    const { categories, entries } = catalog;
    const body = el('div', { class: 'recyclopedia' });
    const dynamic = el('div', { class: 'dynamic' });

    if (route.name === 'search') {
      const text = route.query.q ?? '';
      ctx.setTitle('Search');
      const box = searchBox({ value: text, entries, ctx, onInput: (v) => paint(v), navigate: ctx.navigate });
      body.append(box.form, dynamic);
      const paint = (v) => {
        clear(dynamic);
        if (v.trim()) dynamic.append(results(entries, v, ctx));
      };
      paint(text);
    } else if (route.name === 'category') {
      const cat = categories.find((c) => c.id === route.params.categoryId);
      if (!cat) {
        ctx.setTitle('Not found');
        body.append(el('h2', { class: 'screen-title' }, 'We could not find that material'), link('/recyclopedia', 'Back to Recyclopedia'));
      } else {
        ctx.setTitle(cat.name);
        const own = entries.filter((e) => e.category === cat.id);
        const list = () => el('ul', { class: 'entry-list', 'data-role': 'entries' }, own.map((e) => entryRow(e, ctx)));
        const paint = (v) => {
          clear(dynamic);
          if (!v.trim()) return dynamic.append(list());
          const inCat = own.filter((e) => e.name.toLowerCase().includes(v.trim().toLowerCase()));
          if (inCat.length) dynamic.append(el('ul', { class: 'entry-list', 'data-role': 'entries' }, inCat.map((e) => entryRow(e, ctx))));
          else dynamic.append(el('p', { class: 'muted', role: 'status' }, `No ${cat.name.toLowerCase()} entry matches “${v.trim()}”.`));
          dynamic.append(el('p', null, el('a', { href: askHref(v), 'data-link': '', class: 'ask-link' }, `Ask RefCycle about “${v.trim()}”`)));
        };
        const box = searchBox({ value: '', entries, ctx, onInput: paint, navigate: ctx.navigate });
        body.append(el('h2', { class: 'screen-title' }, cat.name), box.form, dynamic);
        paint('');
      }
    } else {
      ctx.setTitle('Recyclopedia');
      const grid = () =>
        el('ul', { class: 'card-grid', 'data-role': 'categories' }, categories.map((c) => el('li', null, el('a', { href: `/recyclopedia/${encodeURIComponent(c.id)}`, 'data-link': '', class: 'category-card', 'data-category': c.id }, el('span', null, c.name)))));
      const paint = (v) => {
        clear(dynamic);
        if (!v.trim()) return dynamic.append(grid());
        dynamic.append(results(entries, v, ctx));
      };
      const box = searchBox({ value: '', entries, ctx, onInput: paint, navigate: ctx.navigate });
      body.append(el('h2', { class: 'screen-title' }, 'What would you like to recycle?'), box.form, dynamic);
      paint('');
    }
    container.append(body);
  };
  await draw();
  return () => {
    gone = true;
  };
}
