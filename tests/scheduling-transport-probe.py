"""Synthetic diagnostics only; collector and scheduler are intercepted."""
import json, mimetypes, re
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/scheduling-measurement';OUT.mkdir(parents=True,exist_ok=True)
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
trace=[];network=[]
def guard(route):
 req=route.request;u=urlsplit(req.url)
 if u.hostname=='www.mft.care':
  f=ROOT/'dist'/u.path.lstrip('/')
  if u.path.endswith('/') or not f.suffix:f=f/'index.html'
  if not f.is_file():route.fulfill(status=404,body='Not found');return
  route.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':mimetypes.guess_type(str(f))[0] or 'application/octet-stream','Content-Security-Policy':CSP,'Referrer-Policy':'no-referrer'})
 elif u.hostname=='www.googletagmanager.com' and u.path=='/gtag/js':route.continue_()
 elif u.hostname in ['www.google-analytics.com','region1.google-analytics.com'] and u.path.endswith('/collect'):
  for line in (req.post_data or '').splitlines() or ['']:
   data={**parse_qs(u.query),**parse_qs(line)}
   network.append({'event':data.get('en'), 'tid':data.get('tid')})
  route.fulfill(status=204,body='')
 elif u.hostname in ['clientsecure.me','marriagefamilytherapy.clientsecure.me']:
  if req.is_navigation_request():network.append({'destination':'intercepted-scheduler'})
  route.fulfill(status=200,content_type='text/html',body='<h1>Intercepted scheduling. No real request.</h1>')
 else:route.abort()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 c=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce');c.route('**/*',guard)
 c.add_init_script("if(location.origin==='https://www.mft.care')localStorage.setItem('mft.analytics.consent.v3','granted')")
 page=c.new_page();page.on('console',lambda msg:trace.append(msg.text) if msg.text.startswith('MFTPROBE ') else None)
 page.goto('https://www.mft.care/?utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053',wait_until='domcontentloaded');page.wait_for_timeout(3000)
 for frame in page.frames:
  frame.evaluate('''()=>{
   const log=(kind,data)=>console.log('MFTPROBE '+JSON.stringify({t:performance.now(),kind,data}));
   window.addEventListener('message',e=>{if(e.data&&String(e.data.type).startsWith('mft:'))log('message',{type:e.data.type,id:e.data.id,names:e.data.names})});
   if(window.gtag){const old=window.gtag;window.gtag=function(){const a=Array.from(arguments);log('gtag',{command:a[0],name:a[1],disabled:window['ga-disable-G-BTK39BBNRE']===true});if(a[0]==='event'&&a[2]?.event_callback){const cb=a[2].event_callback;a[2]={...a[2],event_callback:()=>{log('callback',a[1]);cb()}};return old.apply(this,a)}}
   if(window.MFTSchedulingMeasurement){const old=window.MFTSchedulingMeasurement.track;window.MFTSchedulingMeasurement.track=function(names,placement,done){log('track',{names,placement,consent:window.MFTAnalyticsConsent.status()});return old.call(this,names,placement,done?()=>{log('navigation-done',names);done()}:undefined)}}
  }''')
 page.locator('.mh-hero a[data-mft-booking]').click();page.wait_for_timeout(3000)
 page.locator('.mft-consultation-gate button[value="cancel"]').last.click();page.wait_for_timeout(100)
 page.locator('.mh-hero a[data-mft-booking]').click();page.locator('.mft-consultation-gate input[type="checkbox"]').check()
 page.locator('[data-consultation-continue]').click();page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request');page.wait_for_timeout(500)
 result={'trace':trace,'network':network};print(json.dumps(result,indent=2));(OUT/'transport-probe.json').write_text(json.dumps(result,indent=2))
 c.close();browser.close()
