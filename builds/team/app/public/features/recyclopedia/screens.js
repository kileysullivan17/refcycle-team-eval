// Recyclopedia screens: landing (category cards), material page (a category's entries) and search.
// The catalog says what can be asked. It never says what the answer is: the item page asks the engine.
import { el, clear } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { loadCatalog } from '../../shared/catalog.js';
import { searchEntries, freeQuestionHref, entryHref } from './search.js';

function entryRow(entry, categoryName) {
  return el(
    'li',
    null,
    el(
      'a',
      { class: 'entry-row', href: entryHref(entry), 'data-entry': entry.id },
      el('span', { class: 'entry-name', text: entry.name }),
      categoryName ? el('span', { class: 'entry-category', text: categoryName }) : null,
    ),
  );
}

export function mount(route, container, ctx, deps = {}) {
  const getCatalog = deps.loadCatalog || loadCatalog;
  let disposed = false;
  clear(container);
  const shell = el('div', { class: 'recyclopedia' });
  container.appendChild(shell);

  function showError() {
    clear(shell);
    shell.appendChild(
      el(
        'div',
        { class: 'message', 'data-testid': 'catalog-error' },
        el('p', { text: 'The Recyclopedia could not be loaded' }),
        el('button', { type: 'button', class: 'button', on: { click: () => start() } }, 'Retry'),
      ),
    );
  }

  function start() {
    clear(shell);
    shell.appendChild(el('p', { class: 'message', text: 'Loading' }));
    getCatalog().then(
      (catalog) => {
        if (!disposed) build(catalog);
      },
      () => {
        if (!disposed) showError();
      },
    );
  }

  function build(catalog) {
    const isSearch = route.path === '/search';
    const categoryId = route.params && route.params.categoryId;
    const category = categoryId ? catalog.categories.find((c) => c.id === categoryId) : null;
    const categoryName = (id) => (catalog.categories.find((c) => c.id === id) || {}).name || '';

    clear(shell);
    if (categoryId && !category) {
      ctx.setTitle('Recyclopedia');
      shell.appendChild(el('p', { class: 'message', 'data-testid': 'no-category', text: 'This category does not exist' }));
      return;
    }
    ctx.setTitle(category ? category.name : isSearch ? 'Search' : 'Recyclopedia');

    const input = el('input', {
      type: 'search',
      class: 'text-input',
      name: 'q',
      placeholder: 'Search',
      'aria-label': 'Search the Recyclopedia',
      autocomplete: 'off',
      enterkeyhint: 'search',
      'data-testid': 'search-input',
      value: isSearch ? route.query.q || '' : '',
    });
    const results = el('ul', { class: 'entry-list', 'data-testid': 'results' });
    const noMatch = el('div', { class: 'no-match', 'data-testid': 'no-match', hidden: true });
    const browse = el('div', { class: 'browse' });

    if (category) {
      browse.appendChild(
        el('ul', { class: 'entry-list', 'data-testid': 'category-entries' },
          ...catalog.entries.filter((e) => e.category === category.id).map((e) => entryRow(e, ''))),
      );
    } else if (!isSearch) {
      browse.appendChild(
        el('ul', { class: 'category-grid', 'data-testid': 'categories' },
          ...catalog.categories.map((c) =>
            el('li', null, el('a', { class: 'category-card', href: '/recyclopedia/' + encodeURIComponent(c.id), 'data-category': c.id, text: c.name })))),
      );
    }

    // Filters as the resident types. Text always searches the whole catalog.
    function refresh() {
      const text = input.value.trim();
      const active = text !== '';
      browse.hidden = active;
      results.hidden = !active;
      clear(results);
      clear(noMatch);
      noMatch.hidden = true;
      if (!active) return;
      const found = searchEntries(catalog.entries, text);
      for (const entry of found) results.appendChild(entryRow(entry, categoryName(entry.category)));
      if (!found.length) {
        noMatch.hidden = false;
        noMatch.appendChild(el('p', { text: 'Nothing in the catalog matches this search' }));
        noMatch.appendChild(el('a', { class: 'button', href: freeQuestionHref(text), 'data-testid': 'ask-link' }, 'Ask about this'));
      }
    }

    const form = el(
      'form',
      {
        class: 'search-form',
        role: 'search',
        on: {
          submit: (event) => {
            if (event && event.preventDefault) event.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            const found = searchEntries(catalog.entries, text);
            if (!found.length) ctx.navigate(freeQuestionHref(text)); // RC-9
            else if (!isSearch) ctx.navigate('/search?q=' + encodeURIComponent(text));
          },
        },
      },
      input,
      el('button', { type: 'submit', class: 'search-button', 'aria-label': 'Search' }, icon('magnifying-glass')),
    );
    input.addEventListener('input', refresh);

    shell.appendChild(form);
    shell.appendChild(browse);
    shell.appendChild(results);
    shell.appendChild(noMatch);
    refresh();
  }

  start();
  return () => {
    disposed = true;
  };
}
