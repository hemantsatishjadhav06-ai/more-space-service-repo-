'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const content = path.join(root, 'content');
const decoder = new TextDecoder('utf-8', { fatal: true });

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(p) : [p];
  });
}
function localName(file) { return path.relative(dist, file).split(path.sep).join('/'); }
function readJSON(name) { return JSON.parse(fs.readFileSync(path.join(content, name), 'utf8')); }
function decodeEntities(value = '') {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (full, entity) => {
    const e = entity.toLowerCase();
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e] || full;
  });
}

// A small dependency-free tokenizer for the generated HTML. It honors quoted
// attributes, comments and raw-text script/style nodes, so embedded catalog JSON
// cannot be mistaken for page elements or create phantom IDs/links.
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function parseHTML(source) {
  const document = { tag: '#document', attrs: {}, children: [], parent: null };
  const nodes = [];
  const stack = [document];
  let index = 0;
  function appendText(text) { if (text) stack[stack.length - 1].children.push({ tag: '#text', text: decodeEntities(text) }); }
  while (index < source.length) {
    const opening = source.indexOf('<', index);
    if (opening < 0) { appendText(source.slice(index)); break; }
    appendText(source.slice(index, opening));
    if (source.startsWith('<!--', opening)) {
      const end = source.indexOf('-->', opening + 4);
      index = end < 0 ? source.length : end + 3;
      continue;
    }
    const tagStart = source.slice(opening).match(/^<(\/?)([a-z][a-z\d:_-]*)\b/i);
    if (!tagStart) {
      const end = source.indexOf('>', opening + 1);
      if (source.startsWith('<!', opening) || source.startsWith('<?', opening)) { index = end < 0 ? source.length : end + 1; continue; }
      appendText('<'); index = opening + 1; continue;
    }
    let end = opening + tagStart[0].length, quote = null;
    for (; end < source.length; end++) {
      const character = source[end];
      if (quote) { if (character === quote) quote = null; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    const tag = tagStart[2].toLowerCase();
    if (tagStart[1]) {
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].tag === tag) { stack.length = s; break; }
      }
      index = end + 1;
      continue;
    }
    const body = source.slice(opening + tagStart[0].length, end);
    const attrs = {}, duplicateAttrs = [];
    const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g;
    let attribute;
    while ((attribute = attrPattern.exec(body))) {
      const name = attribute[1].toLowerCase();
      if (Object.hasOwn(attrs, name)) duplicateAttrs.push(name);
      attrs[name] = decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
    }
    const parent = stack[stack.length - 1];
    const node = { tag, attrs, duplicateAttrs, children: [], parent };
    parent.children.push(node); nodes.push(node);
    index = end + 1;
    if (tag === 'script' || tag === 'style') {
      const closing = new RegExp('</' + tag + '\\s*>', 'ig');
      closing.lastIndex = index;
      const match = closing.exec(source);
      const finish = match ? match.index : source.length;
      node.rawText = source.slice(index, finish);
      node.children.push({ tag: '#text', text: node.rawText });
      index = match ? closing.lastIndex : source.length;
    } else if (!voidTags.has(tag) && !/\/\s*$/.test(body)) stack.push(node);
  }
  const ids = new Map();
  for (const node of nodes) if (node.attrs.id) {
    if (!ids.has(node.attrs.id)) ids.set(node.attrs.id, []);
    ids.get(node.attrs.id).push(node);
  }
  return { source, document, nodes, ids };
}
function textOf(node) { return node.tag === '#text' ? node.text : node.children.map(textOf).join(' '); }
function byTag(page, tag) { return page.nodes.filter(node => node.tag === tag); }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function check(errors, condition, message) { if (!condition) errors.push(message); }
function finish(errors) { assert.deepEqual(errors, [], errors.join('\n')); }
function slug(value) { return typeof value === 'string' && /^[a-z][a-z\d-]*$/.test(value); }

