'use strict';
// Real decoded source pixels + complete-source geometry, not a fixed crop ratio.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/clinician-hero');
const people=require('../content/clinician-registry.json').clinicians;
const {heroSources}=require('../src/ui/clinician-presentation');
const base=process.env.HERO_BASE_URL||'http://127.0.0.1:4226';
if(process.env.HERO_BASE_URL&&base!=='https://deploy-preview-1--marriagefamilytherapy.netlify.app')throw Error('Only preview is allowed');
fs.mkdirSync(out,{recursive:true});const cases=[],commands=[];
function run(...args){try{const text=execFileSync('agent-browser',['--session','restored-hero',...args],{encoding:'utf8',timeout:45000,maxBuffer:6e6});commands.push({args,text});return text;}catch(e){commands.push({args,error:String(e),stderr:String(e.stderr||'')});throw e;}finally{fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));}}
function evaluate(js){let v=JSON.parse(run('eval',js));return typeof v==='string'?JSON.parse(v):v;}
function worker(){try{
 for(const [width,dpr] of [[1440,1],[1024,1],[900,1],[768,1],[390,1],[320,1],[1440,2],[390,2]]){
  run('set','viewport',String(width),'1100',String(dpr));
  for(const p of people){
   run('open',base+'/'+p.slug+'/');run('wait','--load','domcontentloaded');run('snapshot','-i');
   const result=evaluate(`(async()=>{
    const hero=document.querySelector('[data-clinician-hero]'),frame=hero.querySelector('[data-portrait-variant="hero"]'),img=frame.querySelector('img'),copy=hero.querySelector('.hero-copy');
    await Promise.race([img.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Hero decode timeout')),20000))]);
    const raw=new Image();raw.src=img.currentSrc;await raw.decode();await document.fonts.ready;
    const h=hero.getBoundingClientRect(),f=frame.getBoundingClientRect(),i=img.getBoundingClientRect(),s=getComputedStyle(img),cfg=${JSON.stringify(heroSources[p.slug])};
    const scale=Math.min(i.width/raw.naturalWidth,i.height/raw.naturalHeight),pw=raw.naturalWidth*scale,ph=raw.naturalHeight*scale;
    const painted={left:i.left+(i.width-pw)/2,top:i.bottom-ph,width:pw,height:ph,bottom:i.bottom};
    if(s.objectFit!=='contain'||s.objectPosition!=='50% 100%'||s.transform!=='none'||parseFloat(s.paddingTop)!==0)throw Error('Hero crop/stretch rule');
    if(painted.top<h.top+23||painted.left<f.left-.6||painted.bottom>h.bottom+.6||painted.width>f.width+.6||painted.height>f.height+.6)throw Error('Source cropped or headroom missing '+JSON.stringify(painted));
    if(pw>cfg.width+1||ph>cfg.height+1)throw Error('Photo enlarged beyond original pixels');
    if(Math.abs(raw.naturalWidth/raw.naturalHeight-cfg.width/cfg.height)>.006)throw Error('Source aspect changed');
    if(raw.naturalWidth+2<Math.min(cfg.width,pw*devicePixelRatio*.9))throw Error('Available higher resolution not selected');
    if(!getComputedStyle(hero).backgroundImage.includes('linear-gradient')||hero.dataset.heroTreatment!=='green-blend'||!s.maskImage.includes('linear-gradient'))throw Error('Green/blended treatment missing');
    if(getComputedStyle(frame).borderRadius!=='0px'||parseFloat(getComputedStyle(frame).borderTopWidth)!==0||getComputedStyle(frame).backgroundColor!=='rgba(0, 0, 0, 0)')throw Error('Framed card hero returned');
    if(getComputedStyle(hero.querySelector('h1')).color!=='rgb(255, 255, 255)'||getComputedStyle(copy.querySelector('.hero-summary')).color!=='rgb(255, 255, 255)')throw Error('Light hero type missing');
    const luminance=c=>{const v=c.match(/[\\d.]+/g).slice(0,3).map(n=>+n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
    for(const b of copy.querySelectorAll('.button')){const cs=getComputedStyle(b),fg=luminance(cs.color),bg=luminance(cs.backgroundColor==='rgba(0, 0, 0, 0)'?'rgb(9, 38, 36)':cs.backgroundColor);if((Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)<4.5)throw Error('Hero button contrast');}
    const n=hero.querySelector('.mft-clinician-name'),license=hero.querySelector('.mft-clinician-license');if(n.getBoundingClientRect().bottom>license.getBoundingClientRect().top+.5)throw Error('Name/license collision');
    if(n.textContent!==${JSON.stringify(p.name)}||license.textContent!==${JSON.stringify(p.license)})throw Error('Identity changed');
    if(document.documentElement.scrollWidth>innerWidth+2||document.querySelector('.breadcrumbs'))throw Error('Overflow or breadcrumb regression');
    if(!document.querySelector('meta[name="robots"]').content.includes('noindex')||window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Publication policy changed');
    return JSON.stringify({name:n.textContent,dpr:devicePixelRatio,source:[raw.naturalWidth,raw.naturalHeight],currentSrc:img.currentSrc,painted,headroom:painted.top-h.top,fullSourceVisible:true,retinaCoverage:raw.naturalWidth/(pw*devicePixelRatio),originalResolutionLimited:cfg.width<pw*devicePixelRatio,heroHeight:h.height,copyColor:getComputedStyle(copy).color});
   })()`);
   cases.push({slug:p.slug,width,dpr,pass:true,...result});
   if([1440,390].includes(width)&&dpr===1)run('screenshot',path.join(out,p.slug+'-'+width+'.png'));
  }
 }
 const errors=run('errors');if(errors.trim()&&!/no errors/i.test(errors))throw Error(errors);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,commit:process.env.GITHUB_SHA||null,base,cases,scope:'Original public source photos, responsive native navigation, full-source geometry, gradient, contrast and source-resolution selection. Screenshots require separate visual review; no booking submitted.'},null,2));
}catch(error){try{run('screenshot',path.join(out,'failure.png'));}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,base,cases,error:String(error)},null,2));console.error(error);process.exitCode=1;}finally{try{run('close');}catch{}}}
if(process.argv.includes('--worker')||process.env.HERO_BASE_URL)worker();else{
 const server=http.createServer((req,res)=>{let f;try{f=path.resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));}catch{res.writeHead(400);return res.end();}if(!f.startsWith(dist+path.sep)&&f!==dist){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');fs.createReadStream(f).pipe(res);});
 server.listen(4226,'127.0.0.1',()=>{const p=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});p.on('exit',code=>server.close(()=>process.exitCode=code||0));});
}
