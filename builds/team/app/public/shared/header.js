// Header on every screen: back control, title, place picker (CONTRACTS section 10).
import { el } from './dom.js';
import { icon } from './icons.js';

export function createHeader({ onBack, onPlace }) {
  const back = el('button', { type: 'button', class: 'back', 'aria-label': 'Back', 'data-testid': 'back', on: { click: () => onBack() } }, icon('arrow-long-left'));
  const title = el('h1', { class: 'header-title', 'data-testid': 'header-title' });
  const select = el('select', {
    class: 'place-select',
    'aria-label': 'Place',
    'data-testid': 'header-place',
    on: { change: (event) => onPlace(event.target.value) },
  });
  select.hidden = true;
  const root = el('header', { class: 'header' }, back, title, select);

  return {
    root,
    setTitle(text) {
      title.textContent = text;
    },
    setBackVisible(visible) {
      if (visible) back.removeAttribute('data-hidden');
      else back.setAttribute('data-hidden', 'true');
    },
    /** `places` are { id, name } with names already through displayText. No selection when `selected` is null. */
    setPlaces(places, selected) {
      select.replaceChildren(
        ...places.map((p) => {
          const option = el('option', { value: p.id, text: p.name });
          if (p.id === selected) option.setAttribute('selected', '');
          return option;
        }),
      );
      select.value = selected || '';
      select.hidden = !selected;
    },
  };
}
