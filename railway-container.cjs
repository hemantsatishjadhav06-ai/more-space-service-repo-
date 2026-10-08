'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const {brotliDecompressSync, gzipSync} = require('node:zlib');

const manifest = JSON.parse(process.env.MORESPACE_MANIFEST || '{}');
if (!Number.isInteger(manifest.chunks) || manifest.chunks < 1 || manifest.chunks > 100) {
  throw new Error('Missing or invalid website manifest');
}
const parts = Array.from({length:manifest.chunks}, (_, i) => {
  const name = 'MORESPACE_ASSETS_' + String(i).padStart(3,'0');
  if (!process.env[name]) throw new Error('Missing website archive part ' + i);
  return process.env[name];
});
const compressed = Buffer.from(parts.join(''),'base64');
const checksum = crypto.createHash('sha256').update(compressed).digest('hex');
if (checksum !== manifest.sha256) throw new Error('Website archive integrity check failed');
const assets = JSON.parse(brotliDecompressSync(compressed).toString('utf8'));
if (Object.keys(assets).length !== manifest.files) throw new Error('Website file count differs from manifest');
const cache = new Map();
const aliases = Object.fromEntries(Object.entries(manifest.aliases || {}).map(([from, to]) => [from.toLowerCase(), to]));
const port = Number(process.env.PORT || 3000);
const security = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};
const server = http.createServer((req,res) => {
  if (!['GET','HEAD'].includes(req.method)) {
    res.writeHead(405,{...security,'Allow':'GET, HEAD'}); return res.end();
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
  catch { res.writeHead(400,security); return res.end('Invalid path'); }
  if (pathname === '/health') {
    const body = JSON.stringify({status:'ok',...manifest.counts,files:manifest.files,archiveSha256:checksum});
    res.writeHead(200,{...security,'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  const alias = aliases[pathname.replace(/\/+$/, '').toLowerCase()];
  const search = new URL(req.url, 'http://localhost').search;
  if (alias) { res.writeHead(301, {...security, 'Location': alias + search, 'Cache-Control': 'public, max-age=300'}); return res.end(); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  else if (!assets[pathname] && assets[pathname + '/index.html']) {
    res.writeHead(301, {...security, 'Location': new URL(req.url, 'http://localhost').pathname + '/' + search, 'Cache-Control': 'public, max-age=300'}); return res.end();
  }
  const asset = assets[pathname];
  if (!asset) { res.writeHead(404,{...security,'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
  if (!cache.has(pathname)) {
    const body = Buffer.from(asset.body,asset.encoding);
    cache.set(pathname,{body,gzip:gzipSync(body)});
  }
  const cached = cache.get(pathname);
  const encodings = String(req.headers['accept-encoding'] || '').split(',').map(item => {
    const [coding,...parameters] = item.trim().toLowerCase().split(';');
    const quality = parameters.map(p => p.trim()).find(p => p.startsWith('q='));
    return {coding:coding.trim(),quality:quality ? Number(quality.slice(2)) : 1};
  });
  const gzipPreference = encodings.find(item => item.coding === 'gzip') || encodings.find(item => item.coding === '*');
  const gzip = !!gzipPreference && gzipPreference.quality > 0;
  const body = gzip ? cached.gzip : cached.body;
  res.writeHead(200,{...security,'Content-Type':asset.type,'Content-Length':body.length,
    'Cache-Control':'public, max-age=300','Vary':'Accept-Encoding',...(gzip?{'Content-Encoding':'gzip'}:{})});
  res.end(req.method === 'HEAD' ? undefined : body);
});
server.listen(port,'0.0.0.0',() => console.log(JSON.stringify({message:'MoreSpace ready',port:server.address().port,files:manifest.files,archiveSha256:checksum})));
process.on('SIGTERM',() => server.close(() => process.exit(0)));
