'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { loadPage } = require('./dom-adapter.cjs');
const { validateIndustry, catalogues } = require('./industry-schema.cjs');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const readJSON = name => JSON.parse(fs.readFileSync(path.join(root, 'content', name), 'utf8'));
const registry = readJSON('industries.json');
const industries = registry.map(entry => readJSON('industries/' + entry.id + '.json'));
const counts = readJSON('site-counts.json');
const manifest = readJSON('page-index.json');
const routes = readJSON('site-routes.json');
const SITE_URL = 'https://morespace-website-production.up.railway.app';
const pageUrl = file => SITE_URL + '/' + file.replace(/(^|\/)index\.html$/, '$1');
const html = file => fs.readFileSync(path.join(dist, file), 'utf8');
const attr = (source, pattern) => (source.match(pattern) || [])[1];
const decode = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pagesFor = ind => ['index', 'automations', 'journey', 'stack', 'how-we-work', ...ind.segments.map(s => s.id)].map(p => 'industries/' + ind.id + '/' + p + '.html');

test('every registered industry has validated content and the requested industries are present', () => {
  const known = catalogues();
  assert.equal(new Set(registry.map(r => r.id)).size, registry.length, 'duplicate registry ids');
  for (const id of ['hospitals', 'schools', 'ecommerce']) assert.ok(registry.some(r => r.id === id), 'requested industry missing: ' + id);
  const ecommerce = registry.find(r => r.id === 'ecommerce');
  for (const id of ['fashion-apparel', 'fmcg-grocery', 'electronics-appliances']) assert.ok(ecommerce.segments.some(s => s[0] === id), 'requested e-commerce segment missing: ' + id);
  for (const industry of industries) assert.deepEqual(validateIndustry(industry, known), [], industry.id + ' content is invalid');
  const files = fs.readdirSync(path.join(root, 'content/industries')).filter(f => f.endsWith('.json')).sort();
  assert.deepEqual(files, registry.map(r => r.id + '.json').sort(), 'content/industries must contain exactly one file per registry entry');
});

test('industry content is specific: no repeated automations, summaries or segment headlines', () => {
  const seen = new Map(), errors = [];
  for (const industry of industries) {
    const titles = industry.automations.map(a => a.title.toLowerCase());
    if (new Set(titles).size !== titles.length) errors.push(industry.id + ': duplicate automation titles');
    const headlines = industry.segments.map(s => s.headline.toLowerCase());
    if (new Set(headlines).size !== headlines.length) errors.push(industry.id + ': duplicate segment headlines');
    for (const text of [industry.summary, industry.flagship.summary, ...industry.automations.map(a => a.summary), ...industry.segments.map(s => s.summary)]) {
      const key = text.trim().toLowerCase();
      if (seen.has(key) && seen.get(key) !== industry.id) errors.push('text repeated across ' + seen.get(key) + ' and ' + industry.id + ': ' + text.slice(0, 80));
      seen.set(key, industry.id);
    }
  }
  assert.deepEqual(errors, []);
});

test('each industry website publishes its complete page set and declared counts', () => {
  const expected = industries.flatMap(pagesFor);
  for (const file of expected) assert.ok(manifest.includes(file) && fs.existsSync(path.join(dist, file)), 'missing industry page ' + file);
  const published = manifest.filter(f => f.startsWith('industries/'));
  assert.deepEqual(published.sort(), [...expected].sort(), 'unexpected or stale industry pages');
  assert.ok(manifest.includes('industries.html'), 'industry hub missing');
  assert.equal(counts.industries, industries.length);
  assert.equal(counts.industryPages, expected.length);
  assert.equal(counts.industrySegments, industries.reduce((n, x) => n + x.segments.length, 0));
  assert.equal(counts.industryAutomations, industries.reduce((n, x) => n + x.automations.length, 0));
});

