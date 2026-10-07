'use strict';
// Read-only live release verification. Usage: node checks/live-deployment-check.cjs [base-url]
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFile} = require('node:child_process');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'deployment/container-manifest.json'), 'utf8'));
const base = new URL(process.argv[2] || 'https://morespace-website-production.up.railway.app');
if (base.protocol !== 'https:') throw new Error('An HTTPS public deployment URL is required');
// curl honors the workspace HTTPS proxy; direct Node HTTPS sockets do not.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(),'morespace-live-'));
const walk = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(directory,entry.name)) : [path.join(directory,entry.name)]);
const files = walk(dist).sort();
const typeFor = file => ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'}[path.extname(file)] || 'application/octet-stream');
const sha256 = body => crypto.createHash('sha256').update(body).digest('hex');
const report = {url:base.origin,startedAt:new Date().toISOString(),expectedArchiveSha256:manifest.sha256,expectedCounts:manifest.counts,expectedFiles:manifest.files,concurrency:8,requests:0,retries:0,staticFiles:{matched:0,contentTypesMatched:0,securityHeadersMatched:0,identityMatched:0,gzipMatched:0},criticalPages:[],checks:[],failures:[],limitations:['No browser rendering or end-to-end UI interaction was performed.','External logo URLs, fonts, and third-party account integrations were not requested or tested.']};

