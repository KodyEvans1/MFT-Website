"""Read-only booking checks. Never select services, slots, submit, or sign in."""
import argparse, functools, hashlib, http.server, json, os, re, shutil, threading, time
from pathlib import Path
from urllib.parse import urlencode, urlsplit, parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/autumn-booking';OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--scheduler',action='store_true');parser.add_argument('--production',action='store_true');args=parser.parse_args()
cfg=json.loads((ROOT/'content/simplepractice-booking.json').read_text())
EXPECTED='https://clientsecure.me/widget-redirect?'+urlencode(dict(scopeId=cfg['scopeId'],applicationId=cfg['applicationId'],channel='client_portal',appearance='{"fullScreen":true}',clinicianId='2183370'))
ROUTES=['/autumn-alexander/','/','/team/','/childrentherapy/','/teen-counseling/','/new-page/']
report={'environment':'actual public production' if args.production else 'built site on CI local HTTP','checks':[],'scheduler':[],'blockedWrites':[],'pass':False,'limits':'No service, appointment slot, patient information, login, email, payment or analytics event submitted. Clicks do not prove bookings or attendance.'}
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
    def end_headers(self):
        self.send_header('Referrer-Policy','no-referrer')
        super().end_headers()
server=None
if args.production:base='https://www.mft.care'
else:
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
def valid(href):
    u=urlsplit(href);v=urlsplit(EXPECTED)
    return u.scheme==v.scheme and u.netloc==v.netloc and u.path==v.path and parse_qs(u.query)==parse_qs(v.query)
analytics=('google-analytics','googletagmanager','doubleclick','facebook','segment','bugsnag','sentry')
def guard(route):
    r=route.request;u=urlsplit(r.url);host=u.hostname or ''
    if any(x in host for x in analytics):route.abort();return
    read_post=r.method=='POST' and host in ('marriagefamilytherapy.clientsecure.me','spwidget-marriagefamilytherapy.clientsecure.me') and u.path=='/client-portal-api/clinician-search/next-slots'
    if r.method not in ('GET','HEAD') and not read_post:
        report['blockedWrites'].append({'method':r.method,'host':host,'path':u.path});route.abort();return
    route.continue_()
try:
    executable=os.environ.get('CHROME_PATH') or shutil.which('google-chrome') or shutil.which('chromium')
    if not executable:raise RuntimeError('No browser executable')
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
        if args.production:
            request=p.request.new_context()
            for attempt in range(18):
                r=request.get(base+'/autumn-alexander/',headers={'Cache-Control':'no-cache'},timeout=20000)
                if r.status==200 and 'data-mft-clinician="autumn"' in r.text() and 'clinicianId=2183370' in r.text():break
                if attempt==17:raise AssertionError('Autumn calendar update is not present in production')
                time.sleep(10)
            request.dispose()
        for width,js in [(1440,True),(390,True),(320,True),(390,False)]:
            context=browser.new_context(viewport={'width':width,'height':960},java_script_enabled=js,reduced_motion='reduce')
            context.route('**/*',guard)
            context.add_init_script("try { localStorage.setItem('mft.analytics.consent.v2','denied'); } catch {}")
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            for route in ROUTES:
                response=page.goto(base+route,wait_until='domcontentloaded',timeout=30000)
                assert response.status==200,(route,response.status)
                page.locator('a[data-mft-clinician="autumn"]').first.wait_for(state='attached')
                assert page.locator('h1').count()==1 and page.locator('main').count()==1,route
                if js:assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),(route,width,'overflow')
                links=page.locator('a[data-mft-clinician="autumn"]')
                for a in links.all():
                    assert valid(a.get_attribute('href')),(route,a.get_attribute('href'))
                    assert a.get_attribute('data-spwidget-clinician-id')=='2183370'
                    assert a.get_attribute('target') in (None,'','_self')
                    assert a.locator('xpath=ancestor::a').count()==0,'Nested anchor'
                a=links.first;a.scroll_into_view_if_needed();a.focus()
                if js:assert a.evaluate('(el)=>el===document.activeElement')
                assert 'Ask about appointments with Autumn' not in page.locator('body').inner_text()
                report['checks'].append({'route':route,'width':width,'javascript':js,'analytics':'declined and blocked','calendarLinks':links.count(),'pass':True})
                if js and width in (1440,390) and route in ('/autumn-alexander/','/team/'):
                    page.screenshot(path=str(OUT/(('production-' if args.production else 'built-')+route.strip('/')+'-'+str(width)+'.png')),full_page=True)
            assert not errors,errors
            context.close()
        context=browser.new_context(viewport={'width':390,'height':960});context.route('**/*',guard)
        context.add_init_script("Object.defineProperty(navigator,'globalPrivacyControl',{value:true});")
        page=context.new_page();page.goto(base+'/autumn-alexander/',wait_until='domcontentloaded')
        assert valid(page.locator('a[data-mft-clinician="autumn"]').first.get_attribute('href'))
        report['checks'].append({'route':'/autumn-alexander/','privacy':'GPC enabled, analytics blocked','pass':True});context.close()
        if args.scheduler:
            for width,route in [(1440,'/autumn-alexander/'),(390,'/team/')]:
                context=browser.new_context(viewport={'width':width,'height':960},reduced_motion='reduce');context.route('**/*',guard)
                context.add_init_script("try { localStorage.setItem('mft.analytics.consent.v2','denied'); } catch {}")
                page=context.new_page();page.set_default_timeout(25000)
                page.goto(base+route,wait_until='domcontentloaded')
                a=page.locator('a[data-mft-clinician="autumn"]').first;assert valid(a.get_attribute('href'))
                a.focus();page.keyboard.press('Enter')
                page.wait_for_url(re.compile(r'^https://(?:spwidget-)?marriagefamilytherapy\.clientsecure\.me/'))
                page.get_by_text('Autumn Alexander',exact=True).first.wait_for(state='visible')
                text=page.locator('body').inner_text();assert re.search(r'request an appointment',text,re.I)
                assert parse_qs(urlsplit(page.url).query).get('clinicianId')==['2183370']
                assert len(context.pages)==1,'Unexpected popup'
                page.screenshot(path=str(OUT/('simplepractice-'+str(width)+'.png')))
                report['scheduler'].append({'from':route,'width':width,'destinationHost':urlsplit(page.url).hostname,'clinicianId':'2183370','displayName':'Autumn Alexander','sameTab':True,'readOnly':True,'pass':True})
                context.close()
        browser.close()
    report['pass']=True
except Exception as error:
    report['error']=str(error)
    raise
finally:
    report['checkedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    (OUT/('production-result.json' if args.production else 'built-result.json')).write_text(json.dumps(report,indent=2))
    if server:server.shutdown()
    print(json.dumps({'environment':report['environment'],'checks':len(report['checks']),'scheduler':len(report['scheduler']),'pass':report['pass']}))
