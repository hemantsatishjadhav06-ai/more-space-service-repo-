// Production and local static server for dist/. The Dockerfile runs this file.
// Serves directory indexes, short share links from content/site-routes.json,
// negotiated gzip and the same security headers as the Railway container bootstrap.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';
const root=path.resolve(new URL('./dist',import.meta.url).pathname),contentDir=path.resolve(new URL('./content',import.meta.url).pathname),port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"};
const readJSON=(name,fallback)=>{try{return JSON.parse(fs.readFileSync(path.join(contentDir,name),'utf8'))}catch{return fallback}};
const aliases=Object.fromEntries(Object.entries(readJSON('site-routes.json',{}).aliases||{}).map(([from,to])=>[from.toLowerCase(),to]));
const gzipCache=new Map();
function acceptsGzip(header){
  const encodings=String(header||'').split(',').map(item=>{const [coding,...parameters]=item.trim().toLowerCase().split(';');const quality=parameters.map(p=>p.trim()).find(p=>p.startsWith('q='));return {coding:coding.trim(),quality:quality?Number(quality.slice(2)):1};});
  const preference=encodings.find(item=>item.coding==='gzip')||encodings.find(item=>item.coding==='*');
  return !!preference&&preference.quality>0;
}
function redirect(res,location){res.writeHead(301,{...security,Location:location,'Cache-Control':'public, max-age=300'});res.end();}
function notFound(res,head){res.writeHead(404,{...security,'Content-Type':'text/plain; charset=utf-8'});res.end(head?undefined:'Not found');}
http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{...security,Allow:'GET, HEAD'});return res.end();}
  const head=req.method==='HEAD';let url,pathname;
  try{url=new URL(req.url,'http://localhost');pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400,security);return res.end('Invalid path');}
  if(pathname==='/health'){res.writeHead(200,{...security,'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(head?undefined:JSON.stringify({status:'ok',...readJSON('site-counts.json',{})}));}
  const alias=aliases[pathname.replace(/\/+$/,'').toLowerCase()];
  if(alias)return redirect(res,alias+url.search);
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep))return notFound(res,head);
  let stat=null;try{stat=fs.statSync(file);}catch{}
  if(stat&&stat.isDirectory()&&fs.existsSync(path.join(file,'index.html')))return redirect(res,url.pathname+'/'+url.search);
  if(!stat||!stat.isFile())return notFound(res,head);
  const body=fs.readFileSync(file),gzip=acceptsGzip(req.headers['accept-encoding']);
  let payload=body;
  if(gzip){const key=file+':'+stat.mtimeMs+':'+stat.size;if(!gzipCache.has(key))gzipCache.set(key,zlib.gzipSync(body));payload=gzipCache.get(key);}
  res.writeHead(200,{...security,'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':payload.length,'Cache-Control':'public, max-age=300','Vary':'Accept-Encoding',...(gzip?{'Content-Encoding':'gzip'}:{})});
  res.end(head?undefined:payload);
}).listen(port,'0.0.0.0',()=>console.log('MoreSpace listening on '+port));
process.on('SIGTERM',()=>process.exit(0));
