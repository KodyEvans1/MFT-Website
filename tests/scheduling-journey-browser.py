"""Verify scheduling guidance and native navigation without submitting an appointment."""
import functools, hashlib, json, os, re, threading, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/scheduling-journey';OUT.mkdir(parents=True,exist_ok=True)
BASE=os.getenv('MFT_BASE_URL','').rstrip('/')
LIVE=bool(BASE);VERIFY_SCHEDULER=os.getenv('MFT_VERIFY_SCHEDULER')=='true'
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
report={'pass':False,'environment':'production' if LIVE else 'built review output','checks':[],
        'scope':'Read-only content and browser navigation. No appointments, clients, slots, account configuration, or analytics events created.'}
server=None
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
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
    r=route.request;u=urlsplit(r.url);h=u.hostname
    if r.method=='GET' and h in ['127.0.0.1','www.mft.care','mft.care']:
        route.continue_()
    elif r.method=='GET' and h=='images.squarespace-cdn.com' and r.resource_type=='image':
        route.continue_()
    elif VERIFY_SCHEDULER and h=='marriagefamilytherapy.clientsecure.me' and (r.method=='GET' or (r.method=='POST' and u.path=='/client-portal-api/clinician-search/next-slots')):
        route.continue_()
    else: route.abort()

def save(label,page):
    page.screenshot(path=str(OUT/(label+'.png')),full_page=True)

def record(name,**extra): report['checks'].append({'name':name,'pass':True,**extra})

def ready(page,route='/how-to-start-therapy/'):
    page.goto(BASE+route,wait_until='domcontentloaded')
    if page.locator('[data-choice="deny"]').count():page.locator('[data-choice="deny"]').click()
    page.wait_for_timeout(200)

def navigate_scheduler(page,button,label):
    assert button.get_attribute('href').startswith('https://marriagefamilytherapy.clientsecure.me/request')
    button.click()
    gate=page.locator('.mft-consultation-gate')
    if gate.is_visible():
        assert gate.locator('[data-consultation-continue]').get_attribute('aria-disabled')=='true'
        assert 'hidden number' in gate.inner_text()
        assert 'does not replace the required 30-minute couples consultation' in gate.inner_text()
        gate.locator('input[type="checkbox"]').check()
        assert gate.locator('[data-consultation-continue]').get_attribute('href')=='https://marriagefamilytherapy.clientsecure.me/request'
        gate.locator('[data-consultation-continue]').click()
    page.wait_for_url(re.compile('^https://marriagefamilytherapy\\.clientsecure\\.me/request'))
    page.get_by_text('Request an appointment',exact=True).wait_for(timeout=30000)
    assert len(page.context.pages)==1
    record(label,schedulerUrl=page.url)

