'use strict';
// Read-only verification of the public website served by the Dockerfile route.
// Usage: node checks/live-site-check.cjs [https-base-url]
// Compares every dist/ file byte for byte (identity and gzip), the health counts,
// short share links, directory redirects and error handling, then writes
// deployment/live-site-verification.json. Uses curl because it honors the
// workspace HTTPS proxy. Set EXPECTED_COMMIT to also require that commit in /health.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const base = new URL(process.argv[2] || 'https://morespace-website-production.up.railway.app');
if (base.protocol !== 'https:' && base.hostname !== 'localhost') throw new Error('An HTTPS public deployment URL is required');
const counts = JSON.parse(fs.readFileSync(path.join(root, 'content/site-counts.json'), 'utf8'));
const aliases = JSON.parse(fs.readFileSync(path.join(root, 'content/site-routes.json'), 'utf8')).aliases;
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const files = walk(dist).map(file => '/' + path.relative(dist, file).split(path.sep).join('/')).sort();
const typeFor = file => ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' }[path.extname(file)] || 'application/octet-stream');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'morespace-live-site-'));
let sequence = 0, requests = 0;

function curl(route, { method = 'GET', encoding = 'identity' } = {}) {
  const id = ++sequence, bodyFile = path.join(scratch, id + '.body'), headerFile = path.join(scratch, id + '.headers');
  const args = ['-sS', '--max-time', '30', '--retry', '2', '--retry-all-errors', '-o', bodyFile, '-D', headerFile, '-H', 'Accept-Encoding: ' + encoding, '-H', 'Cache-Control: no-cache', '-w', '%{http_code}'];
  if (method === 'HEAD') args.push('-I'); else if (method !== 'GET') args.push('-X', method);
  args.push(new URL(route, base).href);
  requests++;
  return new Promise((resolve, reject) => execFile('curl', args, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
    if (error) return reject(new Error(route + ': ' + error.message));
    const raw = fs.readFileSync(headerFile, 'utf8').split(/\r?\n\r?\n/).filter(Boolean).pop() || '';
    const headers = Object.fromEntries(raw.split(/\r?\n/).slice(1).map(line => { const i = line.indexOf(':'); return [line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]; }).filter(([k]) => k));
    // curl -I stores the response headers in the output file; a HEAD response has no body to compare.
    const body = method !== 'HEAD' && fs.existsSync(bodyFile) ? fs.readFileSync(bodyFile) : Buffer.alloc(0);
    resolve({ status: Number(stdout), headers, body });
  }));
}
async function pool(items, size, worker) {
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; results[i] = await worker(items[i]); } }));
  return results;
}

(async () => {
  const report = { url: base.origin, startedAt: new Date().toISOString(), expectedCounts: counts, expectedFiles: files.length, checks: [], failures: [] };
  const check = (name, ok, detail) => { report.checks.push({ name, passed: !!ok, ...(detail ? { detail } : {}) }); if (!ok) report.failures.push({ name, detail }); };

  const health = await curl('/health');
  let healthBody = null; try { healthBody = JSON.parse(health.body.toString('utf8')); } catch {}
  const { commit, ...reported } = healthBody || {};
  report.deployedCommit = commit || null;
  check('Health endpoint reports the expected site counts', health.status === 200 && JSON.stringify(reported) === JSON.stringify({ status: 'ok', ...counts }), healthBody);
  if (process.env.EXPECTED_COMMIT) check('Health endpoint reports the expected deployed commit', commit === process.env.EXPECTED_COMMIT, { expected: process.env.EXPECTED_COMMIT, deployed: commit || null });

  const mismatches = [];
  await pool(files, 8, async route => {
    const local = fs.readFileSync(path.join(dist, route.slice(1)));
    for (const encoding of ['identity', 'gzip']) {
      const response = await curl(route, { encoding });
      let body = response.body;
      if (response.headers['content-encoding'] === 'gzip') { try { body = zlib.gunzipSync(body); } catch { mismatches.push(route + ' ' + encoding + ': invalid gzip'); continue; } }
      if (response.status !== 200) mismatches.push(route + ' ' + encoding + ': HTTP ' + response.status);
      else if (response.headers['content-type'] !== typeFor(route)) mismatches.push(route + ': content-type ' + response.headers['content-type']);
      else if (response.headers['x-content-type-options'] !== 'nosniff' || !String(response.headers['content-security-policy'] || '').includes("frame-ancestors 'none'")) mismatches.push(route + ': security headers');
      else if (!body.equals(local)) mismatches.push(route + ' ' + encoding + ': bytes differ (' + crypto.createHash('sha256').update(body).digest('hex').slice(0, 12) + ')');
    }
  });
  check('Every static file matches its reviewed bytes, content type and security headers (identity and gzip)', mismatches.length === 0, mismatches.length ? mismatches.slice(0, 40) : { files: files.length });

  const aliasProblems = [];
  await pool(Object.entries(aliases), 6, async ([from, to]) => {
    const response = await curl(from + '?ref=check');
    if (response.status !== 301 || response.headers.location !== to + '?ref=check') aliasProblems.push(from + ': ' + response.status + ' ' + response.headers.location);
  });
  check('Short share links redirect to their industry websites', aliasProblems.length === 0, aliasProblems.length ? aliasProblems : { aliases: Object.keys(aliases).length });

  const industryDirs = fs.readdirSync(path.join(dist, 'industries'));
  const directoryProblems = [];
  await pool(industryDirs, 6, async id => {
    const index = await curl('/industries/' + id + '/');
    if (index.status !== 200 || !(index.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(index.body) : index.body).equals(fs.readFileSync(path.join(dist, 'industries', id, 'index.html')))) directoryProblems.push('/industries/' + id + '/: ' + index.status);
    const bare = await curl('/industries/' + id);
    if (bare.status !== 301 || bare.headers.location !== '/industries/' + id + '/') directoryProblems.push('/industries/' + id + ': ' + bare.status + ' ' + bare.headers.location);
  });
  check('Industry website directories serve their index and add the trailing slash', directoryProblems.length === 0, directoryProblems.length ? directoryProblems : { industries: industryDirs.length });

  const home = await curl('/');
  check('Home page is served at /', home.status === 200 && (home.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(home.body) : home.body).equals(fs.readFileSync(path.join(dist, 'index.html'))));
  const head = await curl('/industries.html', { method: 'HEAD' });
  check('HEAD returns the page headers', head.status === 200 && head.headers['content-type'] === 'text/html; charset=utf-8');
  check('Missing pages return 404', (await curl('/not-a-real-page.html')).status === 404);
  check('Unsupported methods return 405', (await curl('/index.html', { method: 'POST' })).status === 405);
  check('Invalid UTF-8 path escapes return 400', (await curl('/%FF')).status === 400);

  report.requests = requests;
  report.finishedAt = new Date().toISOString();
  report.passed = report.failures.length === 0;
  fs.writeFileSync(path.join(root, 'deployment/live-site-verification.json'), JSON.stringify(report, null, 2) + '\n');
  fs.rmSync(scratch, { recursive: true, force: true });
  console.log(JSON.stringify({ url: report.url, passed: report.passed, checks: report.checks.map(c => (c.passed ? 'PASS ' : 'FAIL ') + c.name), requests }, null, 2));
  process.exit(report.passed ? 0 : 1);
})().catch(error => { console.error(error); process.exit(1); });
