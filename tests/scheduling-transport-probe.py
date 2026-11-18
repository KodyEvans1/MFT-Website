"""Synthetic diagnostics only; collector and scheduler are intercepted."""
import json, mimetypes, os, re, shutil
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
 chrome=os.getenv('CHROME_PATH') or os.getenv('MFT_CHROMIUM') or shutil.which('google-chrome') or shutil.which('chromium')
 browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
 c=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce');c.route('**/*',guard)
 c.add_init_script("if(location.origin==='https://www.mft.care')localStorage.setItem('mft.analytics.consent.v3','granted')")
 page=c.new_page();page.on('console',lambda msg:trace.append(msg.text) if msg.text.startswith('MFTPROBE ') else None)
 page.goto('https://www.mft.care/?utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053',wait_until='domcontentloaded');page.wait_for_timeout(3000)
 for frame in page.frames:
  frame.evaluate((ROOT/'tests/fixtures/scheduling-transport-probe.js').read_text())
 page.locator('.mh-hero a[data-mft-ten-minute-consultation="true"]').click();page.wait_for_timeout(3000)
 page.locator('.mft-consultation-gate button[value="cancel"]').last.click();page.wait_for_timeout(100)
 page.locator('.mh-hero a[data-mft-ten-minute-consultation="true"]').click();page.locator('.mft-consultation-gate input[type="checkbox"]').check()
 page.locator('[data-consultation-continue]').click();page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request');page.wait_for_timeout(500)
 result={'trace':trace,'network':network};print(json.dumps(result,indent=2));(OUT/'transport-probe.json').write_text(json.dumps(result,indent=2))
 c.close();browser.close()
