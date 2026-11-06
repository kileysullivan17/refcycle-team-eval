// Bottom tab bar (Figma "Iteration tab Bar", G17): Recyclopedia, Camera (center button), Locations.
import { el } from './dom.js';
import { icon } from './icons.js';

const TABS = [
  { id: 'recyclopedia', label: 'Recyclopedia', href: '/recyclopedia', icon: 'book-open', match: (p) => p.startsWith('/recyclopedia') || p === '/search' },
  { id: 'scan', label: 'Camera', href: '/scan', icon: 'camera', match: (p) => p.startsWith('/scan'), center: true },
  { id: 'locations', label: 'Locations', href: '/locations', icon: 'map-pin', match: (p) => p.startsWith('/locations') },
];

export function createTabBar() {
  const links = TABS.map((tab) =>
    el(
      'a',
      { href: tab.href, class: tab.center ? 'tab tab-center' : 'tab', 'data-tab': tab.id, 'aria-label': tab.label },
      icon(tab.icon),
      el('span', { class: 'tab-label', text: tab.label }),
    ),
  );
  const root = el('nav', { class: 'tabbar', 'aria-label': 'Main' }, ...links);
  return {
    root,
    setActive(path) {
      TABS.forEach((tab, i) => {
        if (tab.match(path)) links[i].setAttribute('aria-current', 'page');
        else links[i].removeAttribute('aria-current');
      });
    },
  };
}
