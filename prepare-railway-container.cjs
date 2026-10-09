'use strict';
const fs = require('node:fs'),path = require('node:path'),crypto = require('node:crypto'),zlib = require('node:zlib');
const root=__dirname,dist=path.join(root,'dist'),out=path.join(root,'deployment');
fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
// Share-preview images (dist/og/) are served by the Dockerfile route only; leaving them out keeps this environment archive within its budget.
const excluded=file=>path.relative(dist,file).split(path.sep)[0]==='og';
const assets={};
for(const file of walk(dist).filter(file=>!excluded(file))) {
  const name='/'+path.relative(dist,file).split(path.sep).join('/'),type=types[path.extname(file)]||'application/octet-stream';
  const encoding=/^(text\/|application\/xml|image\/svg)/.test(type)?'utf8':'base64';
  assets[name]={type,body:fs.readFileSync(file).toString(encoding),encoding};
}
const compressed=zlib.brotliCompressSync(Buffer.from(JSON.stringify(assets)),{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}});
const base64=compressed.toString('base64'),size=24*1024,chunks=Math.ceil(base64.length/size);
const counts=JSON.parse(fs.readFileSync(path.join(root,'content/site-counts.json'),'utf8'));
const routes=fs.existsSync(path.join(root,'content/site-routes.json'))?JSON.parse(fs.readFileSync(path.join(root,'content/site-routes.json'),'utf8')):{};
const manifest={encoding:'brotli-base64',chunks,files:Object.keys(assets).length,sha256:crypto.createHash('sha256').update(compressed).digest('hex'),counts,aliases:routes.aliases||{}};
const variables={NODE_ENV:'production',PORT:'3000',MORESPACE_MANIFEST:JSON.stringify(manifest),MORESPACE_BOOT:fs.readFileSync(path.join(root,'railway-container.cjs')).toString('base64')};
for(let i=0;i<chunks;i++) variables['MORESPACE_ASSETS_'+String(i).padStart(3,'0')]=base64.slice(i*size,(i+1)*size);
const environmentBytes=Object.entries(variables).reduce((sum,[k,v])=>sum+Buffer.byteLength(k+'='+v)+1,0);
if(environmentBytes>1024*1024) throw new Error('Website environment exceeds the deployment budget');
const startCommand=`node -e "eval(Buffer.from(process.env.MORESPACE_BOOT,'base64').toString('utf8'))"`;
fs.writeFileSync(path.join(out,'container-variables.json'),JSON.stringify(variables));
fs.writeFileSync(path.join(out,'container-manifest.json'),JSON.stringify({...manifest,image:'node:22-alpine',startCommand,environmentBytes,largestVariableBytes:Math.max(...Object.values(variables).map(v=>Buffer.byteLength(v)))},null,2));
console.log({files:manifest.files,chunks,environmentBytes,largestVariableBytes:Math.max(...Object.values(variables).map(v=>Buffer.byteLength(v))),archiveSha256:manifest.sha256});