function request(route, {method='GET',encoding='identity'} = {}) {
  return new Promise((resolve,reject) => {
    report.requests++;
    const headersFile=path.join(scratch,String(report.requests)+'.headers');
    const args=['--silent','--show-error','--max-time','20','--path-as-is','--dump-header',headersFile,'--output','-','--header','Accept-Encoding: '+encoding,'--user-agent','MoreSpace-Release-Verification/3.1'];
    if (method==='HEAD') args.push('--head');
    args.push(base.origin+route);
    execFile('curl',args,{encoding:'buffer',maxBuffer:16*1024*1024},(error,stdout,stderr)=>{
      if (error) {reject(new Error(error.message+': '+stderr.toString('utf8')));return;}
      const raw=fs.readFileSync(headersFile,'utf8');fs.unlinkSync(headersFile);
      // Proxy CONNECT and origin responses both appear in the dump; use the last status block.
      const blocks=raw.trim().split(/\r?\n\r?\n/).filter(block=>/^HTTP\//.test(block));
      const lines=blocks.at(-1).split(/\r?\n/),status=Number(lines.shift().split(/\s+/)[1]),headers={};
      for (const line of lines) {const colon=line.indexOf(':');if(colon>0) headers[line.slice(0,colon).toLowerCase()]=line.slice(colon+1).trim();}
      resolve({status,headers,body:method==='HEAD'?Buffer.alloc(0):stdout});
    });
  });
}
async function fetchRoute(route, options) {
  let error;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const result=await request(route,options);
      if (result.status>=500 && attempt<2) {report.retries++;await new Promise(resolve=>setTimeout(resolve,300));continue;}
      return result;
    } catch (failure) {
      error=failure;
      if (attempt<2) {report.retries++;await new Promise(resolve=>setTimeout(resolve,300));}
    }
  }
  throw error;
}
function security(response) {
  assert.equal(response.headers['x-content-type-options'],'nosniff');
  assert.equal(response.headers['referrer-policy'],'strict-origin-when-cross-origin');
  const csp=response.headers['content-security-policy'];
  assert.ok(csp && csp.includes("default-src 'self'") && csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'none'") && csp.includes("form-action 'self'"),'missing expected Content-Security-Policy directives');
}
async function check(name, fn) {
  try {const detail=await fn();report.checks.push({name,status:'passed',...(detail || {})});}
  catch(error) {report.checks.push({name,status:'failed'});report.failures.push({check:name,message:error.message});}
}
async function verifyFile(file) {
  const route='/'+path.relative(dist,file).split(path.sep).join('/');
  try {
    const local=fs.readFileSync(file);
    for (const encoding of ['identity','gzip']) {
      const remote=await fetchRoute(route,{encoding});
      assert.equal(remote.status,200,route+' '+encoding+' status');
      assert.equal(remote.headers['content-type'],typeFor(file),route+' content type');
      security(remote);
      assert.equal(remote.headers['cache-control'],'public, max-age=300');
      assert.ok(remote.headers.vary.toLowerCase().split(',').map(x=>x.trim()).includes('accept-encoding'));
      assert.equal(remote.headers['content-encoding'],encoding==='gzip'?'gzip':undefined);
      assert.equal(Number(remote.headers['content-length']),remote.body.length);
      const body=encoding==='gzip'?zlib.gunzipSync(remote.body):remote.body;
      assert.equal(sha256(body),sha256(local),route+' '+encoding+' SHA-256 differs from reviewed file');
      report.staticFiles[encoding==='gzip'?'gzipMatched':'identityMatched']++;
    }
    report.staticFiles.matched++;
    report.staticFiles.contentTypesMatched++;
    report.staticFiles.securityHeadersMatched++;
  } catch(error) {report.failures.push({route,message:error.message});}
}
function metadata(html) {
  return {title:html.match(/<title>(.*?)<\/title>/s)?.[1],description:html.match(/<meta name="description" content="([^"]*)"/i)?.[1],h1:html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1]};
}
async function main() {
  await check('Health endpoint matches archive checksum and all release counts',async()=>{
    const result=await fetchRoute('/health');
    assert.equal(result.status,200);security(result);
    assert.equal(result.headers['content-type'],'application/json');
    assert.equal(result.headers['cache-control'],'no-store');
    const health=JSON.parse(result.body);
    assert.deepEqual(health,{status:'ok',...manifest.counts,files:manifest.files,archiveSha256:manifest.sha256});
    report.health=health;
  });
  await check('Static file inventory matches deployment manifest',async()=>assert.equal(files.length,manifest.files));
  let index=0;
  await Promise.all(Array.from({length:8},async()=>{while(index<files.length) await verifyFile(files[index++]);}));
  await check('Every static file has matching bytes, content type, and security headers in identity and gzip responses',async()=>{
    assert.equal(report.staticFiles.matched,manifest.files);
    assert.equal(report.staticFiles.identityMatched,manifest.files);
    assert.equal(report.staticFiles.gzipMatched,manifest.files);
  });
  await check('Home route GET and HEAD return the reviewed home page',async()=>{
    const get=await fetchRoute('/');const head=await fetchRoute('/',{method:'HEAD'});
    assert.equal(get.status,200);assert.equal(head.status,200);security(get);security(head);
    assert.deepEqual(get.body,fs.readFileSync(path.join(dist,'index.html')));
    assert.equal(head.body.length,0);assert.equal(head.headers['content-type'],get.headers['content-type']);
    assert.equal(head.headers['content-length'],get.headers['content-length']);
  });
  await check('Missing route returns 404 with security headers',async()=>{
    const result=await fetchRoute('/morespace-verification-missing-page.html');
    assert.equal(result.status,404);security(result);assert.equal(result.headers['content-type'],'text/plain; charset=utf-8');
  });
  await check('Malformed percent-encoded path returns 400',async()=>{
    const result=await fetchRoute('/%ZZ');assert.equal(result.status,400);security(result);
  });
  await check('Explicit gzip refusal is respected',async()=>{
    for (const encoding of ['gzip;q=0','gzip; q=0, *;q=1']) {
      const result=await fetchRoute('/site.js',{encoding});assert.equal(result.status,200);assert.equal(result.headers['content-encoding'],undefined);
      assert.deepEqual(result.body,fs.readFileSync(path.join(dist,'site.js')));
    }
  });
  const critical=['index.html','company.html','explore.html','services/team-operations.html','tools/jira.html','tools/asana.html','tools/slack.html','tools/discord.html','tools.html','calculators.html','project.html','metrics/ltv.html'];
  await Promise.all(critical.map(async file=>{
    await check('Critical content and metadata: /'+file,async()=>{
      const result=await fetchRoute('/'+file);assert.equal(result.status,200);
      const html=result.body.toString('utf8'),local=fs.readFileSync(path.join(dist,file),'utf8');
      assert.deepEqual(metadata(html),metadata(local));
      const meta=metadata(html);assert.ok(meta.title && meta.title.includes('MoreSpace Services') && meta.description && meta.h1);
      if (file==='tools.html') assert.match(html,/76/);
      if (file==='company.html') for (const term of ['Launch','Operate','Scale','Jira','Asana','Slack','Discord']) assert.ok(html.includes(term),'company page missing '+term);
      if (file==='services/team-operations.html') for (const term of ['Jira','Asana','Slack','Discord']) assert.ok(html.includes(term));
      if (file==='project.html') assert.ok(html.includes('project brief'));
      report.criticalPages.push({route:'/'+file,title:meta.title,descriptionPresent:true,h1Present:true,sourceMatched:true});
    });
  }));
  report.criticalPages.sort((a,b)=>a.route.localeCompare(b.route));
  report.completedAt=new Date().toISOString();
  report.status=report.failures.length?'failed':'passed';
  fs.writeFileSync(path.join(root,'deployment/live-verification.json'),JSON.stringify(report,null,2)+'\n');
  fs.rmSync(scratch,{recursive:true,force:true});
  console.log(JSON.stringify({url:report.url,status:report.status,files:report.staticFiles,checksPassed:report.checks.filter(x=>x.status==='passed').length,checksTotal:report.checks.length,requests:report.requests,retries:report.retries,health:report.health,failures:report.failures},null,2));
  process.exitCode=report.failures.length?1:0;
}
main().catch(error=>{fs.rmSync(scratch,{recursive:true,force:true});console.error(error);process.exitCode=1;});
