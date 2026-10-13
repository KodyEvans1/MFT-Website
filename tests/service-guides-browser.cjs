'use strict';
// Native browser checks against built files. No mail, appointments or payments are sent.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/service-browser');
fs.mkdirSync(out,{recursive:true});const commands=[],cases=[];
const routes=['services',...require('../src/service-directory').destinations.map(x=>x[0])];
function run(...args){try{const output=execFileSync('agent-browser',['--session','service-review',...args],{encoding:'utf8',timeout:45000,maxBuffer:4e6});commands.push({args,output});return output;}catch(e){commands.push({args,error:String(e),stderr:String(e.stderr||'')});throw e;}finally{fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));}}
function check(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
function open(slug){run('open','http://127.0.0.1:4201/'+(slug?slug+'/':''));run('wait','--load','domcontentloaded');run('snapshot','-i');}
function click(selector,tail){
 run('eval',`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing target');e.scrollIntoView({behavior:'instant',block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);if(!h||!(h===e||e.contains(h)))throw Error('Obscured target');return 'VISIBLE';})()`);
 run('click',selector);if(tail)run('wait','--url','**'+tail);run('snapshot','-i');
}
const server=http.createServer((req,res)=>{let url;try{url=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}let f=path.resolve(dist,'.'+url);if(f!==dist&&!f.startsWith(dist+path.sep)){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.setHeader('X-Robots-Tag','noindex,nofollow');fs.createReadStream(f).pipe(res);});
if(process.argv.includes('--worker')){
 try{
  open('services');run('screenshot',path.join(out,'initial.png'));check("if(document.body.innerText.length<200||!document.querySelector('[data-ui=hero]'))throw Error('Blank page');if(document.querySelector('[data-nextjs-dialog],.vite-error-overlay'))throw Error('Overlay')");
  for(const width of [1440,768,390,320]){
   run('set','viewport',String(width),'1000');
   for(const slug of routes){
    open(slug);
    check("if(document.querySelectorAll('h1').length!==1)throw Error('H1');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Overflow');if(document.querySelector('.breadcrumbs'))throw Error('Breadcrumb');if(!document.querySelector('.brand img')?.naturalWidth)throw Error('Logo');if(!document.querySelector('[data-design-system=homepage-shared-v1]'))throw Error('Not shared');if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexing');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement');if(document.querySelector('main form,main input,main textarea'))throw Error('Personal data field')");
    if(require('../src/service-guides').routes.includes(slug)){
     check("for(const type of ['hero','panel','disclosures','example','comparison','steps','faq','cards'])if(!document.querySelector('[data-ui='+type+']'))throw Error('Missing '+type)");
     click('.mft-disclosure summary');check("if(!document.querySelector('.mft-disclosure').open)throw Error('Disclosure')");run('press','Enter');check("if(document.querySelector('.mft-disclosure').open)throw Error('Keyboard disclosure')");
     click('#questions details:first-of-type summary');check("if(!document.querySelector('#questions details').open)throw Error('FAQ')");run('press','Enter');check("if(document.querySelector('#questions details').open)throw Error('Keyboard FAQ')");
     if(slug==='new-page-2'){
      click('[data-retreat-format=overnight]','#retreat-interest');check("if(document.querySelector('#retreat-format').value!=='overnight')throw Error('Price selection');const u=new URL(document.querySelector('[data-retreat-email]').href);if(u.protocol!=='mailto:'||u.pathname!=='support@mft.care'||!u.searchParams.get('body').includes('Overnight Retreat'))throw Error('Email topic');if(document.querySelector('[data-retreat-email]').hasAttribute('data-mft-booking'))throw Error('Inquiry treated as booking')");
      run('select','#retreat-format','half-day');check("if(!decodeURIComponent(document.querySelector('[data-retreat-email]').href).includes('4-Hour Intensive'))throw Error('Selector')");
      run('select','#retreat-format','unsure');
     }
    }
    run('eval','window.scrollTo({top:0,behavior:"instant"})');
    if((width===1440||width===390)&&['services','new-page-2','marriage-and-couples-therapy-counseling','childrentherapy','teen-counseling'].includes(slug))run('screenshot',path.join(out,slug+'-'+width+'.png'),'--full');
    cases.push({slug,width,pass:true});
   }
  }
  run('set','viewport','1440','1000');open('services');click('#care-options a[href="/new-page-2/"]','/new-page-2/');click('#related-care a[href="/marriagereset/"]','/marriagereset/');open('services');click('#care-options a[href="/childrentherapy/"]','/childrentherapy/');
  check("const a=document.querySelector('#clinicians a');if(!a||!a.href.includes('bio')&&!a.href.includes('gary-ashley'))throw Error('Profile destination')");
  const errors=run('errors');fs.writeFileSync(path.join(out,'errors.txt'),errors);if(errors.trim()&&!/no errors/i.test(errors))throw Error(errors);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,commit:process.env.GITHUB_SHA,cases,inquiry:'Native select and price-card clicks update mailto topic; no email sent',scope:'Built files served in CI. No live SDK, Netlify headers, payments, booking, or email delivery verification.'},null,2));
 }catch(error){try{run('screenshot',path.join(out,'failure.png'));}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,cases,error:String(error)},null,2));process.exitCode=1;}
 finally{try{run('close');}catch{}}
}else server.listen(4201,'127.0.0.1',()=>{const w=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});w.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});
