'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const variables = JSON.parse(fs.readFileSync(path.join(root, 'deployment/container-variables.json'), 'utf8'));
const manifest = JSON.parse(variables.MORESPACE_MANIFEST);
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const typeFor = file => ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' }[path.extname(file)] || 'application/octet-stream');
const command = "eval(Buffer.from(process.env.MORESPACE_BOOT,'base64').toString('utf8'))";
function launch(overrides = {}) {
  return spawn(process.execPath, ['-e', command], { cwd: root, env: { ...process.env, ...variables, PORT: '0', ...overrides }, stdio: ['ignore', 'pipe', 'pipe'] });
}
async function ready(child) {
  return new Promise((resolve, reject) => {
    let output = '', errors = '';
    const timeout = setTimeout(() => reject(new Error('container launcher startup timed out: ' + output + errors)), 5000);
    child.stderr.on('data', chunk => { errors += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('container launcher exited ' + code + ': ' + errors)); });
    child.stdout.on('data', chunk => {
      output += chunk;
      for (const line of output.split('\n')) {
        let data; try { data = JSON.parse(line); } catch { continue; }
        if (data.message === 'MoreSpace ready') { clearTimeout(timeout); resolve(data); }
      }
    });
  });
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill(); await exited;
}
function request(port, route, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.once('error', reject);
      response.once('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('container HTTP request timed out')));
    req.once('error', reject); req.end();
  });
}

test('container deployment archive and bootstrap match the complete reviewed source', () => {
  assert.deepEqual(Buffer.from(variables.MORESPACE_BOOT, 'base64'), fs.readFileSync(path.join(root, 'railway-container.cjs')), 'container bootstrap was not regenerated after source changes');
  assert.equal(manifest.encoding, 'brotli-base64');
  assert.ok(Number.isInteger(manifest.chunks) && manifest.chunks > 0 && manifest.chunks <= 100);
  const keys = Object.keys(variables).filter(name => name.startsWith('MORESPACE_ASSETS_')).sort();
  assert.deepEqual(keys, Array.from({ length: manifest.chunks }, (_, index) => 'MORESPACE_ASSETS_' + String(index).padStart(3, '0')));
  for (const key of keys) assert.ok(Buffer.byteLength(variables[key]) <= 24 * 1024, key + ': chunk is larger than its per-variable budget');
  const compressed = Buffer.from(keys.map(key => variables[key]).join(''), 'base64');
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');
  assert.equal(sha256, manifest.sha256);
  const assets = JSON.parse(zlib.brotliDecompressSync(compressed).toString('utf8'));
  const files = walk(dist);
  assert.equal(Object.keys(assets).length, manifest.files);
  assert.deepEqual(Object.keys(assets).sort(), files.map(file => '/' + path.relative(dist, file).split(path.sep).join('/')).sort());
  for (const file of files) {
    const route = '/' + path.relative(dist, file).split(path.sep).join('/'), asset = assets[route];
    assert.equal(asset.type, typeFor(file), route);
    assert.deepEqual(Buffer.from(asset.body, asset.encoding), fs.readFileSync(file), route);
  }
  assert.deepEqual(manifest.counts, JSON.parse(fs.readFileSync(path.join(root, 'content/site-counts.json'), 'utf8')));
});

test('standard container launcher serves all reviewed bytes, health metadata and HTTP methods', async t => {
  const child = launch(); t.after(() => stop(child));
  const startup = await ready(child);
  assert.ok(Number.isInteger(startup.port) && startup.port > 0, 'container must honor the PORT environment variable');
  assert.equal(startup.archiveSha256, manifest.sha256); assert.equal(startup.files, manifest.files);
  const health = await request(startup.port, '/health');
  assert.equal(health.status, 200); assert.equal(health.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(health.body), { status: 'ok', ...manifest.counts, files: manifest.files, archiveSha256: manifest.sha256 });
  for (const file of walk(dist)) {
    const route = '/' + path.relative(dist, file).split(path.sep).join('/');
    for (const encoding of ['identity', 'gzip']) {
      const response = await request(startup.port, route, { 'Accept-Encoding': encoding });
      assert.equal(response.status, 200, route + ' ' + encoding);
      assert.equal(response.headers['content-type'], typeFor(file), route);
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers['vary'], 'Accept-Encoding');
      assert.equal(Number(response.headers['content-length']), response.body.length, route);
      assert.equal(response.headers['content-encoding'], encoding === 'gzip' ? 'gzip' : undefined, route);
      const bytes = encoding === 'gzip' ? zlib.gunzipSync(response.body) : response.body;
      assert.deepEqual(bytes, fs.readFileSync(file), route + ' ' + encoding);
    }
  }
  const home = await request(startup.port, '/'); assert.equal(home.status, 200); assert.deepEqual(home.body, fs.readFileSync(path.join(dist, 'index.html')));
  for (const [route, status] of [['/company.html', 200], ['/health', 200], ['/missing-page.html', 404]]) {
    const head = await request(startup.port, route, { 'Accept-Encoding': 'gzip' }, 'HEAD');
    assert.equal(head.status, status); assert.equal(head.body.length, 0, route + ': HEAD response must have no body');
  }
  const unsupported = await request(startup.port, '/index.html', {}, 'POST'); assert.equal(unsupported.status, 405); assert.equal(unsupported.headers.allow, 'GET, HEAD');
  assert.equal((await request(startup.port, '/missing-page.html')).status, 404);
  assert.equal((await request(startup.port, '/%ZZ')).status, 400);
});

