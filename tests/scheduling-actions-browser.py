"""Read-only verification of public buttons. Never sign in or submit appointments."""
import functools, hashlib, json, os, re, threading, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/scheduling-actions';OUT.mkdir(parents=True,exist_ok=True)
BASE=os.getenv('MFT_BASE_URL','').rstrip('/');LIVE=bool(BASE)
VERIFY=os.getenv('MFT_VERIFY_SCHEDULER')=='true'
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
REPORT={'pass':False,'environment':'production' if LIVE else 'built candidate','checks':[],
        'scope':'Public content and native same-tab handoff only. No sign-in, email requests, appointments, client data, or analytics events. No authenticated scheduling permission or prerequisite enforcement is claimed.'}
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
REPORT['baseUrl']=BASE

def guard(route):
    r=route.request;u=urlsplit(r.url);h=u.hostname or ''
    if r.method=='GET' and h in ['127.0.0.1','www.mft.care','mft.care']:
        route.continue_()
    elif r.method=='GET' and h=='images.squarespace-cdn.com' and r.resource_type=='image':
        route.continue_()
    elif VERIFY and h=='marriagefamilytherapy.clientsecure.me' and (r.method=='GET' or (r.method=='POST' and u.path=='/client-portal-api/clinician-search/next-slots')):
        route.continue_()
    else:route.abort()

def record(name,**extra):REPORT['checks'].append({'name':name,'pass':True,**extra})
def ready(page,route='/'):
    response=page.goto(BASE+route,wait_until='domcontentloaded',timeout=30000)
    assert response.status==200
    if page.locator('[data-choice="deny"]').count():page.locator('[data-choice="deny"]').click()
    page.wait_for_timeout(150)

def snapshot(page,name,full=False):page.screenshot(path=str(OUT/(name+'.png')),full_page=full)

