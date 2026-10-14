"""Verify full-page scheduling. Never select a slot or submit client information."""
import functools
import hashlib
import json
import os
from pathlib import Path
import re
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/booking-handoff';OUT.mkdir(parents=True,exist_ok=True)
CONFIG=json.loads((ROOT/'content/simplepractice-booking.json').read_text())
PORTAL='marriagefamilytherapy.clientsecure.me'
WIDGET='spwidget-marriagefamilytherapy.clientsecure.me'
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
BASE=os.environ.get('MFT_BASE_URL','').rstrip('/')
report={'pass':False,'checks':[],'states':[],'blockedWrites':[],
        'scope':'Real full-page scheduling, no embedded SDK, no slot selection or submitted client data.'}
server=None
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def end_headers(self):
        self.send_header('Content-Security-Policy',CSP)
        self.send_header('Referrer-Policy','no-referrer')
        super().end_headers()
if not BASE:
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    BASE=f'http://127.0.0.1:{server.server_port}'
report['baseUrl']=BASE

def guard(route):
    r=route.request;u=urlsplit(r.url);host=u.hostname or ''
    # The integration script is deliberately blocked even if an old page requests it.
    if r.url==CONFIG['loaderUrl'] or any(s in host for s in ['googletagmanager','google-analytics','bugsnag','sentry','segment','doubleclick','facebook']):
        route.abort();return
    read_post=r.method=='POST' and host in [PORTAL,WIDGET] and u.path=='/client-portal-api/clinician-search/next-slots'
    if r.method not in ['GET','HEAD'] and not read_post:
        report['blockedWrites'].append({'method':r.method,'host':host,'path':u.path})
        route.abort()
    else:route.continue_()

def state(page,label):
    item={'label':label,'host':urlsplit(page.url).hostname,'path':urlsplit(page.url).path,'text':page.locator('body').inner_text()[:9000]}
    report['states'].append(item)
    page.screenshot(path=str(OUT/(label+'.png')))
    return item['text']

def choose(page,label):
    text=page.get_by_text(label,exact=True).first
    control=text.locator('xpath=ancestor-or-self::*[self::a or self::button][1]')
    if control.count():control.click();return
    group=text.locator('xpath=ancestor::*[.//button or .//a][1]')
    control=group.get_by_role('button',name=re.compile('^select$',re.I))
    if not control.count():control=group.get_by_role('link',name=re.compile('^select$',re.I))
    if control.count():control.first.click()
    else:text.click()