test('container gzip negotiation respects explicit zero quality and supports accepted encodings', async t => {
  const child = launch(); t.after(() => stop(child)); const startup = await ready(child);
  for (const encoding of ['', 'identity', 'br', 'gzip;q=0', 'gzip;q=0.0', 'GZIP; q=0.000, br;q=1', '*;q=1, gzip;q=0']) {
    const response = await request(startup.port, '/index.html', { 'Accept-Encoding': encoding });
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-encoding'], undefined, 'gzip was explicitly rejected or not accepted: ' + encoding);
    assert.deepEqual(response.body, fs.readFileSync(path.join(dist, 'index.html')), encoding);
  }
  for (const encoding of ['gzip', 'gzip;q=1', 'br;q=1, gzip;q=0.5', 'GZIP; q=0.1', '*;q=0.7']) {
    const response = await request(startup.port, '/index.html', { 'Accept-Encoding': encoding });
    assert.equal(response.headers['content-encoding'], 'gzip', encoding);
    assert.deepEqual(zlib.gunzipSync(response.body), fs.readFileSync(path.join(dist, 'index.html')), encoding);
  }
});

test('container launcher rejects missing, corrupt and inconsistent website archives before listening', async () => {
  const sourceManifest = { ...manifest };
  const brokenCompressed = Buffer.from('this is not a Brotli stream');
  const brokenJSON = zlib.brotliCompressSync(Buffer.from('this is not JSON'));
  const archiveEnvironment = bytes => ({ MORESPACE_MANIFEST: JSON.stringify({ ...sourceManifest, chunks: 1, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }), MORESPACE_ASSETS_000: bytes.toString('base64') });
  const cases = [
    { name: 'invalid manifest JSON', env: { MORESPACE_MANIFEST: '{' }, error: /SyntaxError|JSON/ },
    { name: 'invalid compression stream with valid checksum', env: archiveEnvironment(brokenCompressed), error: /Decompression|ERR_|brotli/i },
    { name: 'invalid archive JSON with valid compression and checksum', env: archiveEnvironment(brokenJSON), error: /SyntaxError|JSON/ },
    { name: 'missing manifest', env: { MORESPACE_MANIFEST: '' }, error: /Missing or invalid website manifest/ },
    { name: 'missing archive chunk', env: { MORESPACE_ASSETS_000: '' }, error: /Missing website archive part 0/ },
    { name: 'bad archive checksum', env: { MORESPACE_MANIFEST: JSON.stringify({ ...sourceManifest, sha256: '0'.repeat(64) }) }, error: /Website archive integrity check failed/ },
    { name: 'corrupt archive content', env: { MORESPACE_ASSETS_000: 'AAAA' + variables.MORESPACE_ASSETS_000.slice(4) }, error: /Website archive integrity check failed/ },
    { name: 'inconsistent file count', env: { MORESPACE_MANIFEST: JSON.stringify({ ...sourceManifest, files: sourceManifest.files + 1 }) }, error: /Website file count differs from manifest/ },
    { name: 'invalid chunk count', env: { MORESPACE_MANIFEST: JSON.stringify({ ...sourceManifest, chunks: 101 }) }, error: /Missing or invalid website manifest/ }
  ];
  for (const entry of cases) {
    const child = launch(entry.env); let output = '', errors = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { errors += data; });
    const code = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill(); reject(new Error(entry.name + ': invalid archive did not terminate')); }, 5000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); resolve(code); });
    });
    assert.notEqual(code, 0, entry.name + ': invalid deployment must fail');
    assert.doesNotMatch(output, /MoreSpace ready/, entry.name + ': an invalid archive must not start listening');
    assert.match(errors, entry.error, entry.name);
  }
});