try:
    if LIVE:
        deadline=time.monotonic()+180
        while True:
            try:
                with urlopen(Request(BASE+'/how-to-start-therapy/',headers={'Cache-Control':'no-cache'}),timeout=20) as r:
                    html=r.read().decode();assert r.status==200
                assert 'data-scheduling-journey="20261025"' in html
                src=re.search(r'src="([^"]*/mft-booking.js\?v=[^"]+)"',html)[1]
                with urlopen(BASE+src,timeout=20) as r:assert r.read()==(ROOT/'src/assets/mft-booking.js').read_bytes()
                report['matchingPublishedAssets']=True
                break
            except Exception:
                if time.monotonic()>=deadline:raise
                time.sleep(6)
    with sync_playwright() as p:
        opts={'headless':True}
        if os.getenv('MFT_CHROMIUM'):opts['executable_path']=os.environ['MFT_CHROMIUM']
        browser=p.chromium.launch(**opts)
        context=browser.new_context(reduced_motion='reduce');context.route('**/*',guard)
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        for width in [1440,1024,768,390,320]:
            page.set_viewport_size({'width':width,'height':1000 if width>=768 else 844})
            ready(page)
            assert page.locator('h1').count()==1
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'overflow {width}'
            for section in ['individual-journey','couples-journey','consultation-call']:
                assert page.locator('#'+section).count()==1
            text=page.locator('main').inner_text()
            for phrase in ['Neither consultation is required','paid 30-minute individual consultation','90791','All couples begin','One diagnostic evaluation per partner','53-minute couples sessions','do not establish ongoing individual therapy','does not work immediately','hidden, private, or unknown']:
                assert phrase in text,phrase
            ids=page.locator('[id]').evaluate_all('(els)=>els.map(e=>e.id)');assert len(ids)==len(set(ids))
            nav=page.locator('header .primary-nav')
            if page.locator('.menu-button').is_visible():
                page.locator('.menu-button').click();expect(nav.locator('a[href="/how-to-start-therapy/"]')).to_be_visible();page.keyboard.press('Escape')
            else:
                boxes=nav.locator('a').evaluate_all('(els)=>els.map(e=>({x:e.getBoundingClientRect().x,r:e.getBoundingClientRect().right,y:e.getBoundingClientRect().y,b:e.getBoundingClientRect().bottom}))')
                for a,b in zip(boxes,boxes[1:]):assert a['r']<=b['x']+1 or a['b']<=b['y']+1,('nav overlap',width)
            save('journey-'+str(width),page)
            if width in [1440,390]:
                page.locator('#couples-journey').screenshot(path=str(OUT/f'couples-{width}.png'))
                page.locator('#consultation-call').screenshot(path=str(OUT/f'phone-{width}.png'))
            summary=page.locator('#start-questions summary').first
            summary.click();assert page.locator('#start-questions details').first.get_attribute('open') is not None
            summary.press('Enter');assert page.locator('#start-questions details').first.get_attribute('open') is None
            free=page.locator('.start-options a[data-mft-booking]').first
            free.click();gate=page.locator('.mft-consultation-gate');expect(gate).to_be_visible()
            assert gate.locator('[data-consultation-continue]').get_attribute('href') is None
            gate.locator('input').check();assert gate.locator('[data-consultation-continue]').get_attribute('href')=='https://marriagefamilytherapy.clientsecure.me/request'
            page.keyboard.press('Escape');assert not gate.is_visible()
            record('Guide, navigation, FAQ and acknowledgment',width=width)
        for route in ['/','/new-page/','/marriage-and-couples-therapy-counseling/','/team/']:
            for width in [1440,390]:
                page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844});ready(page,route)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(route,width)
                assert page.locator('header a[href="/how-to-start-therapy/"]').count()==1
                assert page.locator('footer a[href="/how-to-start-therapy/"]').count()==1
                text=page.locator('main').inner_text()
                assert not re.search(r'26[ -]minute|Three ways to begin couples|One per new client',text)
                if route=='/marriage-and-couples-therapy-counseling/':
                    for phrase in ['30-minute','diagnostic evaluation per partner','53-minute couples sessions']:assert phrase.lower() in text.lower()
                if route=='/new-page/':assert '90791' in text and '30-minute' in text
                if route=='/':save('homepage-'+str(width),page)
                record('Shared discovery and preserved layout',route=route,width=width)
        nojs=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});nojs.route('**/*',guard)
        n=nojs.new_page();n.goto(BASE+'/how-to-start-therapy/',wait_until='domcontentloaded')
        assert n.locator('#couples-journey').count()==1
        assert n.locator('.start-options a').first.get_attribute('href')=='https://marriagefamilytherapy.clientsecure.me/request'
        record('No-JavaScript content and direct scheduling');nojs.close()
        if VERIFY_SCHEDULER:
            for width in [1440,390]:
                page.set_viewport_size({'width':width,'height':1000})
                for label,selector in [('free','.start-options a[data-mft-booking]'),('individual-evaluation','#individual-journey .journey-actions a:first-child'),('paid-individual','#individual-journey .journey-actions a:last-child'),('required-couples','#couples-journey .journey-actions a')]:
                    ready(page);navigate_scheduler(page,page.locator(selector).first,label+'-'+str(width))
                save('public-scheduler-'+str(width),page)
        assert not errors,errors
        browser.close()
    report['pass']=True
except Exception as e:
    report['error']=str(e)
    try:save('failure',page)
    except Exception:pass
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    if server:server.shutdown()
