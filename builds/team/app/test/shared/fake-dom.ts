// A very small DOM, just enough for the app's client modules (which use only createElement,
// textContent, attributes, listeners and a few element properties). It lets tests render the real
// client code in Node with no browser. Text is read back with textContent, as in a browser.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

type Listener = (event: any) => void;

export class FakeNode {
  parentNode: FakeNode | null = null;
  childNodes: FakeNode[] = [];
  listeners = new Map<string, Listener[]>();
  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join('');
  }
  set textContent(value: string) {
    this.childNodes.forEach((c) => (c.parentNode = null));
    this.childNodes = String(value) === '' ? [] : [new FakeText(String(value), this)];
  }
  appendChild<T extends FakeNode>(child: T): T {
    if (child.parentNode) child.parentNode.childNodes = child.parentNode.childNodes.filter((c) => c !== child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  replaceChildren(...nodes: FakeNode[]): void {
    this.childNodes.forEach((c) => (c.parentNode = null));
    this.childNodes = [];
    nodes.forEach((n) => this.appendChild(n));
  }
  remove(): void {
    if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this);
    this.parentNode = null;
  }
  addEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn));
  }
  dispatchEvent(event: any): boolean {
    event.target ??= this;
    event.defaultPrevented ??= false;
    event.preventDefault ??= () => {
      event.defaultPrevented = true;
    };
    let node: FakeNode | null = this;
    while (node) {
      for (const fn of node.listeners.get(event.type) ?? []) fn(event);
      node = node.parentNode;
    }
    return !event.defaultPrevented;
  }
}

export class FakeText extends FakeNode {
  constructor(public data: string, parent?: FakeNode) {
    super();
    if (parent) this.parentNode = parent;
  }
  override get textContent(): string {
    return this.data;
  }
  override set textContent(v: string) {
    this.data = v;
  }
}

export class FakeElement extends FakeNode {
  attributes = new Map<string, string>();
  value = '';
  constructor(public tagName: string, public namespace: string | null = null) {
    super();
  }
  get children(): FakeElement[] {
    return this.childNodes.filter((c): c is FakeElement => c instanceof FakeElement);
  }
  get className(): string {
    return this.attributes.get('class') ?? '';
  }
  set className(v: string) {
    // As in a browser, SVG elements have a read-only className.
    if (this.namespace) throw new TypeError('Cannot set property className of #<SVGElement> which has only a getter');
    this.attributes.set('class', v);
  }
  get hidden(): boolean {
    return this.attributes.has('hidden');
  }
  set hidden(v: boolean) {
    if (v) this.attributes.set('hidden', '');
    else this.attributes.delete('hidden');
  }
  get target(): string {
    return this.attributes.get('target') ?? '';
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  closest(selector: string): FakeElement | null {
    let node: FakeNode | null = this;
    while (node instanceof FakeElement) {
      if (node.tagName.toLowerCase() === selector) return node;
      node = node.parentNode;
    }
    return null;
  }
  focus(): void {}
}

export class FakeDocument extends FakeNode {
  body = new FakeElement('body');
  constructor() {
    super();
    this.body.parentNode = this;
  }
  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }
  createElementNS(ns: string, tag: string): FakeElement {
    return new FakeElement(tag, ns);
  }
  createTextNode(text: string): FakeText {
    return new FakeText(text);
  }
  getElementById(): null {
    return null;
  }
}

export class FakeStorage {
  private map = new Map<string, string>();
  throwing = false;
  getItem(k: string): string | null {
    if (this.throwing) throw new Error('blocked');
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    if (this.throwing) throw new Error('blocked');
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

/** A window-like object with a working history stack. */
export class FakeWindow {
  document: FakeDocument;
  location = { pathname: '/', search: '', origin: 'http://localhost' };
  popListeners: Listener[] = [];
  stack: { url: string; state: any }[] = [{ url: '/', state: null }];
  index = 0;
  fetchCalls: { url: string; init?: any }[] = [];
  fetch: (url: string, init?: any) => Promise<any>;
  history: any;
  constructor(document: FakeDocument, startUrl = '/', fetchImpl?: (url: string, init?: any) => Promise<any>) {
    this.document = document;
    this.fetch = (url, init) => {
      this.fetchCalls.push({ url, init });
      return (fetchImpl ?? globalThis.fetch)(url, init);
    };
    const set = (url: string) => {
      const u = new URL(url, 'http://localhost');
      this.location.pathname = u.pathname;
      this.location.search = u.search;
    };
    this.stack = [{ url: startUrl, state: null }];
    set(startUrl);
    const win = this;
    this.history = {
      get state() {
        return win.stack[win.index].state;
      },
      get length() {
        return win.stack.length;
      },
      pushState(state: any, _t: string, url: string) {
        win.stack = win.stack.slice(0, win.index + 1);
        win.stack.push({ url, state });
        win.index += 1;
        set(url);
      },
      replaceState(state: any, _t: string, url: string) {
        win.stack[win.index] = { url, state };
        set(url);
      },
      back() {
        if (win.index > 0) {
          win.index -= 1;
          set(win.stack[win.index].url);
          win.popListeners.forEach((fn) => fn({ type: 'popstate' }));
        }
      },
    };
  }
  addEventListener(type: string, fn: Listener): void {
    if (type === 'popstate') this.popListeners.push(fn);
  }
}

export function installFakeDom(startUrl = '/', fetchImpl?: (url: string, init?: any) => Promise<any>) {
  const g = globalThis as any;
  const saved = { document: g.document, localStorage: Object.getOwnPropertyDescriptor(g, 'localStorage') };
  const document = new FakeDocument();
  const storage = new FakeStorage();
  g.document = document;
  Object.defineProperty(g, 'localStorage', { value: storage, configurable: true, writable: true });
  const win = new FakeWindow(document, startUrl, fetchImpl);
  return {
    document,
    storage,
    win,
    restore() {
      g.document = saved.document;
      if (saved.localStorage) Object.defineProperty(g, 'localStorage', saved.localStorage);
      else delete g.localStorage;
    },
  };
}

/** Imports a client module from app/public by its path, for example "shared/item.js". */
export async function loadClient(path: string): Promise<any> {
  return import(pathToFileURL(resolve(import.meta.dirname, '../../public', path)).href);
}

export function walk(node: FakeNode, visit: (n: FakeElement) => void): void {
  for (const c of node.childNodes) {
    if (c instanceof FakeElement) {
      visit(c);
      walk(c, visit);
    }
  }
}

export function findAll(root: FakeNode, pred: (n: FakeElement) => boolean): FakeElement[] {
  const out: FakeElement[] = [];
  walk(root, (n) => {
    if (pred(n)) out.push(n);
  });
  return out;
}

export function byTestId(root: FakeNode, id: string): FakeElement | null {
  return findAll(root, (n) => n.getAttribute('data-testid') === id)[0] ?? null;
}

export function allByClass(root: FakeNode, cls: string): FakeElement[] {
  return findAll(root, (n) => n.className.split(/\s+/).includes(cls));
}

export function click(node: FakeElement): void {
  node.dispatchEvent({ type: 'click', button: 0 });
}

export function typeInto(input: FakeElement, value: string): void {
  input.value = value;
  input.dispatchEvent({ type: 'input' });
}

export function submit(form: FakeElement): void {
  form.dispatchEvent({ type: 'submit' });
}

export const tick = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

/** Waits (up to 1 s) until `check` is true. */
export async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await tick(5);
  }
  throw new Error('timed out waiting for the page');
}
