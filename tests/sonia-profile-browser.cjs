'use strict';
// Candidate UI verification only. External scheduler navigation is intercepted;
// this does not claim provider availability or a hosted Netlify redirect test.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const dist=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../tmp/sonia-profile');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local');
 const redirect=fs.readFileSync(path.join(dist,'_redirects'),'utf8').split('\n').map(l=>l.split(/\s+/)).find(r=>r[0]===url.pathname);
 if(redirect){res.writeHead(+redirect[2],{Location:redirect[1]});return res.end();}
 let file=path.resolve(dist,'.'+url.pathname);if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403);return res.end();}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({args:['--no-sandbox']}),cases=[];
 try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.origin===base||u.hostname==='images.squarespace-cdn.com')return route.continue();
   if(u.hostname==='clientsecure.me'||u.hostname==='marriagefamilytherapy.clientsecure.me')return route.fulfill({contentType:'text/html',body:'<h1>Intercepted scheduler navigation</h1>'});
   return route.abort();
  });
  const page=await context.newPage();
  await page.goto(base+'/team/');await page.locator('a[href="/sonia-hassan-bio/"]').first().click();await page.waitForURL('**/sonia-hassan-bio/');
  await page.getByRole('heading',{name:'About Sonia',exact:true}).waitFor();await page.getByRole('heading',{name:'My Approach',exact:true}).waitFor();
  const geometry=await page.evaluate(async()=>{
   const img=document.querySelector('[data-clinician-hero] img');await img.decode();await document.fonts.ready;
   return {fit:getComputedStyle(img).objectFit,overflow:document.documentElement.scrollWidth>innerWidth+2,loaded:img.naturalWidth>0,treatment:document.querySelector('[data-clinician-hero]').dataset.heroTreatment};
  });assert.deepEqual(geometry,{fit:'contain',overflow:false,loaded:true,treatment:'green-blend'});
  await page.screenshot({path:path.join(out,'sonia-'+width+'.png'),fullPage:true});
  await page.locator('[data-clinician-hero] a[data-mft-booking]').click();await page.waitForURL('https://clientsecure.me/**');
  assert.equal(new URL(page.url()).searchParams.get('clinicianId'),'2065412');assert.equal(context.pages().length,1);
  for(const legacy of ['/new-page-47','/new-page-47/']){
   const response=await context.request.get(base+legacy,{maxRedirects:0});assert.equal(response.status(),301);assert.equal(response.headers().location,'/sonia-hassan-bio/');
   await page.goto(base+legacy);assert.equal(new URL(page.url()).pathname,'/sonia-hassan-bio/');
  }
  const hero=await page.locator('[data-clinician-hero]').evaluate(e=>({treatment:e.dataset.heroTreatment,heading:e.querySelector('h1').textContent}));assert.equal(hero.heading,'Sonia Hassan');
  // Header consultation uses the established acknowledgment gate and general URL.
  if(width<760)await page.locator('.menu-button').click();
  await page.locator('header a[data-mft-booking]').click();await page.locator('dialog[open]').waitFor();
  const go=page.locator('[data-consultation-continue]');assert.equal(await go.getAttribute('href'),null);
  await page.locator('dialog input[type=checkbox]').check();assert.equal(await go.getAttribute('href'),'https://marriagefamilytherapy.clientsecure.me/request');
  await go.click();await page.waitForURL('https://marriagefamilytherapy.clientsecure.me/request');assert.equal(context.pages().length,1);
  cases.push({width,pass:true,geometry,legacyRedirects:2,soniaId:'2065412',scheduler:'intercepted native navigation; no provider submission'});await context.close();
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,cases,scope:'Local candidate with repository redirect rules emulated; external scheduler responses intercepted. Hosted preview and real provider handoff remain release checks.'},null,2)+'\n');
 console.log(JSON.stringify({pass:true,cases}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
