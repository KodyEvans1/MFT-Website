'use strict';
// Passive built-output checks; never submits an appointment or enables measurement.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/editorial-browser');
fs.mkdirSync(out,{recursive:true});
const articles=require('../content/editorial-library.json').articles,log=[];
const refs=require('../src/reference-pages');
function run(...args){const output=execFileSync('agent-browser',args,{encoding:'utf8',timeout:65000,maxBuffer:2e6});log.push({args,output});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(log,null,2));return output;}
function check(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
// Center the real target before a native click. Retain URL and focus assertions.
function click(selector,tail){
 run('eval',`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing target');e.scrollIntoView({behavior:'instant',block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);if(!hit||!(hit===e||e.contains(hit)))throw Error('Obscured target');return 'VISIBLE';})()`);
 run('click',selector);if(tail)run('wait','--url','**'+tail);run('snapshot','-i');
}
const server=http.createServer((req,res)=>{
  let route;try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);res.end();return;}
  let file=path.resolve(dist,'.'+route);if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403);res.end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex,nofollow');fs.createReadStream(file).pipe(res);
});
if(process.argv.includes('--worker')){
  const cases=[];
  try{
    run('open','http://127.0.0.1:4183/');run('wait','--load','domcontentloaded');run('snapshot','-i');run('screenshot',path.join(out,'homepage.png'));
    check("if(!document.querySelector('h1')||document.body.innerText.length<100)throw Error('Blank homepage');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled')");
    for(const width of [1440,390]){
      run('set','viewport',String(width),'1000');
      for(const a of articles){
        run('open','http://127.0.0.1:4183/'+a.slug+'/');run('wait','--load','domcontentloaded');run('snapshot','-i');
        const native=refs.get(a.slug)?.contentOrigin==='authored-modality-guide';
        if(native)check(`if(document.querySelector('main').dataset.referencePage!==${JSON.stringify(a.slug)}||!document.querySelector('#worked-example'))throw Error('Native modality missing')`);
        else check(`if(document.querySelector('main').dataset.editorialArticle!==${JSON.stringify(a.slug)})throw Error('Authored content missing');if(document.querySelectorAll('.ed-section').length!==${a.sections.length})throw Error('Sections missing');if(document.querySelectorAll('.ed-clinician-grid article').length!==${a.clinicianLinks.length})throw Error('Wrong clinician links')`);
        check("if(document.querySelectorAll('h1').length!==1)throw Error('H1 count');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexable draft');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled');if(document.querySelector('main form,main input,main textarea'))throw Error('Data collection on article')");
        if(native){
          click('.mft-jump a[href="#understanding"]','#understanding');
          click('#understanding .mft-citations a:first-child','#source-*');
          check("if(!location.hash.startsWith('#source-')||document.activeElement.id!==location.hash.slice(1))throw Error('Native source focus failed')");
        }else{
          run('screenshot',path.join(out,a.slug+'-'+width+'-before.png'));
          click('.ed-toc li:first-child a','#'+a.sections[0].id);
          run('get','url');run('eval',"JSON.stringify({url:location.href,base:document.baseURI,href:document.querySelector('.ed-toc a').href,scroll:scrollY,target:document.querySelector('.ed-section').getBoundingClientRect().top})");
          run('screenshot',path.join(out,a.slug+'-'+width+'-after.png'));
          run('wait','--url','**'+'#'+a.sections[0].id);
          check(`if(location.hash!==${JSON.stringify('#'+a.sections[0].id)})throw Error('TOC navigation failed')`);
          click('.ed-section:first-of-type .ed-reference:first-child','#ed-source-*');
          check("if(!location.hash.startsWith('#ed-source-'))throw Error('Source navigation failed')");
        }
        run('eval','window.scrollTo(0,0)');run('screenshot',path.join(out,a.slug+'-'+width+'.png'),'--full');cases.push({slug:a.slug,width,native,pass:true});
      }
    }
    run('open','http://127.0.0.1:4183/therapy-approaches/');run('snapshot','-i');
    click('#modality-guides a[href="/person-centered-therapy/"]','/person-centered-therapy/');check("if(location.pathname!=='/person-centered-therapy/')throw Error('Hub link failed')");
    click('#related-reading a[href="/strengths-based-therapy/"]','/strengths-based-therapy/');check("if(location.pathname!=='/strengths-based-therapy/')throw Error('Related link failed')");
    click('#clinicians a[href="/gary-ashley/"]','/gary-ashley/');
    check("if(location.pathname!=='/gary-ashley/')throw Error('Profile link failed');if(!document.querySelector('main a[data-spwidget-clinician-id=\"2154633\"]'))throw Error('Profile booking missing');if(!document.querySelector('.ed-discovery a[href=\"/person-centered-therapy/\"]'))throw Error('Reciprocal reading link missing')");
    run('open','http://127.0.0.1:4183/resources/');run('snapshot','-i');check("if(document.querySelectorAll('.ed-discovery > ul > li > a').length!==3)throw Error('Missing resource reading family')");
    // Marriage.Reset now has its own native model, not the retired three-card block.
    run('open','http://127.0.0.1:4183/marriagereset/');run('snapshot','-i');check("if(!document.querySelector('main[data-marriage-reset=review][data-mr-revision]'))throw Error('Missing Marriage.Reset model');for(const id of ['the-model','the-journey','understand','prioritize','practice','measure','adapt','privacy-and-safety','questions','begin'])if(!document.getElementById(id))throw Error('Missing Marriage.Reset section '+id);if(!document.querySelector('main a[href=\"/marriage-reset-assessment/\"]')||!document.querySelector('main a[href=\"/marriage-and-couples-therapy-counseling/\"]'))throw Error('Missing Marriage.Reset care paths')");
    const browserErrors=run('errors');fs.writeFileSync(path.join(out,'browser-errors.txt'),browserErrors);
    if(browserErrors.trim()&&!/no errors/i.test(browserErrors))throw Error('Browser reported errors: '+browserErrors);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,cases,navigation:['approaches','person-centered','strengths-based','Gary profile'],scope:'Built static output in CI; three short essays intentionally replaced by full modality guides; no hosted CSP test, live submissions or measurement'},null,2));
  }catch(e){fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,cases,error:String(e)},null,2));process.exitCode=1;}
  finally{try{run('close');}catch{}}
}else{server.listen(4183,'127.0.0.1',()=>{const worker=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});worker.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});}
