'use strict';
// Isolated DOM test adapter: parses generated HTML and exercises JavaScript.
// It does not launch a browser, load remote resources, or validate visual layout.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
const decode = value => value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (all, key) => key[0] === '#' ? String.fromCodePoint(parseInt(key[1].toLowerCase() === 'x' ? key.slice(2) : key.slice(1), key[1].toLowerCase() === 'x' ? 16 : 10)) : entities[key] || all);
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
class Text { constructor(value) { this.nodeType = 3; this.textContent = value; } }
class Element {
  constructor(tag, attrs = {}, owner) {
    this.nodeType = 1; this.tagName = tag.toLowerCase(); this.attributes = new Map(Object.entries(attrs)); this.childNodes = []; this.ownerDocument = owner;
    this.listeners = new Map(); this._value = undefined; this._checked = Object.hasOwn(attrs, 'checked'); this._customValidity = '';
    const updateClass = (name, on) => { const set = new Set((this.getAttribute('class') || '').split(/\s+/).filter(Boolean)); on ? set.add(name) : set.delete(name); this.setAttribute('class', [...set].join(' ')); };
    this.classList = { add: (...names) => names.forEach(n => updateClass(n, true)), remove: (...names) => names.forEach(n => updateClass(n, false)), toggle: (n, on) => updateClass(n, on === undefined ? !this.classList.contains(n) : on), contains: n => (this.getAttribute('class') || '').split(/\s+/).includes(n) };
  }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  get dataset() { return Object.fromEntries([...this.attributes].filter(([name]) => name.startsWith('data-')).map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value])); }
  get id() { return this.getAttribute('id') || ''; } set id(value) { this.setAttribute('id', value); }
  get hidden() { return this.hasAttribute('hidden'); } set hidden(on) { on ? this.setAttribute('hidden', '') : this.removeAttribute('hidden'); }
  get disabled() { return this.hasAttribute('disabled'); } set disabled(on) { on ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
  get checked() { return this._checked; } set checked(on) { this._checked = !!on; }
  get type() { return this.getAttribute('type') || (this.tagName === 'button' ? 'submit' : 'text'); }
  get value() { if (this._value !== undefined) return this._value; if (this.tagName === 'textarea') return this.textContent; if (this.tagName === 'select') { const options = this.querySelectorAll('option'); const choice = options.find(o => o.hasAttribute('selected')) || options[0]; return choice ? choice.value : ''; } return this.getAttribute('value') || ''; }
  set value(value) { this._value = String(value); }
  get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) { this.childNodes = [new Text(String(value))]; this.childNodes[0].parentElement = this; }
  get innerHTML() { return this._html || ''; }
  set innerHTML(value) { this._html = String(value); this.childNodes = []; const fragment = parse(String(value), this.ownerDocument); for (const node of [...fragment.childNodes]) this.appendChild(node); }
  get elements() { return { namedItem: name => this.querySelectorAll('[name="' + name + '"]')[0] || null }; }
  appendChild(node) { if (node.parentElement) node.parentElement.childNodes = node.parentElement.childNodes.filter(item => item !== node); this.childNodes.push(node); node.parentElement = this; if (node.nodeType === 1) assignOwner(node, this.ownerDocument); return node; }
  remove() { if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter(node => node !== this); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()));
    let checked = false; if (selector.endsWith(':checked')) { checked = true; selector = selector.slice(0, -8); } if (checked && !this.checked) return false;
    const attrMatches = [...selector.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]/g)];
    for (const match of attrMatches) if (!this.hasAttribute(match[1]) || (match[2] !== undefined && this.getAttribute(match[1]) !== match[2])) return false;
    selector = selector.replace(/\[[^\]]+\]/g, '');
    const id = selector.match(/#([\w-]+)/); if (id && this.id !== id[1]) return false;
    const classes = [...selector.matchAll(/\.([\w-]+)/g)]; if (classes.some(match => !this.classList.contains(match[1]))) return false;
    const tag = selector.match(/^[\w-]+/); return !tag || this.tagName === tag[0].toLowerCase();
  }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(item) { return item === this || this.children.some(child => child.contains(item)); }
  addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(handler); }
  removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== handler)); }
  dispatchEvent(event) { event.target ||= this; event.preventDefault ||= () => { event.defaultPrevented = true; }; for (let node = this; node; node = node.parentElement) for (const handler of [...(node.listeners.get(event.type) || [])]) handler(event); return !event.defaultPrevented; }
  click() { if (this.disabled) return; if (this.tagName === 'a' && this.download) this.ownerDocument.downloads.push({ name: this.download, href: this.href }); this.dispatchEvent({ type: 'click' }); }
  focus() { this.ownerDocument.activeElement = this; }
  select() { this.ownerDocument.selectedElement = this; }
  setCustomValidity(message) { this._customValidity = message; }
  reportValidity() { return this.querySelectorAll('[name]').every(input => !input._customValidity && (!input.hasAttribute('required') || !!input.value)); }
}
function assignOwner(node, document) { node.ownerDocument = document; for (const child of node.children) assignOwner(child, document); }
function parse(html, owner) {
  const fragment = new Element('fragment', {}, owner), stack = [fragment];
  const tokens = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  for (const match of html.matchAll(tokens)) {
    if (match[3] !== undefined) { const parent = stack[stack.length - 1]; parent.appendChild(new Text(parent.tagName === 'script' ? match[3] : decode(match[3]))); continue; }
    if (!match[1]) continue; const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tagName === tag) { stack.length = i; break; } continue; }
    const attrs = {}; for (const a of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    const element = new Element(tag, attrs, owner); stack[stack.length - 1].appendChild(element); if (!voidTags.has(tag) && !match[0].endsWith('/>')) stack.push(element);
  }
  return fragment;
}
function loadPage(filename, options = {}) {
  const directory = path.resolve(__dirname, '../dist'), document = new Element('document'); document.nodeType = 9; document.ownerDocument = document; document.downloads = [];
  const fragment = parse(fs.readFileSync(path.join(directory, filename), 'utf8'), document); for (const node of [...fragment.childNodes]) document.appendChild(node);
  document.body = document.querySelector('body'); document.readyState = 'complete'; document.getElementById = id => document.querySelector('#' + id); document.createElement = tag => new Element(tag, {}, document);
  const timers = new Map(); let timerId = 0; const blobs = new Map(); let blobId = 0;
  class MockURL extends URL {} MockURL.createObjectURL = blob => { const id = 'blob:test-' + (++blobId); blobs.set(id, blob); return id; }; MockURL.revokeObjectURL = () => {};
  const copied = [], errors = [];
  const context = vm.createContext({ document, URL: MockURL, URLSearchParams, Blob, navigator: { clipboard: { writeText: async text => copied.push(text) } }, location: { pathname: '/' + filename, href: 'https://example.com/' + filename + (options.search || '') }, history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: (options.width || 1280) >= 761, addEventListener() {}, removeEventListener() {} }), setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id), addEventListener() {}, MoreSpacePreviewResolveAsset: options.resolveAsset });
  try { vm.runInContext(fs.readFileSync(path.join(directory, 'metrics.js'), 'utf8'), context); vm.runInContext(fs.readFileSync(path.join(directory, 'site.js'), 'utf8'), context); } catch (error) { errors.push(error); }
  return { document, context, copied, blobs, errors, get: id => document.getElementById(id), click: element => element.click(), key: (element, key) => element.dispatchEvent({ type: 'keydown', key }), input: (element, value) => { element.value = value; element.dispatchEvent({ type: 'input' }); while (timers.size) { const queued = [...timers.values()]; timers.clear(); for (const callback of queued) callback(); } }, downloads: document.downloads };
}
module.exports = { loadPage };
