/* Synthetic VM only: no network or production identifiers. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../../src/assets/mft-analytics.js'),'utf8');
const ENDPOINT='https://ops.mft.care/api/marketing/attribution';
const CONSENT='mft.analytics.consent.v5',RECEIVING_CONSENT='mft.analytics.consent.v4';
const ADVERTISING='mft.advertising.consent.v1',SOURCE='mft.analytics.source.v1',PAGE='0123456789abcdef';
const copy=x=>JSON.parse(JSON.stringify(x));
function storage(seed={},blocked=false){
 const m=new Map(Object.entries(seed)),writes=[];
 return {getItem:k=>{if(blocked)throw Error('Storage blocked');return m.get(k)??null;},setItem:(k,v)=>{if(blocked)throw Error('Storage blocked');writes.push({key:k,value:String(v)});m.set(k,String(v));},removeItem:k=>{if(blocked)throw Error('Storage blocked');m.delete(k);},all:()=>Object.fromEntries(m),writes};
}
function fixture({choice='granted',local={},session={},search='',referrer='',origin='https://www.mft.care',endpoint=ENDPOINT,cryptoMode='uuid',responses=[202],blockGoogle=false,gpc=false,dnt='0',clock={now:1800000000000},blockedStorage=false,cookies={},dataset={}}={}){
 const listeners={},elements=[],timers=[],posts=[],attempts=[],googleCalls=[],cookieWrites=[];
 let queries=0,ids=0;
 const cookieJar=new Map(Object.entries(cookies));
 const document={currentScript:{dataset:{mftMeasurementController:'first-party',mftGoogleMode:'disabled',mftPageKey:PAGE,...(endpoint?{mftHandoffEndpoint:endpoint}:{}),...dataset}},readyState:'loading',visibilityState:'visible',referrer,
  get cookie(){return [...cookieJar].map(([k,v])=>k+'='+v).join('; ');},set cookie(value){cookieWrites.push(value);const [name]=value.split('=');if(value.includes('Max-Age=0'))cookieJar.delete(name);},
  getElementById:id=>elements.find(e=>e.id===id&&!e.removed)||null,querySelector:()=>null,
  querySelectorAll:selector=>selector.startsWith('iframe')?elements.filter(e=>e.tag==='iframe'&&!e.removed):[],
  addEventListener:(key,fn)=>listeners['document:'+key]=fn,
  createElement:tag=>{if(['iframe','script'].includes(tag)&&blockGoogle)throw Error('Google loading blocked');const handlers={};const e={tag,style:{},handlers,setAttribute(){},addEventListener:(name,fn)=>handlers[name]=fn,remove(){e.removed=true;},querySelector:()=>({focus(){},remove(){}}),contentWindow:{postMessage:data=>posts.push(copy(data))}};elements.push(e);return e;},body:{appendChild(){}}};
 const c={document,location:{origin,get search(){queries++;return search;}},navigator:{globalPrivacyControl:gpc,doNotTrack:dnt},
  localStorage:storage({...((choice===null)?{}:{[CONSENT]:choice}),...local},blockedStorage),sessionStorage:storage(session,blockedStorage),URL,URLSearchParams,AbortController,Uint8Array,
  Date:class extends Date{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}},
  setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},addEventListener:(key,fn)=>listeners[key]=fn,
  gtag:(...args)=>googleCalls.push(args),
  fetch:(url,options)=>{if(url!==ENDPOINT)throw Error('Unexpected network destination');attempts.push({url,options,body:JSON.parse(options.body)});const result=responses[Math.min(attempts.length-1,responses.length-1)];if(result==='throw')throw Error('Fetch unavailable');if(result==='reject')return Promise.reject(Error('Network failure'));if(result==='pending')return new Promise(()=>{});return Promise.resolve({status:result});}};
 if(cryptoMode!=='missing')c.crypto={getRandomValues:bytes=>{ids++;bytes.fill(ids);return bytes;},...(cryptoMode==='uuid'?{randomUUID:()=>{ids++;return 'a0000000-0000-4000-8000-'+String(ids).padStart(12,'0');}}:{})};
 c.window=c;vm.runInNewContext(code,c);
 const runTimers=delay=>{const pending=timers.filter(t=>(delay===undefined||t.delay===delay)&&!t.ran);for(const t of pending){t.ran=true;t.fn();}return pending.length;};
 return {c,attempts,posts,timers,elements,googleCalls,cookieWrites,runRetry:()=>runTimers(250),runTimers,clock,queries:()=>queries,ids:()=>ids,setup:()=>listeners['document:DOMContentLoaded']?.(),listeners,reload:()=>vm.runInNewContext(code,c)};
}
module.exports={fixture,storage,copy,ENDPOINT,CONSENT,RECEIVING_CONSENT,ADVERTISING,SOURCE,PAGE};
