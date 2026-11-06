// A very small DOM, enough for the locator screens. There is no jsdom in this project.
export class FakeNode {
  tagName = '';
  nodeType = 1;
  attrs = new Map<string, string>();
  children: FakeNode[] = [];
  parent: FakeNode | null = null;
  text = '';
  listeners = new Map<string, ((e: any) => void)[]>();
  value = '';
  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
    if (tag === '#text') this.nodeType = 3;
  }
  get firstChild() { return this.children[0] ?? null; }
  appendChild(n: FakeNode) { n.parent?.removeChild(n); n.parent = this; this.children.push(n); return n; }
  removeChild(n: FakeNode) { this.children = this.children.filter((c) => c !== n); n.parent = null; return n; }
  setAttribute(k: string, v: string) { this.attrs.set(k, String(v)); if (k === 'value') this.value = String(v); }
  getAttribute(k: string) { return this.attrs.has(k) ? this.attrs.get(k)! : null; }
  hasAttribute(k: string) { return this.attrs.has(k); }
  removeAttribute(k: string) { this.attrs.delete(k); }
  set className(v: string) { this.attrs.set('class', v); }
  get className() { return this.attrs.get('class') ?? ''; }
  get id() { return this.attrs.get('id') ?? ''; }
  get textContent(): string {
    if (this.nodeType === 3) return this.text;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(v: string) { this.children = []; if (v) this.appendChild(makeText(v)); }
  addEventListener(type: string, fn: (e: any) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  dispatch(type: string, extra: object = {}) {
    const e = { type, target: this, preventDefault() { (e as any).defaultPrevented = true; }, defaultPrevented: false, ...extra };
    for (const fn of this.listeners.get(type) ?? []) fn(e);
    return e;
  }
  click() { return this.dispatch('click'); }
  remove() { this.parent?.removeChild(this); }
}

function makeText(t: string) {
  const n = new FakeNode('#text');
  n.text = t;
  return n;
}

export function findAll(root: FakeNode, pred: (n: FakeNode) => boolean): FakeNode[] {
  const out: FakeNode[] = [];
  const walk = (n: FakeNode) => {
    if (n.nodeType === 1 && pred(n)) out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}
export const byClass = (root: FakeNode, cls: string) => findAll(root, (n) => n.className.split(/\s+/).includes(cls));
export const byTag = (root: FakeNode, tag: string) => findAll(root, (n) => n.tagName === tag.toUpperCase());
export const byText = (root: FakeNode, tag: string, text: string) => findAll(root, (n) => n.tagName === tag.toUpperCase() && n.textContent === text);

export function installDom() {
  const head = new FakeNode('head');
  const body = new FakeNode('body');
  const doc = {
    head,
    body,
    createElement: (t: string) => new FakeNode(t),
    createTextNode: (t: string) => makeText(t),
    getElementById: (id: string) => findAll(head, (n) => n.id === id)[0] ?? findAll(body, (n) => n.id === id)[0] ?? null,
  };
  (globalThis as any).document = doc;
  const urls: string[] = [];
  const history = { state: null, replaceState: (_s: unknown, _t: string, url: string) => { urls.push(url); } };
  (globalThis as any).history = history;
  return { doc, head, body, urls };
}

export function resetDom() {
  delete (globalThis as any).document;
  delete (globalThis as any).history;
  delete (globalThis as any).L;
}