const htmlFiles = walkFiles(dist).filter(p => p.endsWith('.html'));
const pages = new Map(htmlFiles.map(file => [localName(file), parseHTML(decoder.decode(fs.readFileSync(file)))]));
const manifest = readJSON('page-index.json');
const counts = readJSON('site-counts.json');
const services = readJSON('services.json');
const solutions = readJSON('solutions.json');
const tools = readJSON('tools.json');
const metrics = readJSON('metric-library.json');
const known = {
  toolIds: new Set(tools.map(x => x.id)),
  serviceIds: new Set(services.map(x => x.id)),
  solutionIds: new Set(solutions.map(x => x.id)),
  metricIds: new Set(metrics.map(x => x.id)),
  capabilityIds: new Set(services.flatMap(x => x.capabilityGroups || []).map(x => x.id))
};
function checkReferences(value, location, errors) {
  if (Array.isArray(value)) { value.forEach((item, index) => checkReferences(item, location + '[' + index + ']', errors)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (known[key]) {
      check(errors, Array.isArray(item), location + '.' + key + ' must be an array');
      if (Array.isArray(item)) for (const id of item) check(errors, known[key].has(id), location + '.' + key + ': unknown ' + id);
    }
    checkReferences(item, location + '.' + key, errors);
  }
}
function idOf(node) { return node.attrs.id || node.tag; }
function accessibleName(node, page) {
  if (nonempty(node.attrs['aria-label'])) return node.attrs['aria-label'].trim();
  if (nonempty(node.attrs['aria-labelledby'])) return node.attrs['aria-labelledby'].split(/\s+/).map(id => textOf(page.ids.get(id)?.[0] || { tag: '#text', text: '' })).join(' ').trim();
  if (node.tag === 'input' && /^(button|submit|reset)$/i.test(node.attrs.type || '')) return node.attrs.value || ({ submit: 'Submit', reset: 'Reset' }[node.attrs.type] || '');
  if (node.tag === 'input' && node.attrs.type === 'image') return node.attrs.alt || '';
  return textOf(node).trim();
}
function hasFormLabel(node, page) {
  if (nonempty(node.attrs['aria-label']) || nonempty(node.attrs['aria-labelledby'])) return nonempty(accessibleName(node, page));
  if (node.attrs.id && page.nodes.some(label => label.tag === 'label' && label.attrs.for === node.attrs.id && nonempty(textOf(label)))) return true;
  for (let parent = node.parent; parent; parent = parent.parent) if (parent.tag === 'label' && nonempty(textOf(parent))) return true;
  return nonempty(node.attrs.title);
}
function resolveLocal(reference, file) {
  if (!reference || /^\s*(?:https?:|mailto:|tel:|data:|blob:|\/\/)/i.test(reference)) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(reference)) return { error: 'Unsupported URL scheme: ' + reference };
  try {
    const url = new URL(reference, 'https://morespace.test/' + file);
    const target = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const fragment = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
    return { target, fragment };
  } catch (error) { return { error: 'Malformed local URL: ' + reference + ' (' + error.message + ')' }; }
}
const parsedAssets = new Map();
function assetDocument(file) {
  if (!parsedAssets.has(file)) parsedAssets.set(file, parseHTML(decoder.decode(fs.readFileSync(path.join(dist, file)))));
  return parsedAssets.get(file);
}
function verifyLocalReference(reference, owner, description, errors) {
  const resolved = resolveLocal(reference, owner);
  if (!resolved) return null;
  if (resolved.error) { errors.push(owner + ': ' + description + ': ' + resolved.error); return null; }
  const file = path.resolve(dist, resolved.target);
  const withinDist = file === dist || file.startsWith(dist + path.sep);
  check(errors, withinDist, owner + ': path escapes dist: ' + reference);
  if (!withinDist) return null;
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  check(errors, exists, owner + ': missing ' + description + ' target ' + reference + ' → ' + resolved.target);
  if (!exists) return resolved;
  if (resolved.fragment && !/^:~:text=/.test(resolved.fragment)) {
    const target = pages.get(resolved.target) || (/\.svg$/i.test(file) ? assetDocument(resolved.target) : null);
    check(errors, !!target, owner + ': fragment on non-document ' + reference);
    if (target) check(errors, target.ids.has(resolved.fragment), owner + ': missing fragment ' + reference);
  }
  return resolved;
}

