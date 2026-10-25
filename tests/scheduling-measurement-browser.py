"""Candidate rehearsal: real Google script, intercepted collector and scheduling. No booking submitted."""
import json, mimetypes, os, re, time
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/scheduling-measurement';OUT.mkdir(parents=True,exist_ok=True)
BASE='https://www.mft.care';MID='G-BTK39BBNRE'
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
EVENTS={'page_view','first_visit','session_start','user_engagement','appointment_request_click','clinician_schedule_click','consultation_click','simplepractice_exit'}
report={'passed':False,'checks':[],'scope':'Production-origin candidate with real Google script; collector and SimplePractice navigation intercepted; no appointments or client data.'}
hits=[];loaders=[];destinations=[];errors=[];blocked=False

def guard(route):
 req=route.request;u=urlsplit(req.url)
 if u.hostname=='www.mft.care':
  f=ROOT/'dist'/u.path.lstrip('/')
  if u.path.endswith('/') or not f.suffix:f=f/'index.html'
  if not f.is_file():route.fulfill(status=404,body='Not found');return
  route.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':mimetypes.guess_type(str(f))[0] or 'application/octet-stream','Content-Security-Policy':CSP,'Referrer-Policy':'no-referrer'})
 elif u.hostname=='www.googletagmanager.com' and u.path=='/gtag/js':
  assert not req.headers.get('referer');loaders.append(req.url)
  if blocked:route.abort()
  else:route.continue_()
 elif u.hostname in ['www.google-analytics.com','region1.google-analytics.com'] and u.path.endswith('/collect'):
  base=parse_qs(u.query,keep_blank_values=True)
  for line in (req.post_data or '').splitlines() or ['']:
   data={**base,**parse_qs(line,keep_blank_values=True)}
   assert data.get('tid')==[MID]
   assert data.get('en',[''])[0] in EVENTS,data.get('en')
   assert re.fullmatch(r'https://www\.mft\.care/p/[a-f0-9]{16}/',data.get('dl',[''])[0]),data.get('dl')
   assert data.get('dt')==['M.F.T. Public Website']
   raw=unquote(json.dumps(data)).lower()
   for word in ['private-canary','example.invalid','secret-click','clinicianid','2065412','link_url','form_submit','form_start','appointment_booked','member_id','utm_term','gclid','gbraid','wbraid']:
    assert word not in raw,('unexpected payload field',word)
   assert data.get('npa')==['1']
   hits.append(data)
  route.fulfill(status=204,body='')
 elif u.hostname in ['marriagefamilytherapy.clientsecure.me','clientsecure.me']:
  destinations.append(req.url)
  route.fulfill(status=200,content_type='text/html',body='<h1>Intercepted scheduler. No real appointment request.</h1>')
 else:route.abort()

def start(browser,path='/',consent=None,legacy=None,viewport=None,signal=None):
 hits.clear();loaders.clear();destinations.clear();errors.clear()
 c=browser.new_context(viewport=viewport or {'width':1440,'height':1000},reduced_motion='reduce');c.route('**/*',guard)
 if consent:c.add_init_script("localStorage.setItem('mft.analytics.consent.v3',"+json.dumps(consent)+")")
 if legacy:c.add_init_script("localStorage.setItem('mft.analytics.consent.v2',"+json.dumps(legacy)+")")
 if signal:c.add_init_script("Object.defineProperty(Navigator.prototype,"+json.dumps(signal)+",{get:()=>"+('true' if signal=='globalPrivacyControl' else "'1'")+"})")
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+path,wait_until='domcontentloaded');return c,page

def count(name):return sum(h.get('en')==[name] for h in hits)
def wait_event(page,name):
 deadline=time.monotonic()+12
 while time.monotonic()<deadline:
  if count(name):return
  page.wait_for_timeout(100)
 raise AssertionError('No event received: '+name)
def check(name):
 assert not errors,errors
 report['checks'].append({'name':name,'pass':True})

