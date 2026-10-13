'use strict';
// Built-output UI checks. Never submits appointments, emails, logins or measurements.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/reference-browser');
fs.mkdirSync(out,{recursive:true});const cases=[],commands=[];
const routes=['','new-page','anxiety-stress-therapy','cognitive-behavioral-therapy-cbt'];
function run(...args){try{const output=execFileSync('agent-browser',['--session','reference-review',...args],{encoding:'utf8',timeout:45000,maxBuffer:3e6});commands.push({args,output});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));return output;}catch(e){commands.push({args,error:String(e),stderr:String(e.stderr||'')});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));throw e;}}
function check(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
function open(slug){run('open','http://127.0.0.1:4197/'+(slug?slug+'/':''));run('wait','--load','domcontentloaded');run('snapshot','-i');}
function click(selector,tail){
 run('eval',`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing target');e.scrollIntoView({behavior:'instant',block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);if(!h||!(h===e||e.contains(h)))throw Error('Hit target obscured');return 'VISIBLE';})()`);
 run('click',selector);if(tail)run('wait','--url','**'+tail);run('snapshot','-i');
}
const server=http.createServer((req,res)=>{let url;try{url=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}let f=path.resolve(dist,'.'+url);if(f!==dist&&!f.startsWith(dist+path.sep)){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.setHeader('X-Robots-Tag','noindex,nofollow');fs.createReadStream(f).pipe(res);});
if(process.argv.includes('--worker')){
 try{
  open('');run('screenshot',path.join(out,'home-initial.png'));check("if(!document.querySelector('h1')||document.body.innerText.length<100)throw Error('Blank page');if(document.querySelector('[data-nextjs-dialog],.vite-error-overlay'))throw Error('Error overlay')");
  for(const width of [1440,768,390,320]){
   run('set','viewport',String(width),'1000');
   for(const slug of routes){
    open(slug);
    check("if(document.querySelectorAll('h1').length!==1)throw Error('H1');if(document.querySelector('.breadcrumbs'))throw Error('Unwanted trail');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Overflow');if(!document.querySelector('.brand img')?.naturalWidth)throw Error('Brand missing');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled');if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexing');if(document.querySelector('main form,main input,main textarea'))throw Error('Data entry added')");
    if(slug){
     check("if(!document.querySelector('[data-reference-page]'))throw Error('Legacy composition');for(const type of ['hero','panel','cards','steps','faq','button'])if(!document.querySelector('[data-ui='+type+']'))throw Error('Missing shared component '+type)");
     click('.mft-example-reveal summary');check("if(!document.querySelector('.mft-example-reveal').open)throw Error('Example did not open')");run('press','Enter');check("if(document.querySelector('.mft-example-reveal').open)throw Error('Keyboard example toggle')");
     click('.home-faq details:first-of-type summary');check("if(!document.querySelector('.home-faq details').open)throw Error('FAQ did not open')");run('press','Enter');check("if(document.querySelector('.home-faq details').open)throw Error('Keyboard FAQ toggle')");
     click('.mft-citations a');check("if(!location.hash.startsWith('#source-')||document.activeElement.id!==location.hash.slice(1))throw Error('Source target/focus')");
     if(slug!=='new-page'){click('.mft-disclosure summary');check("if(!document.querySelector('.mft-disclosure').open)throw Error('Disclosure did not open')");run('press','Enter');check("if(document.querySelector('.mft-disclosure').open)throw Error('Keyboard disclosure toggle')");}
    }
    run('eval','window.scrollTo(0,0)');
    if(width===1440||width===390)run('screenshot',path.join(out,(slug||'home')+'-'+width+'.png'),'--full');
    const visual=run('eval',"JSON.stringify({hero:getComputedStyle(document.querySelector('[data-ui=hero]')).gridTemplateColumns,cardRadius:getComputedStyle(document.querySelector('[data-ui=card]')).borderRadius,panelBackground:getComputedStyle(document.querySelector('[data-ui=panel]')).backgroundColor,portraits:[...document.querySelectorAll('.mft-clinician-top img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,alt:i.alt}))})");
    cases.push({slug:slug||'/',width,pass:true,visual});
   }
  }
  run('set','viewport','1440','1000');open('');click('.question-grid a[href="/new-page/"]','/new-page/');click('#what-brings-you a[href="/anxiety-stress-therapy/"]','/anxiety-stress-therapy/');click('#support a[href="/cognitive-behavioral-therapy-cbt/"]','/cognitive-behavioral-therapy-cbt/');click('#clinicians a[href="/gary-ashley/"]','/gary-ashley/');check("const a=document.querySelector('main a[data-spwidget-clinician-id=\"2154633\"]');if(!a||!a.href.includes('clinicianId=2154633'))throw Error('Clinician booking contract')");
  run('set','viewport','390','900');open('anxiety-stress-therapy');click('.menu-button');check("if(document.querySelector('.menu-button').getAttribute('aria-expanded')!=='true')throw Error('Menu')");run('press','Escape');check("if(document.querySelector('.menu-button').getAttribute('aria-expanded')!=='false')throw Error('Escape menu')");
  const errors=run('errors');if(errors.trim()&&!/no errors/i.test(errors))throw Error(errors);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,cases,navigation:['home','individual','anxiety','CBT','Gary','booking URL inspected; not opened'],scope:'Built output in CI. No hosted CSP, live SimplePractice interaction, email send, login or measurement activation.'},null,2));
 }catch(error){try{run('screenshot',path.join(out,'failure.png'));}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,cases,error:String(error)},null,2));process.exitCode=1;}
 finally{try{run('close');}catch{}}
}else server.listen(4197,'127.0.0.1',()=>{const w=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});w.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});