test('route manifest exactly matches generated pages and declared page count', () => {
  assert.equal(new Set(manifest).size, manifest.length, 'manifest contains duplicate routes');
  assert.ok(manifest.every(route => nonempty(route) && route.endsWith('.html') && !route.includes('..') && !route.startsWith('/')), 'manifest routes must be portable relative HTML paths');
  assert.deepEqual([...pages.keys()].sort(), [...manifest].sort(), 'manifest and disk routes differ');
  assert.equal(counts.pages, manifest.length);
  assert.ok(pages.has('index.html'), 'home page missing');
});

test('every page has one main landmark, h1, useful title, and description', () => {
  const errors = [];
  for (const [file, page] of pages) {
    for (const tag of ['html', 'head', 'body', 'main', 'h1', 'title']) check(errors, byTag(page, tag).length === 1, file + ': expected one ' + tag);
    const h1 = byTag(page, 'h1')[0], title = byTag(page, 'title')[0], html = byTag(page, 'html')[0];
    check(errors, h1 && nonempty(textOf(h1)), file + ': empty h1');
    check(errors, title && nonempty(textOf(title)), file + ': empty title');
    check(errors, html && nonempty(html.attrs.lang), file + ': missing document language');
    const descriptions = byTag(page, 'meta').filter(node => node.attrs.name?.toLowerCase() === 'description');
    check(errors, descriptions.length === 1 && nonempty(descriptions[0]?.attrs.content), file + ': expected one nonempty description');
    const charsets = byTag(page, 'meta').filter(node => node.attrs.charset);
    check(errors, charsets.length === 1 && /^utf-?8$/i.test(charsets[0]?.attrs.charset || ''), file + ': expected UTF-8 charset');
    check(errors, /<!doctype\s+html\s*>/i.test(page.source), file + ': HTML doctype missing');
  }
  finish(errors);
});

test('generated text and content decode as clean UTF-8 without corrupted text', () => {
  const errors = [], files = [...walkFiles(dist), ...walkFiles(content)].filter(file => /\.(html|css|js|svg|json)$/i.test(file));
  for (const file of files) {
    let text;
    try { text = decoder.decode(fs.readFileSync(file)); } catch (error) { errors.push(path.relative(root, file) + ': invalid UTF-8: ' + error.message); continue; }
    check(errors, !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text), path.relative(root, file) + ': unexpected control character');
    check(errors, !/\uFFFD|[\u00C2\u00C3][\u0080-\u00BF]|â(?:€|„|€™|€¦)|ðŸ/.test(text), path.relative(root, file) + ': replacement character or mojibake marker');
  }
  finish(errors);
});

test('static IDs are unique and every rendered ARIA ID reference resolves', () => {
  const errors = [], refs = ['aria-activedescendant', 'aria-controls', 'aria-describedby', 'aria-details', 'aria-errormessage', 'aria-flowto', 'aria-labelledby', 'aria-owns'];
  for (const [file, page] of pages) {
    for (const [id, nodes] of page.ids) check(errors, nodes.length === 1, file + ': duplicate ID ' + id);
    for (const node of page.nodes) {
      check(errors, node.duplicateAttrs.length === 0, file + ': duplicate attributes on ' + idOf(node) + ': ' + node.duplicateAttrs.join(', '));
      for (const attr of refs) if (Object.hasOwn(node.attrs, attr)) {
        check(errors, nonempty(node.attrs[attr]), file + ': empty ' + attr + ' on ' + idOf(node));
        for (const id of node.attrs[attr].split(/\s+/).filter(Boolean)) check(errors, page.ids.has(id), file + ': unresolved ' + attr + ' ' + id + ' on ' + idOf(node));
      }
      if (node.attrs.role === 'tab') {
        check(errors, nonempty(node.attrs['aria-controls']), file + ': static tab lacks target ' + idOf(node));
        check(errors, /^(true|false)$/.test(node.attrs['aria-selected'] || ''), file + ': static tab lacks selection state ' + idOf(node));
        check(errors, /^(0|-1)$/.test(node.attrs.tabindex || ''), file + ': static tab lacks keyboard tab index ' + idOf(node));
      }
    }
  }
  finish(errors);
});

