// Tiny DOM helpers. Text always goes in with textContent, never as HTML (engine, pack and CSV strings are untrusted).

/** el('div', { class: 'x', onclick: fn, 'aria-label': 'y' }, 'text', childNode, ...) */
export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
}

export function clear(node) {
  node.replaceChildren();
}

/** An internal link that the router handles without a page load. */
export function link(href, text, attrs) {
  return el('a', { href, 'data-link': '', ...attrs }, text);
}

/** An external link; only http and https are ever linked. Returns a plain span otherwise. */
export function externalLink(href, text, attrs) {
  let ok = false;
  try {
    const u = new URL(href);
    ok = u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    ok = false;
  }
  if (!ok) return el('span', attrs, text);
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer', ...attrs }, text);
}

export function sourceHost(href) {
  try {
    return new URL(href).host.replace(/^www\./, '');
  } catch {
    return href;
  }
}
