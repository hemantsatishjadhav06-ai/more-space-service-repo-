'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lab = require('../dist/site.js');
const tools = [
  { id: 'clay', name: 'Clay', domain: 'marketing', family: 'Prospecting', description: 'Account enrichment', useCases: ['Research accounts'], implementation: { outputs: ['Enriched target accounts'] } },
  { id: 'smartlead', name: 'Smartlead', domain: 'marketing', family: 'Outreach', description: 'Email sequences', useCases: ['Route replies'], implementation: { inputs: ['Reviewed audience segments'] } },
  { id: 'retool', name: 'Retool', domain: 'software', family: 'Internal apps', description: 'Operational interfaces', useCases: ['Approval workspace'], implementation: { outputs: ['Review queues'] } },
  { id: 'n8n', name: 'n8n', domain: 'ai-data', family: 'Automation', description: 'Workflow execution', useCases: ['Connect task handoffs'] }
];
const services = [
  { id: 'strategy-funnels', capabilityGroups: [{ id: 'outbound', title: 'Outbound pipeline' }, { id: 'qualification', title: 'Qualification and routing' }] },
  { id: 'marketing-creative', capabilityGroups: [{ id: 'paid-growth', title: 'Paid acquisition' }] },
  { id: 'saas-tools', capabilityGroups: [{ id: 'ops-hub', title: 'Operations workspace' }] },
  { id: 'ai-automation', capabilityGroups: [{ id: 'handoffs', title: 'Workflow handoffs' }] },
  { id: 'data-analytics', capabilityGroups: [{ id: 'decision-views', title: 'Decision dashboard' }] }
];
test('tool deep links infer their area and family when filters are omitted', () => {
  const view = lab.selectToolView(tools, { tool: 'retool' });
  assert.equal(view.domain, 'software'); assert.equal(view.family, 'Internal apps'); assert.equal(view.selected.id, 'retool');
  assert.deepEqual(view.visible.map(t => t.id), ['retool']);
});
test('explicit area and family filters cannot select a tool from a different hierarchy', () => {
  const view = lab.selectToolView(tools, { domain: 'marketing', family: 'Outreach', tool: 'retool' });
  assert.equal(view.selected.id, 'smartlead'); assert.deepEqual(view.families, ['Prospecting', 'Outreach']); assert.deepEqual(view.visible.map(t => t.id), ['smartlead']);
  assert.equal(lab.selectToolView(tools, { domain: 'marketing', family: 'Internal apps' }).family, 'all');
});
test('search covers implementation requirements and outputs within the chosen area', () => {
  assert.equal(lab.selectToolView(tools, { domain: 'marketing', family: 'Outreach', q: 'REVIEWED audience' }).selected.id, 'smartlead');
  assert.equal(lab.selectToolView(tools, { domain: 'software', family: 'Internal apps', q: 'review queues' }).selected.id, 'retool');
  const empty = lab.selectToolView(tools, { domain: 'marketing', q: 'approval workspace' }); assert.equal(empty.selected, null); assert.equal(empty.visible.length, 0);
});
test('invalid shared filters fall back safely without mutating records', () => {
  const copy = JSON.stringify(tools), view = lab.selectToolView(tools, { domain: 'unknown', family: 'unknown', tool: '<script>', q: '  ' });
  assert.equal(view.domain, 'all'); assert.equal(view.family, 'all'); assert.equal(view.visible.length, tools.length); assert.equal(JSON.stringify(tools), copy);
});
test('goal selection keeps the service and capability in the same business area', () => {
  const view = lab.selectCapabilityView(services, { domain: 'software', service: 'strategy-funnels', capability: 'qualification' });
  assert.deepEqual(view.services.map(s => s.id), ['saas-tools']); assert.equal(view.service.id, 'saas-tools'); assert.equal(view.capability.id, 'ops-hub');
  const data = lab.selectCapabilityView(services, { domain: 'ai-data', service: 'data-analytics', capability: 'decision-views' }); assert.equal(data.service.id, 'data-analytics'); assert.equal(data.capability.id, 'decision-views');
});
test('service deep links infer their goal and obsolete capabilities fall back', () => {
  const view = lab.selectCapabilityView(services, { service: 'ai-automation', capability: 'obsolete' });
  assert.equal(view.domain, 'ai-data'); assert.equal(view.service.id, 'ai-automation'); assert.equal(view.capability.id, 'handoffs'); assert.equal(lab.selectCapabilityView([], {}).capability, null);
});
test('shortlist exports include proposed outputs, requirements, and the six-tool limit', () => {
  const brief = lab.stackBrief([{ ...tools[0], considerations: ['Confirm licensed sources'], officialUrl: 'https://www.clay.com/' }]);
  assert.match(brief, /Enriched target accounts/); assert.match(brief, /Confirm licensed sources/); assert.match(brief, /not a connected or live stack/); assert.match(brief, /has not been sent/); assert.throws(() => lab.stackBrief(Array(7).fill(tools[0])), RangeError);
});
test('nested tab handlers preserve independent parent and child selections', () => {
  class Element {
    constructor(tag, attrs = {}, children = []) {
      this.tagName = tag; this.attributes = new Map(Object.entries(attrs)); this.children = children; this.id = attrs.id || ''; this.hidden = Object.hasOwn(attrs, 'hidden'); this.disabled = false;
      this.dataset = Object.fromEntries(Object.entries(attrs).filter(([name]) => name.startsWith('data-')).map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
      this.classList = { toggle() {}, add() {}, remove() {} }; this.listeners = new Map(); for (const child of children) child.parentElement = this;
    }
    matches(selector) { const m = selector.match(/^(\w+)?\[([^=\]]+)(?:="([^"]*)")?\]$/); return !!m && (!m[1] || this.tagName === m[1]) && this.hasAttribute(m[2]) && (m[3] === undefined || this.getAttribute(m[2]) === m[3]); }
    closest(selector) { let item = this; while (item) { if (item.matches(selector)) return item; item = item.parentElement; } return null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    hasAttribute(name) { return this.attributes.has(name); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'id') this.id = String(value); }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(handler); }
    removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== handler)); }
    dispatchEvent(event) { for (const handler of this.listeners.get(event.type) || []) handler(event); }
    focus() { document.activeElement = this; }
    contains(item) { return item === this || this.children.some(child => child.contains(item)); }
  }
  const tab = (id, panel, selected) => new Element('button', { id, 'data-tab-target': panel, 'aria-selected': String(selected) });
  const innerOne = tab('inner-one', 'inner-panel-one', true), innerTwo = tab('inner-two', 'inner-panel-two', false);
  const innerPanelOne = new Element('section', { id: 'inner-panel-one', 'data-tab-panel': '' }), innerPanelTwo = new Element('section', { id: 'inner-panel-two', 'data-tab-panel': '', hidden: '' });
  const inner = new Element('div', { 'data-tabs': 'inner' }, [new Element('div', { 'data-tab-list': '' }, [innerOne, innerTwo]), innerPanelOne, innerPanelTwo]);
  const outerOne = tab('outer-one', 'outer-panel-one', true), outerTwo = tab('outer-two', 'outer-panel-two', false);
  const outerPanelOne = new Element('section', { id: 'outer-panel-one', 'data-tab-panel': '' }, [inner]), outerPanelTwo = new Element('section', { id: 'outer-panel-two', 'data-tab-panel': '', hidden: '' });
  const outer = new Element('div', { 'data-tabs': 'outer' }, [new Element('div', { 'data-tab-list': '' }, [outerOne, outerTwo]), outerPanelOne, outerPanelTwo]);
  const document = new Element('document', {}, [new Element('body', {}, [outer])]); document.body = document.children[0]; document.readyState = 'complete';
  document.getElementById = id => { function find(el) { if (el.id === id) return el; for (const child of el.children) { const result = find(child); if (result) return result; } return null; } return find(document); };
  const context = vm.createContext({ document, addEventListener() {}, setTimeout, clearTimeout, URL, URLSearchParams, navigator: {}, location: { pathname: '/index.html', href: 'https://example.com/index.html' } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/site.js'), 'utf8'), context);
  assert.equal(outerPanelOne.hidden, false); assert.equal(innerPanelOne.hidden, false);
  document.dispatchEvent({ type: 'click', target: innerTwo });
  assert.equal(innerPanelOne.hidden, true); assert.equal(innerPanelTwo.hidden, false); assert.equal(outerPanelOne.hidden, false); assert.equal(outerOne.getAttribute('aria-selected'), 'true');
  document.dispatchEvent({ type: 'keydown', target: innerTwo, key: 'ArrowRight', preventDefault() {} }); assert.equal(innerOne.getAttribute('aria-selected'), 'true'); assert.equal(document.activeElement, innerOne);
  document.dispatchEvent({ type: 'keydown', target: outerOne, key: 'End', preventDefault() {} });
  assert.equal(outerPanelOne.hidden, true); assert.equal(outerPanelTwo.hidden, false); assert.equal(innerOne.getAttribute('aria-selected'), 'true'); assert.equal(innerPanelOne.getAttribute('aria-labelledby'), 'inner-one'); assert.equal(document.activeElement, outerTwo);
});
