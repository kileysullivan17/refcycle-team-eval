// A tiny DOM, enough to run screens.js in Node without a browser or an extra dependency.
type Listener = (e: any) => void;

export class FakeNode {
  nodeName = '';
  parent: FakeNode | null = null;
  children: FakeNode[] = [];
  attrs = new Map<string, string>();
  listeners = new Map<string, Listener[]>();
  hidden = false;
  disabled = false;
  value = '';
  files: any[] = [];
  className = '';
  srcObject: unknown = null;
  muted = false;
  text = '';
  constructor(name: string) { this.nodeName = name; }
  get textContent(): string { return this.text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v: string) { this.children = []; this.text = v; }
  append(...kids: any[]) { for (const k of kids) { if (typeof k === 'string') { const t = new FakeNode('#text'); t.text = k; this.children.push(t); t.parent = this; } else { k.parent = this; this.children.push(k); } } }
  appendChild(k: FakeNode) { this.append(k); return k; }
  replaceChildren(...kids: any[]) { this.children = []; this.text = ''; this.append(...kids); }
  setAttribute(k: string, v: string) { this.attrs.set(k, String(v)); if (k === 'class') this.className = String(v); }
  getAttribute(k: string) { return this.attrs.has(k) ? this.attrs.get(k)! : null; }
  addEventListener(t: string, fn: Listener) { this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn]); }
  removeEventListener() {}
  async fire(t: string, extra: any = {}) { for (const fn of this.listeners.get(t) ?? []) await fn({ type: t, target: this, preventDefault() {}, ...extra }); }
  async click() { if (this.disabled) return; await this.fire('click'); }
  play() { return Promise.resolve(); }
  querySelector(sel: string) { return find(this, sel); }
  getVideoTracks() { return []; }
}

function matches(n: FakeNode, sel: string): boolean {
  const m = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
  if (m) return n.getAttribute(m[1]) === m[2];
  return n.nodeName === sel;
}
export function find(root: FakeNode, sel: string): FakeNode | null {
  for (const c of root.children) { if (matches(c, sel)) return c; const r = find(c, sel); if (r) return r; }
  return null;
}
export function findAll(root: FakeNode, sel: string, out: FakeNode[] = []): FakeNode[] {
  for (const c of root.children) { if (matches(c, sel)) out.push(c); findAll(c, sel, out); }
  return out;
}
export const role = (root: FakeNode, r: string) => find(root, `[data-role="${r}"]`);
export const roles = (root: FakeNode, r: string) => findAll(root, `[data-role="${r}"]`);
// Visible means neither the node nor any ancestor is hidden.
export function visible(n: FakeNode | null): boolean {
  for (let c = n; c; c = c.parent) if (c.hidden) return false;
  return !!n;
}
export function allText(root: FakeNode): string { return root.textContent; }
export function allNodes(root: FakeNode, out: FakeNode[] = []): FakeNode[] { for (const c of root.children) { out.push(c); allNodes(c, out); } return out; }

export function makeDocument() {
  const head = new FakeNode('head');
  const doc: any = {
    head,
    createElement: (n: string) => new FakeNode(n),
    createElementNS: (_ns: string, n: string) => new FakeNode(n),
    createTextNode: (t: string) => { const n = new FakeNode('#text'); n.text = t; return n; },
    querySelector: (sel: string) => find(head, sel),
  };
  return doc;
}

export interface FakeTrack { stopped: boolean; stop(): void; getCapabilities?: () => any; applyConstraints?: (c: any) => Promise<void>; kind: string }
export function makeStream(opts: { torch?: boolean } = {}) {
  const track: FakeTrack & { constraints: any[] } = {
    stopped: false, kind: 'video', constraints: [],
    stop() { this.stopped = true; },
    getCapabilities: opts.torch ? () => ({ torch: true }) : () => ({}),
    applyConstraints: async function (c: any) { this.constraints.push(c); },
  } as any;
  return { track, getTracks: () => [track], getVideoTracks: () => [track] };
}
