'use strict';
// Actual decoded photos, equal frame measurements and native navigation.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/clinician-portraits');
const people=require('../content/clinician-registry.json').clinicians;
const files=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)]);
const imagePages=files(dist).filter(f=>f.endsWith('index.html')&&fs.readFileSync(f,'utf8').includes('data-portrait-frame')).map(f=>path.relative(dist,f).replace(/\\/g,'/').replace(/\/index\.html$/,'').replace(/^index\.html$/,''));
const hosted=process.env.PORTRAIT_BASE_URL||'',base=hosted||'http://127.0.0.1:4212';
if(hosted&&hosted!=='https://deploy-preview-1--marriagefamilytherapy.netlify.app')throw Error('Only the review preview may be tested');
fs.mkdirSync(out,{recursive:true});const cases=[],commands=[],sizes=new Map();
function run(...args){try{const text=execFileSync('agent-browser',['--session','clinician-portraits',...args],{encoding:'utf8',timeout:45000,maxBuffer:8e6});commands.push({args,text});return text;}catch(e){commands.push({args,error:String(e),stderr:String(e.stderr||'')});throw e;}finally{fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(commands));}}
function evaluate(js){const raw=run('eval',js);let v;try{v=JSON.parse(raw);}catch{throw Error('Invalid browser result '+raw);}return typeof v==='string'?JSON.parse(v):v;}
function open(slug){run('open',base+'/'+(slug?slug+'/':''));run('wait','--load','domcontentloaded');run('snapshot','-i');}
function click(selector){run('eval',`(async()=>{const a=document.querySelector(${JSON.stringify(selector)});if(!a)throw Error('Missing link');a.scrollIntoView({behavior:'instant',block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=a.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);if(!hit||!(hit===a||a.contains(hit)))throw Error('Obscured link');return true;})()`);run('click',selector);run('snapshot','-i');}
const measure=`(async()=>{
 const frames=[...document.querySelectorAll('[data-portrait-frame]')];
 if(!frames.length)throw Error('Missing portraits');
 frames.forEach(f=>f.querySelector('img').loading='eager');
 await Promise.race([Promise.all(frames.map(f=>f.querySelector('img').decode())),new Promise((_,reject)=>setTimeout(()=>reject(Error('Photo decode timed out')),20000))]);
 if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');
 if(document.querySelector('.breadcrumbs'))throw Error('Breadcrumb returned');
 if(document.querySelectorAll('h1').length!==1)throw Error('Heading count');
 if(!document.querySelector('meta[name=robots]').content.includes('noindex'))throw Error('Indexing changed');
 if(window.MFT_BOOKING_CONFIG?.measurementEnabled)throw Error('Measurement activated');
 for(const group of document.querySelectorAll('[data-clinician-identity]')){
  const n=group.querySelector('.mft-clinician-name'),c=group.querySelector('.mft-clinician-license');
  if(!n||!c||n.getBoundingClientRect().bottom>c.getBoundingClientRect().top+.5)throw Error('Credentials not beneath name');
  if(n.textContent.includes('Kody Evans')&&(n.textContent!=='Kody Evans'||c.textContent!=='LMFT'))throw Error('Kody label');
 }
 return JSON.stringify(frames.map(f=>{
  const i=f.querySelector('img'),r=f.getBoundingClientRect(),ir=i.getBoundingClientRect(),s=getComputedStyle(i);
  const isHero=f.dataset.portraitVariant==='hero';
  if(!i.naturalWidth||s.objectFit!==(isHero?'contain':'cover')||s.transform!=='none')throw Error('Photo fit');
  if(r.width<=0||(!isHero&&Math.abs(r.width/r.height-.8)>.008))throw Error('Frame ratio '+JSON.stringify({w:r.width,h:r.height,alt:i.alt}));
  if(Math.abs(ir.width-f.clientWidth)>1||Math.abs(ir.height-f.clientHeight)>1)throw Error('Photo box differs from frame');
  const availableWidth=ir.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),availableHeight=ir.height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);
  const scale=(isHero?Math.min:Math.max)(availableWidth/i.naturalWidth,availableHeight/i.naturalHeight);
  if(scale<=0)throw Error('Invalid scale');
  if(isHero){
    if(i.naturalWidth*scale>availableWidth+.5||i.naturalHeight*scale>availableHeight+.5||s.objectPosition!=='50% 100%')throw Error('Cropped biography source');
    const hero=f.closest('[data-clinician-hero]');if(hero.dataset.heroTreatment!=='green-blend'||!getComputedStyle(hero).backgroundImage.includes('linear-gradient'))throw Error('Hero gradient missing');
  }else if(i.naturalWidth*scale<availableWidth-.5||i.naturalHeight*scale<availableHeight-.5||s.objectPosition!=='50% 0%')throw Error('Guide frame changed');
  return {name:i.alt,variant:f.dataset.portraitVariant,width:r.width,height:r.height,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,fit:s.objectFit,position:s.objectPosition};
 }));
})()`;
function worker(){
 try{
  open('team');run('screenshot',path.join(out,'initial.png'));
  for(const width of [1440,768,390,320]){
   run('set','viewport',String(width),'1000');
   const routes=width===1440||width===390?imagePages:[...people.map(p=>p.slug),'team','new-page','marriage-and-couples-therapy-counseling','childrentherapy'];
   for(const slug of routes){
    open(slug);const rows=evaluate(measure);
    for(const r of rows){const key=width+':'+r.variant;const dims=[r.width,r.height];if(r.variant==='card'&&sizes.has(key)&&dims.some((x,i)=>Math.abs(x-sizes.get(key)[i])>1))throw Error('Frame differs across pages: '+key+' '+slug);if(r.variant==='card')sizes.set(key,dims);}
    cases.push({slug,width,pass:true,portraits:rows});
    if([1440,390].includes(width)&&people.some(p=>p.slug===slug))run('screenshot',path.join(out,slug+'-'+width+'.png'));
    if([1440,390].includes(width)&&['team','marriage-and-couples-therapy-counseling','cognitive-behavioral-therapy-cbt'].includes(slug)){
     run('eval',`document.querySelector(${JSON.stringify(slug==='team'?'.people-grid':'#clinicians')}).scrollIntoView({behavior:'instant',block:'start'})`);run('screenshot',path.join(out,slug+'-portraits-'+width+'.png'));
    }
   }
  }
  run('set','viewport','1440','1000');open('services');click('#care-options a[href="/marriage-and-couples-therapy-counseling/"]');click('#clinicians a[href="/kody-evans-bio/"]');run('wait','--url','**/kody-evans-bio/');
  run('eval',"if(document.querySelector('h1').textContent!=='Kody Evans'||!document.querySelector('.mft-clinician-hero [data-spwidget-clinician-id=\"1701440\"]'))throw Error('Profile/booking mismatch')");
  const errors=run('errors');if(errors.trim()&&!/no errors/i.test(errors))throw Error(errors);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,commit:process.env.GITHUB_SHA||null,base,cases,scope:'Decoded images, equal frames, separate name/license and native Services-to-clinician navigation. No booking or email submission. Visual inspection remains separate.'},null,2));
 }catch(error){try{run('screenshot',path.join(out,'failure.png'));}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,base,cases,error:String(error)},null,2));console.error(error);process.exitCode=1;}
 finally{try{run('close');}catch{}}
}
if(process.argv.includes('--worker'))worker();
else if(hosted)worker();
else{
 const server=http.createServer((req,res)=>{let f;try{f=path.resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));}catch{res.writeHead(400);return res.end();}if(!f.startsWith(dist+path.sep)&&f!==dist){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');fs.createReadStream(f).pipe(res);});
 server.listen(4212,'127.0.0.1',()=>{const p=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});p.on('exit',code=>server.close(()=>process.exitCode=code||0));});
}
