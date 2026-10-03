'use strict';
// Passive built-output checks; never submits an appointment or enables measurement.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/editorial-browser');
fs.mkdirSync(out,{recursive:true});
const articles=require('../content/editorial-library.json').articles,log=[];
function run(...args){const output=execFileSync('agent-browser',args,{encoding:'utf8',timeout:65000,maxBuffer:2e6});log.push({args,output});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(log,null,2));return output;}
function check(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
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
        check(`if(document.querySelector('main').dataset.editorialArticle!==${JSON.stringify(a.slug)})throw Error('Authored content missing');if(document.querySelectorAll('.ed-section').length!==${a.sections.length})throw Error('Sections missing');if(document.querySelectorAll('.ed-clinician-grid article').length!==${a.clinicianLinks.length})throw Error('Wrong clinician links')`);
        check("if(document.querySelectorAll('h1').length!==1)throw Error('H1 count');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexable draft');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled');if(document.querySelector('main form,main input,main textarea'))throw Error('Data collection on article')");
        run('screenshot',path.join(out,a.slug+'-'+width+'-before.png'));
        run('click','.ed-toc li:first-child a');run('snapshot','-i');
        run('get','url');run('eval',"JSON.stringify({url:location.href,base:document.baseURI,href:document.querySelector('.ed-toc a').href,scroll:scrollY,target:document.querySelector('.ed-section').getBoundingClientRect().top})");
        run('screenshot',path.join(out,a.slug+'-'+width+'-after.png'));
        run('wait','--url','**'+ '#'+a.sections[0].id);
        check(`if(location.hash!==${JSON.stringify('#'+a.sections[0].id)})throw Error('TOC navigation failed')`);
        run('click','.ed-section:first-of-type .ed-reference:first-child');run('snapshot','-i');
        check("if(!location.hash.startsWith('#ed-source-'))throw Error('Source navigation failed')");
        run('eval','window.scrollTo(0,0)');run('screenshot',path.join(out,a.slug+'-'+width+'.png'),'--full');cases.push({slug:a.slug,width,pass:true});
      }
    }
    run('open','http://127.0.0.1:4183/therapy-approaches/');run('snapshot','-i');
    run('click','.ed-discovery a[href="/person-centered-therapy/"]');run('snapshot','-i');check("if(location.pathname!=='/person-centered-therapy/')throw Error('Hub link failed')");
    run('click','.ed-related a[href="/strengths-based-therapy/"]');run('snapshot','-i');check("if(location.pathname!=='/strengths-based-therapy/')throw Error('Related link failed')");
    run('click','.ed-clinician-grid a[href="/gary-ashley/"]');run('snapshot','-i');
    check("if(location.pathname!=='/gary-ashley/')throw Error('Profile link failed');if(!document.querySelector('main a[data-spwidget-clinician-id=\"2154633\"]'))throw Error('Profile booking missing');if(!document.querySelector('.ed-discovery a[href=\"/person-centered-therapy/\"]'))throw Error('Reciprocal reading link missing')");
    for(const slug of ['resources','marriagereset']){run('open','http://127.0.0.1:4183/'+slug+'/');run('snapshot','-i');check("if(document.querySelectorAll('.ed-discovery a').length!==3)throw Error('Missing reading family')");}
    const browserErrors=run('errors');fs.writeFileSync(path.join(out,'browser-errors.txt'),browserErrors);
    if(browserErrors.trim()&&!/no errors/i.test(browserErrors))throw Error('Browser reported errors: '+browserErrors);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,cases,navigation:['approaches','person-centered','strengths-based','Gary profile'],scope:'Built static output in CI; no hosted CSP test, live submissions or measurement'},null,2));
  }catch(e){fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,cases,error:String(e)},null,2));process.exitCode=1;}
  finally{try{run('close');}catch{}}
}else{server.listen(4183,'127.0.0.1',()=>{const worker=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});worker.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});}
