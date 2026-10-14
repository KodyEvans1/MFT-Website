"""Exercise the real SimplePractice handoff under the site's real CSP.

Only public reads are permitted. No contact details, appointment slots, forms,
clinical information, credentials or payment information are ever submitted.
"""
import functools
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

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/booking-handoff'
OUT.mkdir(parents=True, exist_ok=True)
CONFIG = json.loads((ROOT/'content/simplepractice-booking.json').read_text())
WIDGET_HOST = 'spwidget-marriagefamilytherapy.clientsecure.me'
CSP = re.search(r'Content-Security-Policy: ([^\n]+)', (ROOT/'dist/_headers').read_text())[1]
BASE = os.environ.get('MFT_BASE_URL', '').rstrip('/')
server = None
report = {'pass': False, 'checks': [], 'states': [], 'blockedWrites': [], 'frameViolations': [],
          'scope': 'Public scheduling UI only. No slot selected and no appointment or client details submitted.'}

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

if not BASE:
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    BASE = f'http://127.0.0.1:{server.server_port}'
report['baseUrl'] = BASE

def guard(route):
    request = route.request
    url = urlsplit(request.url)
    if any(x in (url.hostname or '') for x in ['googletagmanager','google-analytics','bugsnag','sentry','segment','doubleclick','facebook']):
        route.abort()
        return
    # This exact endpoint only queries public clinician availability.
    read_post = request.method == 'POST' and url.hostname in [WIDGET_HOST,'marriagefamilytherapy.clientsecure.me'] and url.path == '/client-portal-api/clinician-search/next-slots'
    if request.method not in ['GET','HEAD'] and not read_post:
        report['blockedWrites'].append({'method':request.method,'host':url.hostname,'path':url.path})
        route.abort()
    else:
        route.continue_()

def record(page, frame, label):
    text = frame.locator('body').inner_text()
    report['states'].append({'label':label,'host':urlsplit(frame.url).hostname,'path':urlsplit(frame.url).path,'text':text[:10000]})
    page.screenshot(path=str(OUT/(label+'.png')))
    return text

def click_text_control(frame, label):
    text = frame.get_by_text(label, exact=True).first
    # Choose the existing real UI control; never synthesize requests.
    parent = text.locator('xpath=ancestor-or-self::*[self::a or self::button][1]')
    if parent.count():
        parent.click()
    else:
        group = text.locator('xpath=ancestor::*[.//button or .//a][1]')
        select = group.get_by_role('button', name=re.compile(r'^select$',re.I))
        if not select.count():
            select = group.get_by_role('link', name=re.compile(r'^select$',re.I))
        if select.count():
            select.first.click()
        else:
            text.click()

try:
    if not server:
        # Do not accept an older production release as evidence for the fix.
        expected_core = (ROOT/'src/booking-core.js').read_bytes()
        deadline = time.monotonic()+180
        while True:
            try:
                with urlopen(Request(BASE+'/',headers={'Cache-Control':'no-cache'}),timeout=20) as r:
                    html = r.read().decode()
                    assert WIDGET_HOST in r.headers.get('Content-Security-Policy','')
                asset = re.search(r'src="([^"]*mft-booking-core.js\?v=[^"]+)"',html)[1]
                with urlopen(BASE+asset,timeout=20) as r:
                    assert r.read() == expected_core
                break
            except Exception:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(6)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        cases = [
            ('hero-desktop','/', '.mh-hero a[data-mft-booking]',1440,None,False),
            ('header-desktop','/', 'header a[data-mft-booking]',1440,None,False),
            ('closing-desktop','/', '.mh-closing a[data-mft-booking]',1440,None,False),
            ('hero-mobile','/', '.mh-hero a[data-mft-booking]',390,None,False),
            ('header-mobile','/', 'header a[data-mft-booking]',390,None,False),
            ('footer-mobile','/', 'footer a[data-mft-booking]',390,None,False),
            ('fallback-no-sdk','/', '.mh-hero a[data-mft-booking]',390,None,True)
        ]
        for c in CONFIG['clinicians']:
            cases.append((c['key']+'-profile','/'+c['slug']+'/', 'main a[data-spwidget-clinician-id="'+c['id']+'"]',1440,c,False))
        for label, route, selector, width, clinician, no_sdk in cases:
            context = browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
            context.route('**/*',guard)
            if no_sdk:
                context.route(CONFIG['loaderUrl'],lambda route:route.abort())
            page = context.new_page()
            page.set_default_timeout(20000)
            page.on('console',lambda m:report['frameViolations'].append(m.text) if 'Framing ' in m.text and 'Content Security Policy' in m.text else None)
            response = page.goto(BASE+route,wait_until='domcontentloaded')
            assert response.status == 200
            assert WIDGET_HOST in response.headers.get('content-security-policy','')
            if not no_sdk:
                page.wait_for_function('typeof window.SPWidget === "function"')
            button = page.locator(selector).first
            if not button.is_visible() and label == 'header-mobile':
                page.locator('.menu-button').click()
            href = button.get_attribute('href')
            assert parse_qs(urlsplit(href).query).get('scopeGlobal') == (None if clinician else ['true'])
            button.click()
            gate = page.locator('.mft-consultation-gate')
            if gate.is_visible():
                gate.locator('input[type=checkbox]').check()
                gate.locator('[data-consultation-continue]').click()
            if no_sdk:
                page.wait_for_url(re.compile('^https://'+re.escape(WIDGET_HOST)+'/'))
                frame = page.main_frame
            else:
                iframe = page.locator('.spwidget--scroller iframe.widget-iframe')
                expect(iframe).to_be_visible()
                frame = iframe.element_handle().content_frame()
                frame.wait_for_url(re.compile('^https://'+re.escape(WIDGET_HOST)+'/'))
            frame.wait_for_function('document.body && /request an appointment/i.test(document.body.innerText)')
            page.wait_for_timeout(1000)
            text = record(page,frame,label)
            if clinician:
                assert parse_qs(urlsplit(frame.url).query).get('clinicianId') == [clinician['id']]
                assert clinician['name'].split()[-1] in text
            else:
                assert sum(name in text for name in ['Evans','Johnsrud','Hassan','Nolan','Ashley']) >= 2, text
            report['checks'].append({'label':label,'width':width,'pass':True,'clinician':clinician['key'] if clinician else 'practice-wide'})
            if label == 'kody-profile':
                # Browse the free consultation to its calendar; do not select a slot.
                click_text_control(frame,'10 min Complimentary Phone Consultation')
                page.wait_for_timeout(2000)
                next_text = record(page,frame,'consultation-after-service')
                if 'Telehealth' in next_text:
                    click_text_control(frame,'Telehealth')
                    page.wait_for_timeout(2000)
                    record(page,frame,'consultation-after-location')
            context.close()
        assert not report['frameViolations'], report['frameViolations']
        report['pass'] = True
        browser.close()
except Exception as error:
    report['error'] = str(error)
    try:
        page.screenshot(path=str(OUT/'failure.png'))
        report['failureFrames'] = [{'host':urlsplit(f.url).hostname,'path':urlsplit(f.url).path,'text':f.locator('body').inner_text(timeout=2000)[:5000]} for f in page.frames if urlsplit(f.url).hostname == WIDGET_HOST]
    except Exception:
        pass
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='states'},indent=2))
    if server:
        server.shutdown()
