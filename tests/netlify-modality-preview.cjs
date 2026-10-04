'use strict';
// Read-only hosted preview verification. Never follows a booking action or sends data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const refs=require('../src/reference-pages'),checks=require('../src/modality-check');
const base='https://deploy-preview-1--marriagefamilytherapy.netlify.app';
const out=path.resolve(__dirname,'../tmp/netlify-modality-preview');fs.mkdirSync(out,{recursive:true});
const commands=[],pages=[],cases=[],portraits=[];
function run(...args){try{const output=execFileSync('agent-browser',['--session','netlify-review',...args],{encoding:'utf8',timeout:45000,maxBuffer:3e6});commands.push({args,output});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));return output;}catch(e){commands.push({args,error:String(e),stderr:String(e.stderr||'')});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));throw e;}}
function check(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
function open(slug,hash=''){run('open',base+'/'+(slug?slug+'/':'')+hash);run('wait','--load','domcontentloaded');run('snapshot','-i');}
function click(selector){run('eval',`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing target');e.scrollIntoView({behavior:'instant',block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return 'READY';})()`);run('click',selector);run('snapshot','-i');}
async function get(route){const response=await fetch(base+route,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});if(!response.ok)throw Error('HTTP '+response.status+' '+route);return response;}
(async()=>{
 let marker;
 try{
  // Netlify builds separately from Actions: verify this exact commit, not an older green preview.
  for(let attempt=0;attempt<18;attempt++){
   try{marker=await(await get('/reports/review-build.json?check='+Date.now())).json();if(marker.commit===process.env.GITHUB_SHA)break;}catch(e){console.log('Waiting for review deployment:',e.message);}
   if(attempt<17)await new Promise(r=>setTimeout(r,15000));
  }
  assert.equal(marker?.commit,process.env.GITHUB_SHA,'Netlify must serve the tested commit');
  assert.equal(marker.context,'deploy-preview');assert.equal(marker.measurementEnabled,false);
  fs.writeFileSync(path.join(out,'hosted-build.json'),JSON.stringify(marker,null,2));
  for(const p of refs.modalityPages){const html=await(await get('/'+p.slug+'/')).text();assert.deepEqual(checks.validateModalityHtml(html,p),[]);pages.push({slug:p.slug,revision:refs.revision(p),pass:true});}
  const config=await(await get('/assets/mft-booking-config.js')).text();assert.match(config,/"measurementEnabled":false/);
  open('');run('screenshot',path.join(out,'home.png'));check("if(!document.querySelector('h1')||document.body.innerText.length<100)throw Error('Blank page')");
  for(const width of [1440,390]){
   run('set','viewport',String(width),'1000');
   for(const slug of ['cognitive-behavioral-therapy-cbt','dialectical-behavior-therapy-dbt','emotionally-focused-therapy-eft','integrative-therapy']){
    open(slug);
    check("if(document.querySelectorAll('h1').length!==1||document.querySelector('.breadcrumbs'))throw Error('Heading/trail');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');if(!document.querySelector('meta[name=robots]').content.includes('noindex')||window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Preview safety');if(document.querySelector('main form,main input,main textarea'))throw Error('Data collection');");
    const example=slug==='cognitive-behavioral-therapy-cbt'?'cbt-example':'worked-example';
    click('main a[href="#'+example+'"]');run('wait','--url','**#'+example);
    check("const e=document.querySelector('[data-ui=example]');if(!e||getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)')throw Error('Missing dark example treatment')");
    run('screenshot',path.join(out,slug+'-example-'+width+'.png'));
    click('#'+example+' .mft-example-reveal summary');check("if(!document.querySelector('.mft-example-reveal').open)throw Error('Example did not open')");run('press','Enter');check("if(document.querySelector('.mft-example-reveal').open)throw Error('Keyboard close failed')");
    click('.faq-grid details:first-child summary');check("if(!document.querySelector('.faq-grid details').open)throw Error('FAQ failed')");run('press','Enter');
    const result=run('eval',`(async()=>{const frames=[...document.querySelectorAll('[data-portrait-frame]')];if(!frames.length)return JSON.stringify([]);document.querySelector('#clinicians').scrollIntoView({behavior:'instant',block:'start'});const images=frames.map(f=>f.querySelector('img'));images.forEach(i=>i.loading='eager');await Promise.race([Promise.all(images.map(i=>i.decode())),new Promise((_,reject)=>setTimeout(()=>reject(Error('Portrait load timeout')),20000))]);const rows=frames.map((f,index)=>{const i=images[index],s=getComputedStyle(i),r=f.getBoundingClientRect();if(!i.naturalWidth||!i.naturalHeight||s.objectFit!=='contain'||s.transform!=='none'||Math.abs(r.width/r.height-.8)>.01)throw Error('Portrait proportion failure');return {alt:i.alt,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,frameWidth:r.width,frameHeight:r.height,objectFit:s.objectFit};});if(new Set(rows.map(r=>r.frameWidth.toFixed(1)+'x'+r.frameHeight.toFixed(1))).size!==1)throw Error('Unequal portrait frames');return JSON.stringify(rows);})()`);
    portraits.push({slug,width,result});run('screenshot',path.join(out,slug+'-portraits-'+width+'.png'));
    cases.push({slug,width,pass:true});
   }
  }
  open('therapy-approaches');check("if(document.querySelectorAll('#modality-guides [data-ui=card]').length!==32)throw Error('Incomplete directory')");click('a[href="/cognitive-behavioral-therapy-cbt/#cbt-example"]');run('wait','--url','**/cognitive-behavioral-therapy-cbt/#cbt-example');
  const browserErrors=run('errors');fs.writeFileSync(path.join(out,'browser-errors.txt'),browserErrors);assert.ok(!browserErrors.trim()||/no errors/i.test(browserErrors),browserErrors);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,base,commit:marker.commit,pages,cases,portraits,scope:'Hosted Netlify preview: full content on 31 guides; native example/FAQ/keyboard and decoded portrait checks on four guides at two widths; no booking submission, email, login, analytics or production change.'},null,2));
 }catch(e){try{run('screenshot',path.join(out,'failure.png'));}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,base,marker,pages,cases,portraits,error:String(e)},null,2));console.error(e);process.exitCode=1;}
 finally{try{run('close');}catch{}}
})();
