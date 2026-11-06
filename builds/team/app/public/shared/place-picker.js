// The place picker screen (X-1). Shown on first use and at /place. Exactly the places the engine lists;
// nothing is preselected on first use, and no device location is read.
import { el, clear } from './dom.js';

export function mount(route, container, ctx, shell) {
  ctx.setTitle('Choose your place');
  const current = ctx.place || null;
  const list = el(
    'ul',
    { class: 'place-list', role: 'radiogroup', 'aria-label': 'Place', 'data-testid': 'place-list' },
    ...ctx.places.map((place) =>
      el(
        'li',
        null,
        el(
          'button',
          {
            type: 'button',
            class: 'place-option',
            role: 'radio',
            'aria-checked': place.id === current ? 'true' : 'false',
            'data-place': place.id,
            on: { click: () => shell.choosePlace(place.id) },
          },
          place.name,
        ),
      ),
    ),
  );
  clear(container);
  container.appendChild(
    el(
      'div',
      { class: 'picker' },
      el('h2', { class: 'picker-title', text: 'Where do you recycle?' }),
      el('p', { class: 'picker-note', text: 'Rules are different in each place. Choose one to see its answers.' }),
      list,
    ),
  );
  return undefined;
}
