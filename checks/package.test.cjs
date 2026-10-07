'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const contentJSON = name => JSON.parse(fs.readFileSync(path.join(root, 'content', name + '.json'), 'utf8'));
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const relative = file => path.relative(dist, file).split(path.sep).join('/');
const typeFor = file => ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' }[path.extname(file)] || 'application/octet-stream');

test('portable Bun archive serves every authored byte with correct content types and HTTP behavior', async () => {
  let config;
  const context = vm.createContext({ gunzipSync: zlib.gunzipSync, gzipSync: zlib.gzipSync, Buffer, Response, URL, console: { log() {} }, Bun: { env: { PORT: '4300' }, serve: value => { config = value; } } });
  const code = fs.readFileSync(path.join(root, 'railway-function.ts'), 'utf8').replace(/import \{gunzipSync,gzipSync\} from 'node:zlib';/, '');
  vm.runInContext(code, context);
  assert.equal(config.port, 4300);
  const files = walk(dist), tested = [];
  for (const file of files) {
    const route = relative(file), response = await config.fetch({ url: 'https://test.invalid/' + route, method: 'GET' });
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('content-type'), typeFor(file), route);
    assert.equal(response.headers.get('content-encoding'), 'gzip', route);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route);
    assert.deepEqual(zlib.gunzipSync(Buffer.from(await response.arrayBuffer())), fs.readFileSync(file), route);
    tested.push(route);
  }
  assert.deepEqual(tested.sort(), files.map(relative).sort());
  assert.ok(contentJSON('page-index').every(route => tested.includes(route)), 'all declared HTML routes must be packaged');
  assert.equal((await config.fetch({ url: 'https://test.invalid/', method: 'GET' })).status, 200);
  const head = await config.fetch({ url: 'https://test.invalid/tools.html', method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
  const health = await (await config.fetch({ url: 'https://test.invalid/health', method: 'GET' })).json();
  assert.deepEqual(health, { status: 'ok', ...contentJSON('site-counts') });
  assert.equal((await config.fetch({ url: 'https://test.invalid/missing.html', method: 'GET' })).status, 404);
  assert.equal((await config.fetch({ url: 'https://test.invalid/index.html', method: 'POST' })).status, 405);
  assert.equal((await config.fetch({ url: 'https://test.invalid/%ZZ', method: 'GET' })).status, 400);
});

test('portable preview preserves all real routes and embeds every local brand asset', () => {
  const html = fs.readFileSync(path.join(root, 'release/morespace-multipage-preview.html'), 'utf8');
  const pages = JSON.parse(html.match(/<script>window.MoreSpacePreviewPages=([\s\S]*?);<\/script>/)[1]);
  const assets = JSON.parse(html.match(/<script>window.MoreSpacePreviewAssets=([\s\S]*?);<\/script>/)[1]);
  assert.deepEqual(Object.keys(pages), contentJSON('page-index'));
  for (const [route, body] of Object.entries(pages)) assert.equal(body, fs.readFileSync(path.join(dist, route), 'utf8'), route);
  const expectedAssets = walk(path.join(dist, 'assets')).map(relative).sort();
  assert.deepEqual(Object.keys(assets).sort(), expectedAssets, 'every local brand asset must be present exactly once');
  for (const [file, data] of Object.entries(assets)) {
    assert.ok(data.startsWith('data:' + typeFor(file) + ';base64,'), file);
    assert.deepEqual(Buffer.from(data.split(',')[1], 'base64'), fs.readFileSync(path.join(dist, file)), file);
  }
  assert.ok(html.includes('window.MoreSpacePreviewResolveAsset'));
  assert.ok(!html.includes('<script defer src="site.js">'));
  assert.ok(!html.includes('<link rel="stylesheet" href="site.css">'));
});

test('production Node server honors PORT and serves the complete website over HTTP', async t => {
  const net = require('node:net'), { spawn } = require('node:child_process');
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['dev-server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostics = '';
  child.stderr.on('data', data => { diagnostics += data; });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await exited;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('production server startup timed out: ' + diagnostics)), 5000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('production server exited ' + code + ': ' + diagnostics)); });
    child.stdout.on('data', data => { if (String(data).includes('MoreSpace listening on ' + port)) { clearTimeout(timeout); resolve(); } });
  });
  const origin = 'http://127.0.0.1:' + port;
  const request = (route, options = {}) => fetch(origin + route, { ...options, signal: AbortSignal.timeout(5000) });
  const counts = contentJSON('site-counts');
  const health = await request('/health'); assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', ...counts });
  for (const file of walk(dist)) {
    const route = relative(file), response = await request('/' + route);
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('content-type'), typeFor(file), route);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(file), route);
  }
  const home = await request('/'); assert.equal(home.status, 200);
  assert.equal(await home.text(), fs.readFileSync(path.join(dist, 'index.html'), 'utf8'));
  const head = await request('/company.html', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await request('/not-a-real-route.html')).status, 404);
  assert.equal((await request('/index.html', { method: 'POST' })).status, 405);
  assert.equal((await request('/%ZZ')).status, 400);
});
