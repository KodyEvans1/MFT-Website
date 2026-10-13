'use strict';
// Executed after the responsive review, against an actual browser rendering.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'tmp/marriage-reset-browser');
function run(...args){return execFileSync('agent-browser',['--session','mr-contrast',...args],{encoding:'utf8',timeout:45000,maxBuffer:2e6});}
const server=http.createServer((req,res)=>{let url;try{url=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}let f=path.resolve(dist,'.'+url);if(f!==dist&&!f.startsWith(dist+path.sep)){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');fs.createReadStream(f).pipe(res);});
if(process.argv.includes('--worker')){
 const results=[];
 try{
  for(const width of [1440,390]){
   run('set','viewport',String(width),'1000');run('open','http://127.0.0.1:4199/marriagereset/');run('wait','--load','domcontentloaded');run('snapshot','-i');
   const result=run('eval',`(()=>{const a=document.querySelector('.mr-member-access a'),panel=a.parentElement;const css=getComputedStyle(a);function rgb(c){return c.match(/[\\d.]+/g).slice(0,3).map(Number);}function luminance(c){const v=rgb(c).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;}const fg=luminance(css.color),bg=luminance(getComputedStyle(panel).backgroundColor),ratio=(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);if(ratio<4.5)throw Error('Unreadable client access '+ratio);if(css.borderTopColor==='rgb(255, 255, 255)')throw Error('Invisible outline');a.scrollIntoView({behavior:'instant',block:'center'});return JSON.stringify({foreground:css.color,background:getComputedStyle(panel).backgroundColor,ratio});})()`);
   run('screenshot',path.join(out,'client-access-'+width+'.png'));results.push({width,result});
  }
  fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify({pass:true,results},null,2));
 }catch(error){fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify({pass:false,error:String(error)},null,2));process.exitCode=1;}
 finally{try{run('close');}catch{}}
}else server.listen(4199,'127.0.0.1',()=>{const worker=spawn(process.execPath,[__filename,'--worker'],{stdio:'inherit'});worker.on('exit',code=>server.close(()=>{process.exitCode=code||0;}));});