try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  c,page=start(browser,legacy='granted');page.wait_for_timeout(400)
  assert page.locator('#mft-analytics-consent').is_visible() and not loaders and not hits
  check('Prior visit-only grant requires a fresh analytics choice');c.close()
  c,page=start(browser,legacy='denied');page.wait_for_timeout(250)
  assert not page.locator('#mft-analytics-consent').count() and not loaders
  check('Previous refusal remains respected');c.close()
  c,page=start(browser,'/?utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053&gclid=secret-click&utm_term=private-canary&email=private-canary%40example.invalid',consent='granted')
  wait_event(page,'page_view');assert count('page_view')==1
  data=next(h for h in hits if h.get('en')==['page_view'])
  assert data.get('cs')==['google'] and data.get('cm')==['cpc'],('missing source/medium',data)
  assert data.get('ci')==['24362234053'],('missing campaign id',data)
  check('Google payload has allowlisted paid source but no sensitive query or click identifiers')
  page.locator('.mh-hero a[data-mft-booking]').click();wait_event(page,'consultation_click')
  assert count('simplepractice_exit')==0 and not destinations
  page.locator('.mft-consultation-gate button[value="cancel"]').last.click();page.wait_for_timeout(100)
  assert count('simplepractice_exit')==0
  check('Consultation open and cancel do not count as handoff or booking')
  page.locator('.mh-hero a[data-mft-booking]').click();page.locator('.mft-consultation-gate input[type="checkbox"]').check()
  page.locator('[data-consultation-continue]').click();page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request');page.wait_for_timeout(300)
  assert count('simplepractice_exit')==1 and len(destinations)==1
  assert count('appointment_request_click')==0
  check('Continue emits one handoff and preserves scheduling destination');c.close()
  c,page=start(browser,consent='granted');wait_event(page,'page_view')
  page.locator('footer a[data-mft-booking]').first.focus();page.keyboard.press('Enter');page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request');page.wait_for_timeout(200)
  assert count('appointment_request_click')==1 and count('simplepractice_exit')==1
  check('Keyboard footer request: one subtype and one handoff, not two acquisitions');c.close()
  c,page=start(browser,'/sonia-hassan-bio/',consent='granted');wait_event(page,'page_view')
  expected=page.locator('a[data-spwidget-clinician-id="2065412"]').first.get_attribute('href')
  page.locator('a[data-spwidget-clinician-id="2065412"]').first.click();page.wait_for_url('https://clientsecure.me/widget-redirect?*');page.wait_for_timeout(200)
  assert destinations==[expected] and count('clinician_schedule_click')==1 and count('simplepractice_exit')==1
  check('Clinician destination preserved without clinician identity in Google payload');c.close()
  c,page=start(browser,consent='denied',viewport={'width':390,'height':844});page.locator('footer a[data-mft-booking]').first.click();page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request')
  assert not hits and not loaders
  check('Mobile scheduling works with analytics declined');c.close()
  blocked=True;c,page=start(browser,consent='granted');page.wait_for_timeout(100)
  begin=time.monotonic();page.locator('footer a[data-mft-booking]').first.click();page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request')
  assert time.monotonic()-begin<3 and not hits
  check('Blocked Google tag does not prevent scheduling');c.close();blocked=False
  for signal in ['globalPrivacyControl','doNotTrack']:
   c,page=start(browser,consent='granted',signal=signal);page.wait_for_timeout(300)
   assert not loaders and not hits;check(signal+' overrides stored grant');c.close()
  c,page=start(browser,'/?utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053',consent='granted');wait_event(page,'page_view')
  hits.clear();page.goto(BASE+'/team/',wait_until='domcontentloaded');wait_event(page,'page_view')
  data=next(h for h in hits if h.get('en')==['page_view']);assert data.get('cs')==['google'] and data.get('cm')==['cpc']
  check('Consented acquisition survives internal page navigation')
  page.locator('.mft-analytics-settings').click();page.locator('[data-choice="deny"]').click();page.wait_for_timeout(200)
  assert page.evaluate("sessionStorage.getItem('mft.analytics.source.v1')") is None
  assert not page.locator('iframe[title="Optional website traffic measurement"]').count()
  before=len(hits);page.locator('footer a[data-mft-booking]').first.click();page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request');page.wait_for_timeout(200)
  assert len(hits)==before
  check('Revocation clears source and disables events without disabling booking');c.close()
  for route in ['/check-my-coverage/','/marriage-reset-assessment/','/start/','/marriagereset/']:
   c,page=start(browser,route,consent='granted');page.wait_for_timeout(200)
   assert not page.locator('script[data-mft-measurement-id]').count() and not hits and not loaders
   check('Sensitive route unmeasured: '+route);c.close()
  browser.close()
 report['passed']=True
except Exception as e:
 report['error']=str(e)
 try:page.screenshot(path=str(OUT/'failure.png'))
 except Exception:pass
 raise
finally:
 (OUT/'result.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