try:
    if not server:
        deadline=time.monotonic()+180
        while True:
            try:
                with urlopen(Request(BASE+'/',headers={'Cache-Control':'no-cache'}),timeout=20) as r:html=r.read().decode()
                assert 'data-mft-booking-mode="direct"' in html
                assert CONFIG['loaderUrl'] not in html and 'data-spwidget-autobind' not in html
                for name,source in [('mft-booking-core.js','src/booking-core.js'),('mft-booking.js','src/assets/mft-booking.js')]:
                    asset=re.search(r'src="([^\"]*'+re.escape(name)+r'\?v=[^\"]+)"',html)[1]
                    with urlopen(BASE+asset,timeout=20) as r:assert r.read()==(ROOT/source).read_bytes()
                report['matchingPublishedAssets']=True
                break
            except Exception as e:
                if time.monotonic()>=deadline:raise
                time.sleep(6)
    with sync_playwright() as p:
        cases=[('hero-desktop','/','.mh-hero a[data-mft-booking]',1440,None),
               ('header-desktop','/','header a[data-mft-booking]',1440,None),
               ('closing-desktop','/','.mh-closing a[data-mft-booking]',1440,None),
               ('hero-mobile','/','.mh-hero a[data-mft-booking]',390,None),
               ('header-mobile','/','header a[data-mft-booking]',390,None),
               ('footer-mobile','/','footer a[data-mft-booking]',390,None),
               ('starting-care','/how-to-start-therapy/','main a[data-mft-booking]',1440,None),
               ('individual-care','/new-page/','main a[data-mft-booking]',390,None)]
        for c in CONFIG['clinicians']:
            cases.append((c['key']+'-profile','/'+c['slug']+'/','main a[data-spwidget-clinician-id="'+c['id']+'"]',1440,c))
        for engine,engine_cases in [('chromium',cases),('webkit',[cases[0],cases[3]])]:
            browser=getattr(p,engine).launch(headless=True)
            for label,path,selector,width,clinician in engine_cases:
                label=engine+'-'+label
                context=browser.new_context(viewport={'width':width,'height':950},reduced_motion='reduce')
                context.route('**/*',guard)
                page=context.new_page();page.set_default_timeout(25000)
                response=page.goto(BASE+path,wait_until='domcontentloaded');assert response.status==200
                assert page.locator('script[src*="integration-1.0"]').count()==0
                assert page.locator('[data-spwidget-autobind]').count()==0
                button=page.locator(selector).first
                if not button.is_visible() and 'header-mobile' in label:page.locator('.menu-button').click()
                href=button.get_attribute('href');assert button.get_attribute('target') in [None,'','_self']
                if clinician:assert parse_qs(urlsplit(href).query)['clinicianId']==[clinician['id']]
                else:assert href=='https://'+PORTAL+'/request'
                button.click()
                gate=page.locator('.mft-consultation-gate')
                if gate.count() and gate.is_visible():
                    go=gate.locator('[data-consultation-continue]')
                    expect(go).to_be_disabled();assert go.get_attribute('href') is None
                    gate.locator('input[type=checkbox]').check();expect(go).to_be_enabled()
                    assert go.get_attribute('href')==href
                    go.click()
                host=WIDGET if clinician else PORTAL
                page.wait_for_url(re.compile('^https://'+re.escape(host)+'/'))
                page.wait_for_function('document.body && /request an appointment/i.test(document.body.innerText)')
                if clinician:
                    page.get_by_text(clinician['name'].replace('Dr. ',''),exact=True).first.wait_for(state='visible')
                    assert parse_qs(urlsplit(page.url).query).get('clinicianId')==[clinician['id']]
                else:page.get_by_text('Kody Evans',exact=True).first.wait_for(state='visible')
                assert len(context.pages)==1,'Booking unexpectedly opened a popup'
                text=state(page,label)
                if not clinician:assert sum(n in text for n in ['Evans','Johnsrud','Hassan','Nolan','Ashley'])>=2
                report['checks'].append({'label':label,'pass':True,'sameTab':True,'destinationHost':host})
                if label=='chromium-kody-profile':
                    choose(page,'10 min Complimentary Phone Consultation');page.wait_for_timeout(1000)
                    text=state(page,'consultation-service')
                    if 'Telehealth' in text:choose(page,'Telehealth')
                    page.wait_for_url(re.compile('/widget/date'))
                    page.wait_for_function('document.body && /October|November|Select a date|Sun|Mon/.test(document.body.innerText)')
                    state(page,'consultation-calendar');report['consultationCalendarReached']=True
                context.close()
            if engine=='chromium':
                context=browser.new_context(java_script_enabled=False)
                context.route('**/*',guard);page=context.new_page()
                page.goto(BASE+'/',wait_until='domcontentloaded')
                a=page.locator('.mh-hero a[data-mft-booking]').first
                assert a.get_attribute('href')=='https://'+PORTAL+'/request'
                with page.expect_navigation(wait_until='domcontentloaded') as nav:a.click()
                assert nav.value.status==200 and urlsplit(page.url).hostname==PORTAL
                report['staticLinkNavigatesWithoutJavaScript']=True
                context.close()
            browser.close()
    report['pass']=True
except Exception as e:
    report['error']=str(e)
    try:
        page.screenshot(path=str(OUT/'failure.png'))
        report['failureUrl']=urlsplit(page.url).hostname+urlsplit(page.url).path
    except Exception:pass
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k not in ['states','blockedWrites']},indent=2))
    if server:server.shutdown()
