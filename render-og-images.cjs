'use strict';
// Renders the 1200x630 Open Graph images used when a page is shared on WhatsApp,
// LinkedIn or email. Development-only: requires Playwright with Chromium.
// Output is committed to brand-source/og/ and copied into dist/og/ by the build.
//   npm run og
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {ICONS}=require('./build-industries.cjs');
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'content','industries.json'),'utf8'));
const out=path.join(__dirname,'brand-source','og');fs.mkdirSync(out,{recursive:true});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const host='morespace-website-production.up.railway.app';
const svg=(name,size)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
const page=({accent,eyebrow,title,lede,chips,icon,url})=>`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;font-family:'Inter Display','Inter',sans-serif;background:#f7f9fc;color:#162437;overflow:hidden;position:relative}
.panel{position:absolute;right:-120px;top:-160px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle at 40% 60%,${accent}26,${accent}05 70%)}
.ring{position:absolute;right:60px;top:70px;width:300px;height:300px;border-radius:84px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 40px 80px ${accent}40;transform:rotate(-6deg)}
.wrap{position:absolute;left:72px;top:64px;right:420px;bottom:60px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:30px;letter-spacing:-1.2px}.mark{display:flex;align-items:flex-end;gap:4px;height:34px}.mark i{display:block;width:9px;border-radius:2px;background:${accent};transform:skewY(-15deg)}.mark i:nth-child(1){height:19px}.mark i:nth-child(2){height:27px}.mark i:nth-child(3){height:34px}
.brand small{display:block;font:700 11px Inter,sans-serif;letter-spacing:4px;text-transform:uppercase;color:#59677b;margin-top:4px}
.eyebrow{margin-top:54px;font:700 17px Inter,sans-serif;letter-spacing:3.5px;text-transform:uppercase;color:${accent}}
h1{margin-top:18px;font-size:${title.length>30?58:68}px;line-height:1.04;font-weight:800;letter-spacing:-2.6px}
p{margin-top:20px;font:500 23px/1.45 Inter,sans-serif;color:#4a586c}
.chips{margin-top:auto;display:flex;flex-wrap:wrap;gap:9px}.chips span{font:600 15px Inter,sans-serif;padding:8px 13px;border-radius:9px;background:#fff;border:1.5px solid ${accent}33;color:#162437}
.url{position:absolute;right:72px;bottom:58px;font:600 16px Inter,sans-serif;color:#59677b;text-align:right;width:360px}.url b{display:block;color:${accent};font-size:13px;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px}
</style></head><body><div class="panel"></div><div class="ring">${svg(icon,170)}</div><div class="wrap"><div class="brand"><span class="mark"><i></i><i></i><i></i></span><span>morespace<small>${esc(eyebrow.split(' · ')[0])}</small></span></div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(lede)}</p><div class="chips">${chips.map(c=>`<span>${esc(c)}</span>`).join('')}</div></div><div class="url"><b>Open the website</b>${esc(url)}</div></body></html>`;
(async()=>{
  const browser=await chromium.launch(),tab=await browser.newPage({viewport:{width:1200,height:630}});
  const jobs=[{id:'morespace',accent:'#3d5afe',eyebrow:'Services · Industry automation',title:'More intelligence. More impact.',lede:'Marketing, software, AI automation and analytics, with a shareable website for every industry we serve.',chips:registry.slice(0,6).map(r=>r.shortName),icon:'cloud',url:host}];
  for(const r of registry)jobs.push({id:r.id,accent:r.accent,eyebrow:r.shortName+' · Automation website',title:r.name,lede:'The flagship automation, the full playbook, the '+r.journeyLabel.toLowerCase()+', the stack and how we deliver.',chips:r.segments.map(s=>s[1]).slice(0,6),icon:r.icon,url:host+'/'+r.id});
  for(const job of jobs){await tab.setContent(page(job),{waitUntil:'load'});await tab.screenshot({path:path.join(out,job.id+'.jpg'),type:'jpeg',quality:82});console.log('og/'+job.id+'.jpg',fs.statSync(path.join(out,job.id+'.jpg')).size);}
  await browser.close();
})();
