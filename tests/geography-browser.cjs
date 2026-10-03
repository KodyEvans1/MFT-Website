'use strict';
// Passive build-output browser checks only. Never submit forms or appointments.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/browser-review');
fs.mkdirSync(out,{recursive:true});
const dist=path.join(root,'dist');
const log=[];
function run(...args){const s=execFileSync('agent-browser',args,{encoding:'utf8',timeout:65000,maxBuffer:2e6});log.push({args,output:s});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(log,null,2));return s;}
function evaluate(code){return run('eval',`(()=>{${code};return 'PASS';})()`);}
const routes=['online-therapy-locations','online-therapy-puget-sound-region-wa','online-therapy-king-county-wa','online-therapy-bothell-wa','online-therapy-coulee-dam-wa','online-therapy-woodland-wa'];
const server=http.createServer((req,res)=>{
  let route;try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);res.end();return;}
  let file=path.resolve(dist,'.'+route);if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403);res.end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
  fs.createReadStream(file).pipe(res);
});
// Synchronous CLI runs in a separate process; the server event loop stays available.
if(process.argv.includes('--worker')){
  const cases=[];
  try{
    run('open','http://127.0.0.1:4173/');run('wait','--load','domcontentloaded');run('snapshot','-i');run('screenshot',path.join(out,'homepage.png'));
    evaluate("if(!document.querySelector('h1')||document.body.innerText.length<100)throw Error('Blank homepage');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Preview measurement enabled')");
    for(const width of [1440,390]){
      run('set','viewport',String(width),'1000');
      for(const route of routes){
        run('open','http://127.0.0.1:4173/'+route+'/');run('wait','--load','domcontentloaded');
        run('snapshot','-i');
        evaluate("if(document.querySelectorAll('h1').length!==1)throw Error('Wrong H1 count');if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow '+document.documentElement.scrollWidth+' vs '+innerWidth);if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexable preview');if(!document.querySelector('.geo-directory a'))throw Error('Missing directory');if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement enabled')");
        if(route==='online-therapy-coulee-dam-wa')evaluate("if(document.querySelectorAll('.geo-breadcrumbs').length!==3)throw Error('Three county trails missing')");
        run('screenshot',path.join(out,route+'-'+width+'.png'),'--full');cases.push({route,width,pass:true});
      }
    }
    run('open','http://127.0.0.1:4173/online-therapy-puget-sound-region-wa/');run('snapshot','-i');
    run('click','.geo-children a[href="/online-therapy-king-county-wa/"]');run('snapshot','-i');
    evaluate("if(location.pathname!=='/online-therapy-king-county-wa/')throw Error('Region navigation failed')");
    run('click','.geo-children a[href="/online-therapy-bothell-wa/"]');run('snapshot','-i');
    evaluate("if(location.pathname!=='/online-therapy-bothell-wa/')throw Error('County navigation failed')");
    run('click','.geo-parents a[href="/online-therapy-snohomish-county-wa/"]');run('snapshot','-i');
    evaluate("if(location.pathname!=='/online-therapy-snohomish-county-wa/')throw Error('Second-county navigation failed')");
    fs.writeFileSync(path.join(out,'browser-errors.txt'),run('errors'));
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({cases,navigationPath:['Puget Sound','King County','Bothell','Snohomish County'],pass:true,scope:'Built static output; no live appointment submission, measurement or Netlify header verification'},null,2));
  }catch(error){fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({cases,pass:false,error:String(error)},null,2));process.exitCode=1;}
  finally{try{run('close');}catch{}}
}else{
  server.listen(4173,'127.0.0.1',()=>{
    const worker=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});
    worker.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));
  });
}
