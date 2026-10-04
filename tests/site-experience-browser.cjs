'use strict';
// Passive built-output checks: no appointment, email, patient record or analytics writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/site-experience-browser');fs.mkdirSync(out,{recursive:true});
const config=require('../content/site-experience.json'),evidence=require('../content/clinician-evidence.json');
const slugs=[...Object.keys(config.pages),...Object.keys(config.approachPrompts),...evidence.clinicians.map(p=>p.slug)];
const extra=['','how-to-start-therapy','marriagereset','services','online-therapy-bothell-wa','person-centered-therapy'];
const log=[],cases=[];
function run(...args){const output=execFileSync('agent-browser',args,{encoding:'utf8',timeout:65000,maxBuffer:2e6});log.push({args,output});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(log));return output;}
function check(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
function open(slug){run('open','http://127.0.0.1:4193/'+(slug?slug+'/':''));run('wait','--load','domcontentloaded');run('snapshot','-i');}
function click(selector,tail){
 run('eval',`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing click target');e.scrollIntoView({behavior:'instant',block:'center'});const r=e.getBoundingClientRect();const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return JSON.stringify({before:location.href,href:e.href||e.closest('a')?.href,hit:h?.outerHTML.slice(0,500),rect:{x:r.x,y:r.y,width:r.width,height:r.height}});})()`);
 run('click',selector);run('get','url');run('screenshot',path.join(out,'last-navigation.png'));run('wait','--url','**'+tail);run('snapshot','-i');
}
const server=http.createServer((req,res)=>{let route;try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);res.end();return;}let f=path.resolve(dist,'.'+route);if(f!==dist&&!f.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.setHeader('Referrer-Policy','no-referrer');fs.createReadStream(f).pipe(res);});
if(process.argv.includes('--worker')){
 try{
  open('');run('screenshot',path.join(out,'home-initial.png'));
  check("if(!document.querySelector('h1')||document.body.innerText.length<100)throw Error('Blank page');if(document.querySelector('.breadcrumbs'))throw Error('Top breadcrumb present')");
  for(const width of [1440,390,320]){
   run('set','viewport',String(width),'1000');
   for(const slug of width===320?['new-page','kody-evans-bio','how-to-start-therapy','person-centered-therapy','marriagereset']:[...slugs,...extra]){
    open(slug);
    check("if(document.querySelector('.breadcrumbs'))throw Error('Breadcrumb returned');if(document.querySelectorAll('h1').length!==1)throw Error('H1 count');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Overflow '+document.documentElement.scrollWidth+'/'+innerWidth);if(!document.querySelector('.brand img')?.naturalWidth)throw Error('Missing brand image');if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexing changed');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled');if(document.querySelector('main a[href^=\"https://ops.mft.care\"]:not([data-mr-client-access])'))throw Error('Public CTA goes to Ops')");
    if(slugs.includes(slug))check("if(!document.querySelector('[data-experience-body]'))throw Error('Detailed body missing');if(document.querySelectorAll('.experience-prose').length<2)throw Error('Missing explanatory copy');if(document.querySelector('.method-grid,.signal-grid,ul.value-list'))throw Error('Generic list survived')");
    if(['','new-page','kody-evans-bio','how-to-start-therapy','person-centered-therapy','marriage-and-couples-therapy-counseling','how-to-choose-a-therapist'].includes(slug))run('screenshot',path.join(out,(slug||'home')+'-'+width+'.png'),'--full');
    cases.push({slug,width,pass:true});
   }
  }
  run('set','viewport','1440','1000');open('new-page');click('.experience-topic[href="/anxiety-stress-therapy/"]','/anxiety-stress-therapy/');
  open('kody-evans-bio');click('.experience-topic[href="/cognitive-behavioral-therapy-cbt/"]','/cognitive-behavioral-therapy-cbt/');click('.experience-topic[href="/gary-ashley/"]','/gary-ashley/');
  check("if(!document.querySelector('main a[data-spwidget-clinician-id=\"2154633\"]'))throw Error('Clinician routing changed')");
  for(const width of [1440,390]){run('set','viewport',String(width),'1000');open('person-centered-therapy');click('.ed-toc li:first-child a','#your-perspective');click('.ed-section:first-of-type .ed-reference:first-child','#ed-source-person-centered');check("if(document.activeElement.id!=='ed-source-person-centered')throw Error('Source target not focused')");}
  open('how-to-start-therapy');run('click','.start-faq details:first-of-type summary');check("if(!document.querySelector('.start-faq details').open)throw Error('FAQ not open')");run('press','Enter');check("if(document.querySelector('.start-faq details').open)throw Error('FAQ keyboard close failed')");
  run('click','.menu-button');click('.primary-nav a[href="/marriagereset/"]','/marriagereset/');check("if(!document.querySelector('[data-mr-client-access]'))throw Error('Marriage.Reset sign-in missing')");
  const errors=run('errors');fs.writeFileSync(path.join(out,'browser-errors.txt'),errors);if(errors.trim()&&!/no errors/i.test(errors))throw Error('Browser errors: '+errors);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,cases,navigation:['individual to anxiety','Kody to CBT to Gary','source anchors desktop/mobile','FAQ mouse/keyboard','mobile Marriage.Reset'],scope:'Built static output, no live booking, email, measurement, or hosted CSP test'},null,2));
 }catch(error){fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,cases,error:String(error)},null,2));process.exitCode=1;}
 finally{try{run('close');}catch{}}
}else server.listen(4193,'127.0.0.1',()=>{const w=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});w.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});