test('main website, hub and README link to every industry website', () => {
  const home = html('index.html'), hub = html('industries.html'), readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(home, /href="industries\.html"/, 'home must link to the industry hub');
  for (const page of manifest.filter(f => !f.startsWith('industries/'))) assert.match(html(page), /href="(?:\.\.\/)*industries\.html"/, page + ': main navigation must include Industries');
  for (const industry of industries) {
    assert.ok(home.includes('href="industries/' + industry.id + '/index.html"'), 'home must link to ' + industry.id);
    assert.ok(hub.includes('href="industries/' + industry.id + '/index.html"'), 'hub must link to ' + industry.id);
    assert.ok(readme.includes(SITE_URL + '/industries/' + industry.id + '/'), 'README must link to the live ' + industry.id + ' website');
  }
  for (const segment of industries.find(x => x.id === 'ecommerce').segments) assert.ok(hub.includes('industries/ecommerce/' + segment.id + '.html'), 'hub must spotlight e-commerce segment ' + segment.id);
});

test('industry pages carry canonical, Open Graph and working share links', () => {
  for (const industry of industries) for (const file of pagesFor(industry)) {
    const source = html(file), url = pageUrl(file);
    assert.equal(decode(attr(source, /<link rel="canonical" href="([^"]+)"/)), url, file + ': canonical');
    assert.equal(decode(attr(source, /<meta property="og:url" content="([^"]+)"/)), url, file + ': og:url');
    const image = decode(attr(source, /<meta property="og:image" content="([^"]+)"/));
    assert.equal(image, SITE_URL + '/og/' + industry.id + '.jpg', file + ': og:image');
    assert.ok(fs.existsSync(path.join(dist, 'og', industry.id + '.jpg')), industry.id + ': share image missing');
    const whatsapp = decode(attr(source, /href="(https:\/\/wa\.me\/\?text=[^"]+)"/));
    assert.ok(whatsapp, file + ': WhatsApp share missing');
    assert.match(decodeURIComponent(new URL(whatsapp).searchParams.get('text')), /https:\/\/morespace-website-production\.up\.railway\.app\/industries\//, file + ': WhatsApp text lacks the website URL');
    const linkedin = decode(attr(source, /href="(https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=[^"]+)"/));
    assert.ok(linkedin && new URL(linkedin).searchParams.get('url').startsWith(SITE_URL + '/industries/' + industry.id + '/'), file + ': LinkedIn share URL');
    assert.ok(source.includes('data-copy-link="' + SITE_URL + '/industries/' + industry.id + '/'), file + ': copy-link button');
    assert.match(source, /href="\.\.\/\.\.\/company\.html"/, file + ': link back to the main website');
  }
});

test('automation playbooks, journeys and segment pages render every blueprint in place', () => {
  for (const industry of industries) {
    const base = 'industries/' + industry.id + '/';
    const playbook = loadPage(base + 'automations.html');
    assert.deepEqual(playbook.errors, []);
    const cards = playbook.document.querySelectorAll('[data-automation-card]');
    assert.deepEqual(cards.map(c => c.id), industry.automations.map(a => 'auto-' + a.id), industry.id + ': playbook cards');
    assert.deepEqual(playbook.document.querySelectorAll('[data-filter-stage]').map(b => b.getAttribute('data-filter-stage')), ['all', ...industry.journey.stages.map(s => s.id)]);
    assert.deepEqual(playbook.document.querySelectorAll('[data-filter-segment]').map(b => b.getAttribute('data-filter-segment')), ['all', ...industry.segments.map(s => s.id)]);
    const journey = html(base + 'journey.html');
    for (const stage of industry.journey.stages) assert.ok(journey.includes('id="stage-' + stage.id + '"'), industry.id + ': journey stage ' + stage.id);
    for (const automation of industry.automations) assert.ok(journey.includes('automations.html#auto-' + automation.id), industry.id + ': journey omits ' + automation.id);
    for (const segment of industry.segments) {
      const page = loadPage(base + segment.id + '.html');
      assert.deepEqual(page.errors, []);
      assert.deepEqual(page.document.querySelectorAll('[data-automation-card]').map(c => c.id), segment.automationIds.map(id => 'auto-' + id), segment.id + ': segment automations');
    }
    const how = html(base + 'how-we-work.html');
    for (const phase of industry.howWeWork.phases) assert.ok(how.includes('>' + phase.title.replace('&', '&amp;') + '</h2>'), industry.id + ': phase ' + phase.title);
    for (const item of industry.compliance) assert.ok(how.includes(item.sourceUrl.replace(/&/g, '&amp;')), industry.id + ': compliance source missing');
  }
});

test('playbook filters combine stage and segment, honor deep links and report counts', () => {
  for (const industry of industries) {
    const file = 'industries/' + industry.id + '/automations.html';
    const page = loadPage(file); assert.deepEqual(page.errors, []);
    const visible = () => page.document.querySelectorAll('[data-automation-card]').filter(card => !card.hidden).map(card => card.id.slice(5));
    assert.equal(visible().length, industry.automations.length);
    const stage = industry.journey.stages[1], segment = industry.segments[0];
    page.click(page.document.querySelector('[data-filter-stage="' + stage.id + '"]'));
    assert.deepEqual(visible(), industry.automations.filter(a => a.stage === stage.id).map(a => a.id), industry.id + ': stage filter');
    assert.equal(page.document.querySelector('[data-filter-stage="' + stage.id + '"]').getAttribute('aria-pressed'), 'true');
    page.click(page.document.querySelector('[data-filter-segment="' + segment.id + '"]'));
    const both = industry.automations.filter(a => a.stage === stage.id && a.segmentIds.includes(segment.id)).map(a => a.id);
    assert.deepEqual(visible(), both, industry.id + ': combined filter');
    assert.equal(page.get('automation-count').textContent, 'Showing ' + both.length + ' of ' + industry.automations.length + ' automations');
    assert.equal(page.get('automation-empty').hidden, both.length !== 0);
    page.click(page.document.querySelector('[data-filter-stage="all"]')); page.click(page.document.querySelector('[data-filter-segment="all"]'));
    assert.equal(visible().length, industry.automations.length);
    const linked = loadPage(file, { search: '?segment=' + segment.id }); assert.deepEqual(linked.errors, []);
    assert.deepEqual(linked.document.querySelectorAll('[data-automation-card]').filter(c => !c.hidden).map(c => c.id.slice(5)), industry.automations.filter(a => a.segmentIds.includes(segment.id)).map(a => a.id), industry.id + ': segment deep link');
    const invalid = loadPage(file, { search: '?stage=not-a-stage' }); assert.deepEqual(invalid.errors, []);
    assert.equal(invalid.document.querySelectorAll('[data-automation-card]').filter(c => !c.hidden).length, industry.automations.length);
  }
});

test('share buttons copy the canonical link and the brief keeps the selected industry and automation', async () => {
  const industry = industries[0], automation = industry.automations[0];
  const page = loadPage('industries/' + industry.id + '/index.html'); assert.deepEqual(page.errors, []);
  const button = page.document.querySelector('[data-copy-link]');
  page.click(button); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(page.copied, [SITE_URL + '/industries/' + industry.id + '/']);
  assert.match(button.closest('[data-share]').querySelector('[data-share-status]').textContent, /Link copied/);
  const brief = loadPage('project.html', { search: '?industry=' + industry.id + '&automation=' + automation.id }); assert.deepEqual(brief.errors, []);
  const form = brief.get('brief-form');
  assert.equal(form.elements.namedItem('industry').value, industry.name);
  assert.equal(form.elements.namedItem('automation').value, automation.title);
  for (const [name, value] of [['name', 'Asha'], ['email', 'asha@example.com'], ['company', 'Example Care'], ['objective', 'Reduce missed appointments']]) form.elements.namedItem(name).value = value;
  form.dispatchEvent({ type: 'submit' });
  const text = await brief.blobs.get(brief.downloads[0].href).text();
  assert.match(text, new RegExp('Industry: ' + industry.name.replace(/[&]/g, '\\&')));
  assert.match(text, new RegExp('Automation of interest: ' + automation.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const options = form.elements.namedItem('industry').querySelectorAll('option').map(o => o.getAttribute('data-industry-id')).filter(Boolean);
  assert.deepEqual(options, industries.map(x => x.id));
  const unknown = loadPage('project.html', { search: '?industry=unknown&automation=nothing' }); assert.deepEqual(unknown.errors, []);
  assert.equal(unknown.get('brief-form').elements.namedItem('automation').value, '');
});

test('short share links, sitemap and robots point at real pages', () => {
  const aliases = routes.aliases;
  assert.ok(Object.keys(aliases).length >= industries.length);
  for (const id of ['/hospitals', '/schools', '/ecommerce', '/fashion', '/fmcg', '/electronics']) assert.ok(aliases[id], 'short link missing: ' + id);
  for (const [from, to] of Object.entries(aliases)) {
    assert.match(from, /^\/[a-z][a-z\d-]*$/, 'alias format ' + from);
    const target = to.endsWith('/') ? to + 'index.html' : to;
    assert.ok(fs.existsSync(path.join(dist, target)), from + ' → missing target ' + to);
    const shadowed = [from.slice(1), from.slice(1) + '/index.html'].some(file => fs.existsSync(path.join(dist, file)) && fs.statSync(path.join(dist, file)).isFile());
    assert.ok(!shadowed, from + ' shadows a real page');
  }
  const sitemap = html('sitemap.xml');
  for (const file of manifest) assert.ok(sitemap.includes('<loc>' + pageUrl(file).replace(/&/g, '&amp;') + '</loc>'), 'sitemap omits ' + file);
  assert.match(html('robots.txt'), new RegExp('Sitemap: ' + SITE_URL + '/sitemap.xml'));
});

async function startServer(t) {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['dev-server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; } });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server startup timed out')), 5000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('server exited ' + code)); });
    child.stdout.on('data', data => { if (String(data).includes('MoreSpace listening on ' + port)) { clearTimeout(timeout); resolve(); } });
  });
  return port;
}
const get = (port, route, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })); });
  req.on('error', reject); req.end();
});