test('forms and action controls have names and image alternatives are explicit', () => {
  const errors = [];
  for (const [file, page] of pages) for (const node of page.nodes) {
    if (['input', 'select', 'textarea'].includes(node.tag) && node.attrs.type !== 'hidden') {
      const actionInput = node.tag === 'input' && /^(button|submit|reset|image)$/i.test(node.attrs.type || '');
      check(errors, actionInput ? nonempty(accessibleName(node, page)) : hasFormLabel(node, page), file + ': unlabelled ' + node.tag + ' ' + (node.attrs.id || node.attrs.name || '(no id/name)'));
    }
    if (node.tag === 'button') check(errors, nonempty(accessibleName(node, page)), file + ': unnamed button ' + idOf(node));
    if (node.tag === 'img') check(errors, Object.hasOwn(node.attrs, 'alt'), file + ': image lacks explicit alt ' + (node.attrs.src || '(no src)'));
    if (node.tag === 'label' && node.attrs.for) {
      const target = page.ids.get(node.attrs.for)?.[0];
      check(errors, target && ['input', 'select', 'textarea', 'output', 'progress', 'meter'].includes(target.tag), file + ': label points to missing or non-labelable control ' + node.attrs.for);
    }
  }
  finish(errors);
});

test('all local href/src targets, fragments, srcset candidates and stylesheet URLs exist', () => {
  const errors = [];
  for (const [file, page] of pages) for (const node of page.nodes) {
    for (const attr of ['href', 'src', 'poster', 'action']) if (Object.hasOwn(node.attrs, attr)) verifyLocalReference(node.attrs[attr], file, node.tag + '[' + attr + ']', errors);
    if (node.attrs.srcset && !/^data:/i.test(node.attrs.srcset)) for (const candidate of node.attrs.srcset.split(',')) verifyLocalReference(candidate.trim().split(/\s+/)[0], file, node.tag + '[srcset]', errors);
    if (node.attrs.style) for (const match of node.attrs.style.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) verifyLocalReference(match[2], file, 'inline style URL', errors);
  }
  for (const file of walkFiles(dist).filter(p => p.endsWith('.css'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) verifyLocalReference(match[2], localName(file), 'CSS URL', errors);
  }
  finish(errors);
});

test('every published route is reachable through static navigation starting at home', () => {
  const visited = new Set(['index.html']), queue = ['index.html'];
  while (queue.length) {
    const owner = queue.shift(), page = pages.get(owner);
    for (const node of byTag(page, 'a')) {
      const result = resolveLocal(node.attrs.href, owner);
      if (result && !result.error && pages.has(result.target) && !visited.has(result.target)) { visited.add(result.target); queue.push(result.target); }
    }
  }
  const unreachable = manifest.filter(route => !visited.has(route));
  assert.deepEqual(unreachable, [], 'Routes unreachable from home: ' + unreachable.join(', '));
});

test('catalog IDs, declared counts and detail routes remain consistent', () => {
  const errors = [];
  const catalogs = [['services', services], ['solutions', solutions], ['tools', tools], ['metrics', metrics]];
  for (const [type, entries] of catalogs) {
    check(errors, new Set(entries.map(x => x.id)).size === entries.length, type + ': duplicate ID');
    check(errors, counts[type] === entries.length, type + ': declared count differs');
    for (const row of entries) {
      check(errors, slug(row.id), type + ': invalid slug ' + row.id);
      check(errors, pages.has(type + '/' + row.id + '.html'), type + ': detail page missing for ' + row.id);
    }
  }
  check(errors, tools.length >= 60, 'requested catalog has fewer than 60 tools');
  const groups = services.flatMap(service => service.capabilityGroups || []);
  check(errors, groups.length === counts.capabilities, 'capability count differs');
  check(errors, new Set(groups.map(group => group.id)).size === groups.length, 'capability IDs are not globally unique');
  finish(errors);
});

test('company lifecycle connects launch, operations and scale to scoped deliverables and platform setup', () => {
  const lifecycle = readJSON('company-lifecycle.json'), errors = [];
  check(errors, lifecycle.length === 8, 'company lifecycle must cover all eight agreed stages');
  check(errors, new Set(lifecycle.map(stage => stage.id)).size === lifecycle.length, 'company lifecycle stage IDs must be unique');
  check(errors, counts.companyStages === lifecycle.length, 'declared company stage count differs from lifecycle registry');
  check(errors, JSON.stringify(lifecycle.map(stage => stage.phase)) === JSON.stringify(['launch', 'launch', 'operate', 'operate', 'operate', 'operate', 'scale', 'scale']), 'company lifecycle phase order differs');
  const company = pages.get('company.html');
  check(errors, !!company, 'company lifecycle page missing');
  for (const stage of lifecycle) {
    const base = 'company-lifecycle.' + stage.id;
    for (const field of ['id', 'title', 'summary', 'objective', 'owner']) check(errors, nonempty(stage[field]), base + ': missing ' + field);
    for (const field of ['deliverables', 'clientInputs', 'exitCriteria', 'scopeLimits', 'toolIds', 'serviceIds', 'metricIds', 'workflow', 'exampleBuilds']) check(errors, Array.isArray(stage[field]) && stage[field].length > 0, base + ': empty ' + field);
    for (const row of stage.workflow || []) check(errors, nonempty(row.title) && nonempty(row.description) && Array.isArray(row.toolIds) && row.toolIds.length > 0, base + ': workflow lacks a description or named tools');
    for (const row of stage.exampleBuilds || []) check(errors, nonempty(row.title) && nonempty(row.description), base + ': buildable example lacks a title or description');
    checkReferences(stage, base, errors);
    if (company) {
      for (const [group, tabs] of [['delivery', ['outcome', 'deliverables', 'workflow']], ['operating', ['tools', 'inputs', 'owners']], ['evidence', ['metrics', 'acceptance', 'scope']]]) {
        for (const tab of tabs) {
          const id = 'panel-stage-' + stage.id + '-' + group + '-' + tab;
          const panel = company.ids.get(id)?.[0];
          check(errors, !!panel, base + ': missing fourth-level panel ' + group + '/' + tab);
          if (panel) check(errors, nonempty(textOf(panel)), base + ': empty fourth-level detail ' + group + '/' + tab);
        }
      }
    }
  }
  for (const id of ['jira', 'asana', 'slack', 'discord']) check(errors, lifecycle.some(stage => stage.toolIds.includes(id)), 'company lifecycle does not expose ' + id + ' setup');
  for (const [file, page] of pages) check(errors, byTag(page, 'a').some(node => resolveLocal(node.attrs.href, file)?.target === 'company.html'), file + ': company lifecycle missing from navigation');
  finish(errors);
});

test('requested collaboration platforms have dedicated sourced pages and implementation details', () => {
  const errors = [];
  const requested = { jira: ['Jira', 'atlassian.com'], asana: ['Asana', 'asana.com'], slack: ['Slack', 'slack.com'], discord: ['Discord', 'discord.com'] };
  for (const [id, [name, officialHost]] of Object.entries(requested)) {
    const tool = tools.find(row => row.id === id);
    check(errors, !!tool, 'requested collaboration tool missing: ' + id);
    if (!tool) continue;
    check(errors, tool.name === name, id + ': wrong displayed platform name');
    const url = new URL(tool.officialUrl);
    check(errors, url.hostname === officialHost || url.hostname.endsWith('.' + officialHost), id + ': official product link has wrong domain');
    check(errors, !!tool.logoPath && fs.existsSync(path.join(dist, tool.logoPath)), id + ': requested genuine brand image must be embedded locally');
    const page = pages.get('tools/' + id + '.html');
    check(errors, !!page, id + ': dedicated detail page missing');
    if (page) check(errors, byTag(page, 'h1').some(node => textOf(node).trim() === name), id + ': detail page title does not identify the platform');
    check(errors, tool.implementation?.inputs?.length > 0 && tool.implementation?.outputs?.length > 0 && tool.implementation?.steps?.length > 0, id + ': workspace implementation detail missing');
  }
  const team = services.find(service => service.id === 'team-operations');
  check(errors, !!team, 'team operations service missing');
  if (team) {
    check(errors, JSON.stringify(team.capabilityGroups.map(group => group.id)) === JSON.stringify(['workspace-setup', 'delivery-control', 'community-support']), 'team operations capability hierarchy differs');
    for (const id of Object.keys(requested)) check(errors, [...team.toolIds, ...team.capabilityGroups.flatMap(group => group.toolIds)].includes(id), 'team operations does not reference ' + id);
  }
  finish(errors);
});

test('services retain complete capability hierarchy and all tool/metric references resolve', () => {
  const errors = [];
  for (const service of services) {
    const base = 'services.' + service.id;
    for (const field of ['title', 'headline', 'summary', 'problem']) check(errors, nonempty(service[field]), base + ': missing ' + field);
    for (const field of ['capabilityGroups', 'deliverables', 'workflow', 'toolIds', 'metrics']) check(errors, Array.isArray(service[field]) && service[field].length > 0, base + ': empty ' + field);
    for (const id of service.metrics || []) check(errors, known.metricIds.has(id), base + ': unknown metric ' + id);
    for (const group of service.capabilityGroups || []) {
      const location = base + '.capabilityGroups.' + group.id;
      for (const field of ['id', 'title', 'summary']) check(errors, nonempty(group[field]), location + ': missing ' + field);
      for (const field of ['deliverables', 'useCases', 'requirements', 'workflow', 'toolIds', 'metricIds']) check(errors, Array.isArray(group[field]) && group[field].length > 0, location + ': empty ' + field);
      for (const [index, stage] of (group.workflow || []).entries()) {
        check(errors, nonempty(stage.title) && nonempty(stage.description), location + '.workflow[' + index + ']: missing stage explanation');
        check(errors, Array.isArray(stage.toolIds) && stage.toolIds.length > 0, location + '.workflow[' + index + ']: tool IDs missing');
      }
    }
    checkReferences(service, base, errors);
  }
  finish(errors);
});

test('solution stages, service relationships and delivery detail references resolve', () => {
  const errors = [];
  for (const solution of solutions) {
    const base = 'solutions.' + solution.id;
    for (const field of ['title', 'summary', 'audience', 'challenge', 'humanRole', 'aiRole']) check(errors, nonempty(solution[field]), base + ': missing ' + field);
    for (const field of ['stages', 'outputs', 'metrics', 'serviceIds']) check(errors, Array.isArray(solution[field]) && solution[field].length > 0, base + ': empty ' + field);
    for (const id of solution.metrics || []) check(errors, known.metricIds.has(id), base + ': unknown metric ' + id);
    for (const [index, stage] of (solution.stages || []).entries()) {
      check(errors, nonempty(stage.title) && nonempty(stage.description), base + '.stages[' + index + ']: missing stage explanation');
      check(errors, Array.isArray(stage.toolIds) && stage.toolIds.length > 0, base + '.stages[' + index + ']: tool IDs missing');
    }
    check(errors, solution.details && typeof solution.details === 'object', base + ': missing detailed delivery layer');
    for (const field of ['inputs', 'outputs', 'automationRules', 'reviewPoints', 'dimensions', 'launchChecks']) check(errors, Array.isArray(solution.details?.[field]) && solution.details[field].length > 0, base + '.details: empty ' + field);
    checkReferences(solution, base, errors);
  }
  finish(errors);
});

test('tool implementation fields and cited/local brand asset paths are complete', () => {
  const errors = [];
  for (const tool of tools) {
    const base = 'tools.' + tool.id;
    for (const field of ['name', 'domain', 'family', 'tagline', 'description']) check(errors, nonempty(tool[field]), base + ': missing ' + field);
    for (const field of ['useCases', 'workflows', 'metrics', 'considerations', 'sourceUrls']) check(errors, Array.isArray(tool[field]) && tool[field].length > 0, base + ': empty ' + field);
    for (const field of ['inputs', 'outputs', 'steps', 'reviewPoints']) check(errors, Array.isArray(tool.implementation?.[field]) && tool.implementation[field].length > 0, base + '.implementation: empty ' + field);
    for (const url of [tool.officialUrl, tool.docsUrl, ...(tool.sourceUrls || [])]) check(errors, /^https:\/\//.test(url || ''), base + ': missing or non-HTTPS source ' + url);
    check(errors, nonempty(tool.logoSource), base + ': missing brand source attribution');
    check(errors, !!tool.logoPath || /^https:\/\//.test(tool.logoUrl || ''), base + ': no sourced local or remote image');
    if (tool.logoPath) verifyLocalReference(tool.logoPath, 'index.html', base + '.logoPath', errors);
    checkReferences(tool, base, errors);
  }
  finish(errors);
});

test('metric detail hierarchy includes definitions, examples and practical analysis', () => {
  const errors = [];
  for (const metric of metrics) {
    const base = 'metrics.' + metric.id;
    for (const field of ['name', 'category', 'subcategory', 'definition', 'formula', 'unit', 'interpretation', 'limitations']) check(errors, nonempty(metric[field]), base + ': missing ' + field);
    check(errors, metric.example && typeof metric.example.inputs === 'object' && nonempty(metric.example.explanation) && Object.hasOwn(metric.example, 'result'), base + ': incomplete example');
    check(errors, metric.analysis && typeof metric.analysis === 'object', base + ': missing analysis');
    for (const field of ['cadence', 'owner']) check(errors, nonempty(metric.analysis?.[field]), base + '.analysis: missing ' + field);
    for (const field of ['dimensions', 'diagnostics', 'actions', 'dataRequirements']) check(errors, Array.isArray(metric.analysis?.[field]) && metric.analysis[field].length > 0, base + '.analysis: empty ' + field);
    checkReferences(metric, base, errors);
  }
  finish(errors);
});

test('embedded interactive catalogs are valid JSON and match canonical content IDs', () => {
  const errors = [];
  for (const [file, page] of pages) for (const node of byTag(page, 'script').filter(x => x.attrs.type === 'application/json')) {
    let payload;
    try { payload = JSON.parse(node.rawText); } catch (error) { errors.push(file + ': invalid JSON in ' + idOf(node) + ': ' + error.message); continue; }
    const expected = { 'tool-data': tools, 'metric-data': metrics };
    if (expected[node.attrs.id]) check(errors, JSON.stringify(payload.map(x => x.id)) === JSON.stringify(expected[node.attrs.id].map(x => x.id)), file + ': embedded IDs differ in ' + node.attrs.id);
    if (node.attrs.id === 'explorer-data') for (const [field, rows] of Object.entries({ services, solutions, tools, metrics })) check(errors, Array.isArray(payload[field]) && JSON.stringify(payload[field].map(x => x.id)) === JSON.stringify(rows.map(x => x.id)), file + ': embedded explorer ' + field + ' differs');
    checkReferences(payload, file + '#' + idOf(node), errors);
  }
  finish(errors);
});

test('local SVG brand assets contain no active content or external resource references', () => {
  const errors = [], files = walkFiles(dist).filter(file => /\.svg$/i.test(file));
  assert.ok(files.length > 0, 'no SVG files found to inspect');
  for (const file of files) {
    const name = localName(file), page = assetDocument(name);
    check(errors, byTag(page, 'svg').length > 0, name + ': no SVG root');
    check(errors, !/<!ENTITY|<!DOCTYPE[^>]+(?:SYSTEM|PUBLIC)/i.test(page.source), name + ': external entity or document type');
    for (const node of page.nodes) {
      check(errors, !['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video'].includes(node.tag), name + ': active SVG element ' + node.tag);
      for (const [attribute, value] of Object.entries(node.attrs)) {
        check(errors, !/^on[a-z]/i.test(attribute), name + ': event handler ' + attribute);
        if (attribute === 'href' || attribute === 'xlink:href' || attribute === 'src') {
          const safeEmbeddedBitmap = /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value);
          check(errors, !value || value.startsWith('#') || safeEmbeddedBitmap, name + ': external/active SVG resource ' + attribute + '=' + value);
          if (value.startsWith('#')) check(errors, page.ids.has(value.slice(1)), name + ': missing SVG resource ' + value);
        }
        check(errors, !/(?:javascript:|vbscript:|expression\s*\()/i.test(value), name + ': active SVG attribute value');
        for (const match of value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
          check(errors, match[2].startsWith('#'), name + ': external SVG URL ' + match[2]);
          if (match[2].startsWith('#')) check(errors, page.ids.has(match[2].slice(1)), name + ': missing SVG URL target ' + match[2]);
        }
      }
      if (node.tag === 'style') {
        check(errors, !/@import|expression\s*\(|javascript:|vbscript:/i.test(node.rawText || ''), name + ': active SVG style');
        for (const match of (node.rawText || '').matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) check(errors, match[2].startsWith('#'), name + ': external SVG stylesheet URL ' + match[2]);
      }
    }
  }
  finish(errors);
});

