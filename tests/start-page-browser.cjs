'use strict';
// Passive UI verification only: no appointment requests, email sends, or tracking.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/plaud-browser');
fs.mkdirSync(out,{recursive:true});
const commands=[],cases=[];
function run(...args){
 try{const output=execFileSync('agent-browser',['--session','plaud-review',...args],{encoding:'utf8',timeout:65000,maxBuffer:2e6});commands.push({args,output});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands,null,2));return output;}
 catch(e){commands.push({args,error:String(e),stdout:String(e.stdout||''),stderr:String(e.stderr||'')});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands,null,2));throw e;}
}
function check(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
function open(route){run('open','http://127.0.0.1:4193'+route);run('wait','--load','domcontentloaded');run('snapshot','-i');}
const server=http.createServer((req,res)=>{
 let route;try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);res.end();return;}
 let file=path.resolve(dist,'.'+route);if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403);res.end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');
 res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex,nofollow');fs.createReadStream(file).pipe(res);
});
if(process.argv.includes('--worker')){
 try{
  // Verify server visually and interactively before the route matrix.
  open('/how-to-start-therapy/');run('screenshot',path.join(out,'initial-check.png'));
  check("if(!document.querySelector('.start-guide')||!document.querySelector('h1')||document.body.innerText.length<100)throw Error('Blank target');if(document.querySelector('[data-nextjs-dialog],.vite-error-overlay'))throw Error('Error overlay')");
  for(const width of [1440,768,390,320]){
   run('set','viewport',String(width),'1000');
   for(const route of ['/how-to-start-therapy/','/','/marriagereset/']){
    open(route);
    check("if(document.querySelectorAll('h1').length!==1)throw Error('H1 count');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexable preview');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled');if(!document.querySelector('header img[src=\"/assets/mft-logo.svg\"]'))throw Error('Brand logo missing');if(!document.querySelector('.primary-nav a[href=\"/marriagereset/\"]'))throw Error('Marriage.Reset navigation missing')");
    if(route==='/how-to-start-therapy/'){
     check("if(document.querySelector('main .breadcrumbs,main form,main input,main textarea,main .final-cta'))throw Error('Old layout or form remains');if(document.querySelectorAll('.start-faq details').length!==4)throw Error('FAQ count');for(const a of document.querySelectorAll('main a[data-mft-booking]')){if(a.getAttribute('href')!=='https://marriagefamilytherapy.clientsecure.me'||!a.hasAttribute('data-spwidget-scope-global'))throw Error('Wrong scheduling destination')}if(!document.querySelector('a[href=\"mailto:support@mft.care?subject=Benefits%20verification\"]'))throw Error('Benefits email missing')");
     run('click','.start-text-link');run('wait','--url','**#start-steps');run('snapshot','-i');check("if(location.hash!=='#start-steps')throw Error('Steps anchor failed')");
     for(let n=1;n<=4;n++){run('click',`.start-faq details:nth-child(${n}) summary`);run('snapshot','-i');check(`if(!document.querySelector('.start-faq details:nth-child(${n})').open)throw Error('FAQ did not expand')`);}
     run('eval',"document.querySelector('.start-faq summary').focus()");run('press','Enter');check("if(document.querySelector('.start-faq details').open)throw Error('Keyboard toggle failed')");
     run('eval','window.scrollTo(0,0)');run('screenshot',path.join(out,'how-to-start-therapy-'+width+'.png'),'--full');
    }else{
     if(route==='/')check("if(document.querySelector('main .final-cta'))throw Error('Redundant homepage CTA remains')");
     if(route==='/marriagereset/')check("const a=document.querySelector('a[data-mr-client-access]');if(!a||a.href!=='https://ops.mft.care/'||a.hasAttribute('data-mft-booking'))throw Error('MR sign-in hijacked')");
     run('screenshot',path.join(out,(route==='/'?'homepage':'marriagereset')+'-'+width+'.png'),'--full');
    }
    cases.push({route,width,pass:true});
   }
  }
  open('/how-to-start-therapy/');run('click','.start-step-grid a[href="/services/"]');run('wait','--url','**/services/');run('snapshot','-i');
  open('/how-to-start-therapy/');run('click','.start-step-grid a[href="/team/"]');run('wait','--url','**/team/');run('snapshot','-i');
  open('/how-to-start-therapy/');run('click','.menu-button');run('snapshot','-i');
  check("if(document.querySelector('.menu-button').getAttribute('aria-expanded')!=='true')throw Error('Mobile menu did not open')");
  run('click','.primary-nav a[href="/marriagereset/"]');run('wait','--url','**/marriagereset/');run('snapshot','-i');
  const errors=run('errors');fs.writeFileSync(path.join(out,'browser-errors.txt'),errors);
  if(errors.trim()&&!/no errors/i.test(errors))throw Error('Browser reported errors: '+errors);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,cases,navigation:['start -> services','start -> team','mobile menu -> Marriage.Reset'],interactions:['steps anchor','four FAQ expanders','keyboard FAQ toggle'],scope:'Built output. No hosted Netlify CSP/SDK flow, sign-in, appointment submission, email send or live measurement.'},null,2));
 }catch(error){try{run('screenshot',path.join(out,'failure.png'));run('get','url');}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,cases,error:String(error)},null,2));process.exitCode=1;}
 finally{try{run('close');}catch{}}
}else{server.listen(4193,'127.0.0.1',()=>{const worker=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});worker.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});}
