'use strict';
// Browser verification of public explanations only. No real account or appointment writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/marriage-reset-browser');
const mr=require('../src/marriage-reset');fs.mkdirSync(out,{recursive:true});const cases=[],commands=[];
function run(...args){try{const text=execFileSync('agent-browser',['--session','mr-review',...args],{encoding:'utf8',timeout:45000,maxBuffer:4e6});commands.push({args,output:text});return text;}catch(e){commands.push({args,error:String(e),stderr:String(e.stderr||'')});throw e;}finally{fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));}}
function check(js){return run('eval',`(()=>{${js};return 'PASS';})()`);}
function open(slug){run('open','http://127.0.0.1:4198/'+(slug?slug+'/':''));run('wait','--load','domcontentloaded');run('snapshot','-i');}
function click(selector,tail){
 run('eval',`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing target');e.scrollIntoView({behavior:'instant',block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);if(!hit||!(e===hit||e.contains(hit)))throw Error('Obscured target');return 'VISIBLE';})()`);
 run('click',selector);if(tail)run('wait','--url','**'+tail);run('snapshot','-i');
}
const server=http.createServer((req,res)=>{let url;try{url=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}let f=path.resolve(dist,'.'+url);if(f!==dist&&!f.startsWith(dist+path.sep)){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.setHeader('X-Robots-Tag','noindex,nofollow');fs.createReadStream(f).pipe(res);});
if(process.argv.includes('--worker')){
 try{
  open('marriagereset');run('screenshot',path.join(out,'initial.png'));check("if(!document.querySelector('h1')||document.body.innerText.length<100)throw Error('Blank page');if(document.querySelector('[data-nextjs-dialog],.vite-error-overlay'))throw Error('Error overlay')");
  for(const width of [1440,768,390,320]){
   run('set','viewport',String(width),'1000');
   for(const slug of mr.routes){
    open(slug);check("if(document.querySelectorAll('h1').length!==1)throw Error('H1');if(!document.querySelector('[data-marriage-reset]'))throw Error('Missing model');if(document.querySelector('.breadcrumbs,main .hero-media,main form,main input,main textarea'))throw Error('Legacy image/form/breadcrumb');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Overflow');if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexing');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled');if(!document.querySelector('.brand img')?.naturalWidth)throw Error('Brand missing');for(const a of document.querySelectorAll('main [data-mr-client-access]'))if(a.href!=='https://ops.mft.care/'||a.hasAttribute('data-mft-booking'))throw Error('Sign-in conflated with booking')");
    if(!slug.endsWith('/thanks')){
     if(slug==='marriagereset'){
      check("if(getComputedStyle(document.querySelector('#the-journey')).backgroundColor!=='rgb(16, 47, 46)')throw Error('Journey color');if(document.querySelectorAll('.mr-cycle-grid>li').length!==5)throw Error('Journey stages');if(getComputedStyle(document.querySelector('#measure')).backgroundColor!=='rgb(16, 47, 46)')throw Error('Progress feature color')");
      for(const stage of mr.steps){click('.mr-cycle-grid a[href="#'+stage.id+'"]');check(`if(location.hash!=='#${stage.id}'||document.activeElement.id!=='${stage.id}')throw Error('Journey focus');`);}
     }
     click('#why-it-changes .mft-disclosure summary');check("if(!document.querySelector('#why-it-changes details').open)throw Error('Disclosure')");run('press','Enter');check("if(document.querySelector('#why-it-changes details').open)throw Error('Keyboard disclosure')");
     click('#questions details:first-of-type summary');check("if(!document.querySelector('#questions details').open)throw Error('FAQ')");run('press','Enter');check("if(document.querySelector('#questions details').open)throw Error('Keyboard FAQ')");
     if(width===1440||width===390){run('eval','window.scrollTo({top:0,behavior:"instant"})');run('screenshot',path.join(out,slug+'-'+width+'.png'),'--full');if(slug==='marriagereset'){run('eval','document.querySelector("#the-journey").scrollIntoView({behavior:"instant",block:"start"})');run('screenshot',path.join(out,'journey-'+width+'.png'));run('eval','document.querySelector("#measure").scrollIntoView({behavior:"instant",block:"start"})');run('screenshot',path.join(out,'progress-'+width+'.png'));}}
    }
    cases.push({slug,width,pass:true});
   }
  }
  run('set','viewport','1440','1000');open('');click('.primary-nav a[href="/marriagereset/"]','/marriagereset/');click('.quick-actions a[href="/marriage-reset-assessment/"]','/marriage-reset-assessment/');click('.quick-actions a[href="/marriagereset/"]','/marriagereset/');
  run('set','viewport','390','900');open('');click('.menu-button');click('.primary-nav a[href="/marriagereset/"]','/marriagereset/');
  const errors=run('errors');fs.writeFileSync(path.join(out,'browser-errors.txt'),errors);if(errors.trim()&&!/no errors/i.test(errors))throw Error(errors);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,revision:mr.revision,cases,source:mr.copy.source,navigation:['home','Marriage.Reset','assessment explanation','Marriage.Reset'],scope:'Built-output browser checks. No authentication, invitations, assessments, appointments, emails, payments, or tracking writes.'},null,2));
 }catch(error){try{run('screenshot',path.join(out,'failure.png'));}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,cases,error:String(error)},null,2));process.exitCode=1;}
 finally{try{run('close');}catch{}}
}else server.listen(4198,'127.0.0.1',()=>{const worker=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});worker.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});
