'use strict';
// Test real interactions on built output. No appointment, email, login or tracking writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/concern-browser');
const {order}=require('../src/concern-guides');
fs.mkdirSync(out,{recursive:true});const cases=[],commands=[];
function run(...args){try{const output=execFileSync('agent-browser',['--session','concern-review',...args],{encoding:'utf8',timeout:45000,maxBuffer:5e6});commands.push({args,output});return output;}catch(e){commands.push({args,error:String(e),stderr:String(e.stderr||'')});throw e;}finally{fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));}}
function check(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
function open(slug){run('open','http://127.0.0.1:4196/'+(slug?slug+'/':''));run('wait','--load','domcontentloaded');run('snapshot','-i');}
function click(selector,tail){
 run('eval',`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing click target');e.scrollIntoView({behavior:'instant',block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);if(!hit||!(hit===e||e.contains(hit)))throw Error('Obscured click target');return 'VISIBLE';})()`);
 run('click',selector);if(tail)run('wait','--url','**'+tail);run('snapshot','-i');
}
const server=http.createServer((req,res)=>{let url;try{url=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}let f=path.resolve(dist,'.'+url);if(f!==dist&&!f.startsWith(dist+path.sep)){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.setHeader('X-Robots-Tag','noindex,nofollow');fs.createReadStream(f).pipe(res);});
if(process.argv.includes('--worker')){
 try{
  open('what-we-help-with');run('screenshot',path.join(out,'initial-hub.png'));check("if(!document.querySelector('h1')||document.body.innerText.length<100)throw Error('Blank page');if(document.querySelector('[data-nextjs-dialog],.vite-error-overlay'))throw Error('Error overlay')");
  for(const width of [1440,768,390,320]){
   run('set','viewport',String(width),'1000');
   for(const slug of ['what-we-help-with',...order]){
    open(slug);
    check("if(document.querySelectorAll('h1').length!==1)throw Error('H1');if(document.querySelector('.breadcrumbs'))throw Error('Breadcrumb');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');if(document.querySelector('main .hero-media'))throw Error('Decorative hero remains');if(!document.querySelector('.brand img')?.naturalWidth)throw Error('Missing brand');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled');if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexing enabled');if(document.querySelector('main form,main input,main textarea'))throw Error('Added data collection')");
    if(slug==='what-we-help-with'){
     check("if(document.querySelectorAll('#concern-guides .question-grid>a').length!==10)throw Error('Directory size');if(getComputedStyle(document.querySelector('#concern-guides')).backgroundColor!=='rgb(16, 47, 46)')throw Error('Dark section');for(const c of document.querySelectorAll('#concern-guides .question-grid>a'))if(getComputedStyle(c).backgroundColor!=='rgb(23, 62, 60)')throw Error('Solid card treatment')");
     if(width===1440||width===390){run('screenshot',path.join(out,'concern-hub-'+width+'.png'),'--full');run('eval',"document.querySelector('#concern-guides').scrollIntoView({behavior:'instant',block:'start'})");run('screenshot',path.join(out,'concern-cards-'+width+'.png'));}
    }else{
     check("if(!document.querySelector('[data-reference-page]'))throw Error('Legacy concern body');for(const type of ['hero','panel','cards','example','disclosures','faq','clinicians'])if(!document.querySelector('[data-ui='+type+']'))throw Error('Missing component '+type)");
     if(slug!=='anxiety-stress-therapy')check("for(const c of document.querySelectorAll('.mft-solid-cards details'))if(getComputedStyle(c).backgroundColor!=='rgb(23, 62, 60)')throw Error('Concern card treatment')");
     click('.mft-example-reveal summary');check("if(!document.querySelector('.mft-example-reveal').open)throw Error('Example opening')");run('press','Enter');check("if(document.querySelector('.mft-example-reveal').open)throw Error('Example keyboard close')");
     click('.mft-disclosure summary');check("if(!document.querySelector('.mft-disclosure').open)throw Error('Expandable card opening')");run('press','Enter');check("if(document.querySelector('.mft-disclosure').open)throw Error('Expandable card keyboard close')");
     click('.home-faq details:first-of-type summary');check("if(!document.querySelector('.home-faq details').open)throw Error('FAQ opening')");run('press','Enter');check("if(document.querySelector('.home-faq details').open)throw Error('FAQ keyboard close')");
     click('.mft-citations a');check("if(!location.hash.startsWith('#source-')||document.activeElement.id!==location.hash.slice(1))throw Error('Source focus/navigation')");
     if(width===1440||width===390){run('eval','window.scrollTo({top:0,behavior:"instant"})');run('screenshot',path.join(out,slug+'-'+width+'.png'),'--full');}
    }
    cases.push({slug,width,pass:true});
   }
  }
  for(const width of [1440,390]){run('set','viewport',String(width),'1000');for(const slug of ['marriage-and-couples-therapy-counseling','childrentherapy','online-therapy-king-county-wa','google/couples-therapy']){open(slug);check("if(document.querySelector('.hero-media'))throw Error('Repeated hero');const nativeService=['/marriage-and-couples-therapy-counseling/','/childrentherapy/'].includes(location.pathname);if(nativeService){if(!document.querySelector('main[data-page-family=service] .home-hero[data-ui=hero]'))throw Error('Missing shared service hero');}else if(!document.querySelector('.mft-typographic-hero'))throw Error('Missing image-free composition');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Image-free overflow')");cases.push({slug,width,imageFree:true,pass:true});}}
  run('set','viewport','1440','1000');open('');click('a[href="/what-we-help-with/"]','/what-we-help-with/');click('#concern-guides a[href="/depression-therapy/"]','/depression-therapy/');click('#clinicians a[href="/gary-ashley/"]','/gary-ashley/');check("if(!document.querySelector('main a[data-spwidget-clinician-id=\"2154633\"]'))throw Error('Gary booking mapping');if(document.querySelectorAll('.hero-media').length!==1)throw Error('Meaningful profile portrait removed')");
  open('cognitive-behavioral-therapy-cbt');run('eval',"document.querySelector('#clinicians').scrollIntoView({behavior:'instant',block:'start'})");
  const portraits=run('eval',"(async()=>{const images=[...document.querySelectorAll('[data-portrait-frame] img')];await Promise.race([Promise.all(images.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});}))),new Promise(r=>setTimeout(r,8000))]);return JSON.stringify(images.map(i=>({alt:i.alt,loaded:i.naturalWidth>0,natural:[i.naturalWidth,i.naturalHeight],fit:getComputedStyle(i).objectFit,frameRatio:i.parentElement.clientWidth/i.parentElement.clientHeight})));})()");fs.writeFileSync(path.join(out,'portrait-measurements.txt'),portraits);check("for(const i of document.querySelectorAll('[data-portrait-frame] img'))if(getComputedStyle(i).objectFit!=='contain')throw Error('Portrait fit')");run('screenshot',path.join(out,'cbt-portraits.png'));
  run('set','viewport','390','900');open('what-we-help-with');click('.menu-button');check("if(document.querySelector('.menu-button').getAttribute('aria-expanded')!=='true')throw Error('Menu open')");run('press','Escape');check("if(document.querySelector('.menu-button').getAttribute('aria-expanded')!=='false')throw Error('Menu close')");
  const errors=run('errors');fs.writeFileSync(path.join(out,'browser-errors.txt'),errors);if(errors.trim()&&!/no errors/i.test(errors))throw Error(errors);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,cases,navigation:['home','By concern','depression','Gary','booking configuration inspected only'],scope:'Built output tested in CI, not an authenticated Netlify session. No appointments, messages, logins or tracking changes.'},null,2));
 }catch(error){try{run('screenshot',path.join(out,'failure.png'));}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,cases,error:String(error)},null,2));process.exitCode=1;}
 finally{try{run('close');}catch{}}
}else server.listen(4196,'127.0.0.1',()=>{const worker=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});worker.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});