test('production server resolves directory indexes, trailing slashes and short share links', async t => {
  const port = await startServer(t);
  for (const industry of industries) {
    const index = await get(port, '/industries/' + industry.id + '/');
    assert.equal(index.status, 200, industry.id); assert.deepEqual(index.body, fs.readFileSync(path.join(dist, 'industries', industry.id, 'index.html')));
    assert.equal(index.headers['content-security-policy'].includes("frame-ancestors 'none'"), true);
    const bare = await get(port, '/industries/' + industry.id + '?ref=share');
    assert.equal(bare.status, 301); assert.equal(bare.headers.location, '/industries/' + industry.id + '/?ref=share');
  }
  for (const [from, to] of Object.entries(routes.aliases)) {
    const response = await get(port, from + '?utm_source=whatsapp');
    assert.equal(response.status, 301, from); assert.equal(response.headers.location, to + '?utm_source=whatsapp', from);
    const upper = await get(port, from.toUpperCase() + '/', 'HEAD');
    assert.equal(upper.status, 301, from + ' (case and trailing slash)'); assert.equal(upper.body.length, 0);
  }
  const gzip = await get(port, '/industries.html', 'GET', { 'Accept-Encoding': 'gzip' });
  assert.equal(gzip.headers['content-encoding'], 'gzip'); assert.equal(gzip.headers.vary, 'Accept-Encoding');
  assert.equal((await get(port, '/industries/../../package.json')).status, 404);
  assert.equal((await get(port, '/industries/not-an-industry/')).status, 404);
  assert.equal((await get(port, '/og/hospitals.jpg')).headers['content-type'], 'image/jpeg');
});
