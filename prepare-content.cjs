'use strict';
const fs=require('fs'),path=require('path');const source=path.join(__dirname,'brand-source'),content=path.join(__dirname,'content');

const extra=JSON.parse(fs.readFileSync(path.join(source,'tool-assets-extra.json'),'utf8'));
const override=Array.isArray(extra)?Object.fromEntries(extra.map(x=>[x.id,x])):extra;
const tools=['tools-marketing','tools-software','tools-ai-data'].flatMap(n=>JSON.parse(fs.readFileSync(path.join(source,n+'.json'),'utf8')));
if(tools.length<60||new Set(tools.map(t=>t.id)).size!==tools.length)throw Error('Tool taxonomy must have at least 60 unique entries');
let embedded=0;const dir=path.join(__dirname,'dist/assets/tool-logos');fs.mkdirSync(dir,{recursive:true});
for(const t of tools){Object.assign(t,override[t.id]||{});if(t.logoSvg){const svg=t.logoSvg.trim();if(!svg.includes('<svg')||/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:)/i.test(svg))throw Error('UnsafeSVG '+t.id);fs.writeFileSync(path.join(dir,t.id+'.svg'),svg);t.logoPath='assets/tool-logos/'+t.id+'.svg';embedded++;}else if(t.logoBase64){const bytes=Buffer.from(t.logoBase64,'base64');if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG '+t.id);fs.writeFileSync(path.join(dir,t.id+'.png'),bytes);t.logoPath='assets/tool-logos/'+t.id+'.png';embedded++;}if(t.logoBackground)t.logoTheme='dark';delete t.logoSvg;delete t.logoBase64;}
fs.writeFileSync(path.join(content,'tools.json'),JSON.stringify(tools,null,2));

console.log({tools:tools.length,embeddedLogos:embedded,remoteLogos:tools.filter(t=>!t.logoPath&&t.logoUrl).length});

fs.copyFileSync(path.join(__dirname,'theme-v3.css'),path.join(__dirname,'dist/site.css'));