try:
    if LIVE:
        version=hashlib.sha256((ROOT/'src/scheduling-actions.js').read_bytes()).hexdigest()
        deadline=time.monotonic()+180
        while True:
            try:
                with urlopen(Request(BASE+'/',headers={'Cache-Control':'no-cache'}),timeout=15) as r:
                    html=r.read().decode();assert r.status==200
                assert 'data-scheduling-actions="20261029"' in html
                assert 'data-mft-existing-client="true"' in html
                css_url=re.search(r'href="(/assets/styles.css\?v=[^"]+)"',html)[1]
                # Production includes analytics CSS; require the complete new scheduling
                # stylesheet text rather than compare bytes with a preview build.
                with urlopen(BASE+css_url,timeout=15) as r:css=r.read().decode()
                assert (ROOT/'src/assets/start-page.css').read_text() in css
                with urlopen(BASE+'/how-to-start-therapy/',timeout=15) as r:guide=r.read().decode()
                assert 'id="returning-couples"' in guide and 'all three preparation appointments' in guide
                REPORT['matchingPublishedContent']=True
                REPORT['verifiedStylesheet']=css_url
                REPORT['sourceComponentSha256']=version
                break
            except Exception:
                if time.monotonic()>=deadline:raise
                time.sleep(6)
    with sync_playwright() as p:
        options={'headless':True}
        if os.getenv('MFT_CHROMIUM'):options['executable_path']=os.environ['MFT_CHROMIUM']
        browser=p.chromium.launch(**options)
        context=browser.new_context(reduced_motion='reduce');context.route('**/*',guard)
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        for width in [1440,1024,768,390,320]:
            page.set_viewport_size({'width':width,'height':1000 if width>=768 else 844})
            for route in ['/','/how-to-start-therapy/']:
                ready(page,route)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(route,width)
                assert page.locator('h1').count()==1
                existing=page.locator('a[data-mft-existing-client="true"]')
                assert existing.count()>=2
                for a in existing.all():
                    assert a.get_attribute('href')=='https://marriagefamilytherapy.clientsecure.me/sign-in'
                    assert not a.get_attribute('data-mft-booking') and not a.get_attribute('data-mft-ten-minute-consultation')
                assert page.locator('a[data-mft-couples-consultation="true"]').count()>=2
                if route=='/':
                    hero=page.locator('.mh-hero')
                    expect(hero.locator('[data-mft-existing-client]')).to_be_visible()
                    expect(hero.locator('[data-mft-couples-consultation]')).to_be_visible()
                    assert 'no 10-minute call required first' in hero.inner_text()
                    assert page.locator('.mft-schedule-shortcuts').count()==0
                    if VERIFY:assert page.locator('.mh-lobby').evaluate('(i)=>i.decode().then(()=>i.naturalWidth>0).catch(()=>false)')
                else:
                    assert 'Do not request a 53-minute couples session' in page.locator('main').inner_text()
                    details=page.locator('.mft-couples-readiness')
                    assert not details.locator('a[data-mft-existing-client]').is_visible()
                    details.locator('summary').click();expect(details.locator('a[data-mft-existing-client]')).to_be_visible()
                    details.locator('summary').press('Enter');assert not details.locator('a[data-mft-existing-client]').is_visible()
                page.evaluate('window.scrollTo(0,0)')
                if width in [1440,390]:
                    name=('home' if route=='/' else 'guide')+'-'+str(width)
                    snapshot(page,name+'-opening');snapshot(page,name,True)
                    if route!='/':page.locator('#existing-clients').screenshot(path=str(OUT/f'existing-clients-{width}.png'))
                record('Responsive choices and qualifiers',route=route,width=width)
        for route in ['/team/','/sonia-hassan-bio/','/new-page/','/marriage-and-couples-therapy-counseling/','/marriagereset/','/marriage-reset-assessment/']:
            ready(page,route)
            expect(page.locator('.mft-schedule-shortcuts [data-mft-existing-client]')).to_be_visible()
            expect(page.locator('.mft-schedule-shortcuts [data-mft-couples-consultation]')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            record('Shared scheduling shortcuts',route=route)
        nojs=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});nojs.route('**/*',guard)
        n=nojs.new_page();ready(n,'/how-to-start-therapy/')
        details=n.locator('.mft-couples-readiness');assert not details.locator('a').is_visible()
        details.locator('summary').click();expect(details.locator('a')).to_be_visible()
        assert details.locator('a').get_attribute('href')=='https://marriagefamilytherapy.clientsecure.me/sign-in'
        record('No-JavaScript couples readiness and native links');nojs.close()
        if VERIFY:
            for width in [1440,390]:
                page.set_viewport_size({'width':width,'height':1000})
                for route,prefix in [('/','.mh-hero'),('/team/','.mft-schedule-shortcuts'),('/how-to-start-therapy/','footer')]:
                    for kind in ['existing-client','couples-consultation']:
                        ready(page,route)
                        a=page.locator(prefix+' a[data-mft-'+kind+']').first
                        a.click()
                        expected='/sign-in' if kind=='existing-client' else '/request'
                        page.wait_for_url(re.compile('^https://marriagefamilytherapy\\.clientsecure\\.me'+expected))
                        if kind=='existing-client':
                            page.get_by_role('heading',name=re.compile('sign in',re.I)).wait_for(timeout=30000)
                            assert page.get_by_text('Send Link',exact=True).count() or page.locator('input[type="email"]').count()
                        else:page.get_by_text('Request an appointment',exact=True).wait_for(timeout=30000)
                        assert len(context.pages)==1
                        record('Actual SimplePractice handoff',kind=kind,route=route,width=width,destination=page.url)
                ready(page,'/')
                page.locator('.mh-hero a[data-mft-ten-minute-consultation]').click()
                expect(page.locator('.mft-consultation-gate')).to_be_visible()
                page.locator('.mft-consultation-gate input').check()
                page.locator('[data-consultation-continue]').click()
                page.wait_for_url(re.compile('^https://marriagefamilytherapy\\.clientsecure\\.me/request'))
                page.get_by_text('Request an appointment',exact=True).wait_for(timeout=30000)
                record('Free 10-minute introduction preserved',width=width)
        assert not errors,errors
        browser.close()
    REPORT['pass']=True
except Exception as e:
    REPORT['error']=str(e)
    try:snapshot(page,'failure',True)
    except Exception:pass
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(REPORT,indent=2));print(json.dumps(REPORT,indent=2))
    if server:server.shutdown()
