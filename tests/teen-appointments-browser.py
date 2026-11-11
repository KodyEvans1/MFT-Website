"""Teen website acceptance. Read-only scheduler navigation; never select a slot or enter client data."""
import base64, functools, hashlib, json, mimetypes, os, re, shutil, threading, time
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/teen-appointments';OUT.mkdir(parents=True,exist_ok=True)
MODE=os.getenv('MFT_TEEN_MODE','local')
BASE=os.getenv('MFT_BASE_URL','').rstrip('/')
DIST=ROOT/'dist'; CONFIG=json.loads((ROOT/'content/simplepractice-booking.json').read_text())
PEOPLE=[c for c in CONFIG['clinicians'] if c['key'] in ['emily','gary','sonia']]
REPORT={'mode':MODE,'pass':False,'checks':[],'blockedWrites':[],'externalAnalyticsBlocked':0,'appointmentSubmissions':0,
        'scope':'Website only. No slot selection, client details, authentication, campaign or Ops changes. Clicks are not bookings.'}
server=None
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(DIST/'_headers').read_text())[1]
def record(name,**values): REPORT['checks'].append({'name':name,'pass':True,**values})
def destination(c=None):
    if c is None:return CONFIG['generalUrl']+'/request'
    # Read the approved generated URL, rather than constructing scheduler parameters.
    html=(DIST/'teen-counseling/index.html').read_text()
    tag=re.search(r'<a\b[^>]*data-teen-clinician="'+c['key']+r'"[^>]*>',html)[0]
    return re.search(r'href="([^"]+)"',tag)[1].replace('&amp;','&')
def guard(route):
    q=route.request;u=urlsplit(q.url);host=u.hostname or ''
    if any(s in host for s in ['googletagmanager','google-analytics','doubleclick','facebook','segment','sentry','bugsnag']):
        REPORT['externalAnalyticsBlocked']+=1;route.abort();return
    read_slots=q.method=='POST' and host in ['marriagefamilytherapy.clientsecure.me','spwidget-marriagefamilytherapy.clientsecure.me'] and u.path=='/client-portal-api/clinician-search/next-slots'
    if q.method not in ['GET','HEAD'] and not read_slots:
        REPORT['blockedWrites'].append({'method':q.method,'host':host,'path':u.path});route.abort();return
    route.continue_()
def offline_html():
    html=(DIST/'teen-counseling/index.html').read_text()
    def style(m):
        f=DIST/urlsplit(m[1]).path.lstrip('/')
        return '<style>'+f.read_text()+'</style>'
    html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>',style,html)
    def script(m):
        f=DIST/urlsplit(m[1]).path.lstrip('/')
        return '<script>'+f.read_text().replace('</script','<\\/script')+'</script>' if f.is_file() else ''
    html=re.sub(r'<script\b[^>]*src="(/assets/[^"]+)"[^>]*>\s*</script>',script,html)
    def image(m):
        f=DIST/urlsplit(m[1]).path.lstrip('/')
        if not f.is_file():return m[0]
        return 'src="data:'+(mimetypes.guess_type(str(f))[0] or 'application/octet-stream')+';base64,'+base64.b64encode(f.read_bytes()).decode()+'"'
    return re.sub(r'src="(/assets/[^"]+)"',image,html)
def ready(page):
    if MODE=='offline':
        page.goto('about:blank');page.set_content(offline_html(),wait_until='domcontentloaded')
    else:
        r=page.goto(BASE+'/teen-counseling/',wait_until='domcontentloaded');assert r.status==200
    page.locator('[data-teen-primary]').wait_for();page.wait_for_timeout(150)
def public_inspection():
    data={'environment':'fresh public HTTP read; no authentication','observedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
    for name,url in [('production','https://www.mft.care/teen-counseling/'),('scheduler',CONFIG['generalUrl']+'/request/clinician-search')]:
        try:
            with urlopen(Request(url,headers={'Cache-Control':'no-cache'}),timeout=25) as response:
                raw=response.read();text=raw.decode();data[name]={'status':response.status,'finalUrl':response.url,'date':response.headers.get('Date'),'sha256':hashlib.sha256(raw).hexdigest()}
            if name=='production':data[name].update({'teenRevisionPresent':'data-teen-appointment-pathway="1"' in text,'couplesShortcuts':'data-mft-couples-consultation' in text,'clinicalReviewNotice':'has not received clinical publication approval' in text,'h1':re.sub('<[^>]+>','',re.search(r'<h1[^>]*>([\s\S]*?)</h1>',text)[1])})
            else:data[name]['listedNames']=[c['name'] for c in PEOPLE if c['name'] in text]
        except Exception as exc:data[name]={'error':str(exc)}
    (OUT/'production-inspection.json').write_text(json.dumps(data,indent=2));REPORT['publicInspection']=data

def hosted_revision():
    expected=os.getenv('MFT_EXPECTED_SHA');deadline=time.monotonic()+180
    while True:
        try:
            with urlopen(Request(BASE+'/teen-counseling/',headers={'Cache-Control':'no-cache'}),timeout=20) as r:html=r.read().decode();assert r.status==200
            assert 'data-teen-appointment-pathway="1"' in html,'Hosted preview does not yet contain teen changes'
            assert 'noindex' in html,'Review preview must stay noindex'
            stylesheet=re.search(r'href="(/assets/teen-appointments-[a-f0-9]+\.css)"',html)[1]
            with urlopen(BASE+stylesheet,timeout=20) as r:assert r.read()==(ROOT/'src/assets/teen-appointments.css').read_bytes()
            with urlopen(BASE+'/reports/review-build.json',timeout=20) as r:build=json.load(r)
            if expected:assert build['commit']==expected,('Wrong preview commit',build['commit'])
            REPORT['previewCommit']=build['commit'];record('Hosted preview revision and CSS match',commit=build['commit']);return
        except HTTPError as exc:
            if exc.code in (401,403):
                REPORT["previewAccess"]={"status":exc.code,"reason":"Authentication required; protection unchanged"};raise
            if time.monotonic()>=deadline:raise
            time.sleep(6)
        except Exception:
            if time.monotonic()>=deadline:raise
            time.sleep(6)

def synthetic_privacy(browser):
    # Exact existing consent controller in an intercepted production-origin fixture.
    # This does not change deployment flags or send Google hits.
    body=(DIST/'teen-counseling/index.html').read_text()
    frame_version=hashlib.sha256((ROOT/'src/assets/mft-ga4-frame.js').read_bytes()+(ROOT/'src/assets/mft-ga4-frame.html').read_bytes()).hexdigest()[:16]
    tag='<script src="/assets/mft-analytics.js" defer data-mft-measurement-id="G-BTK39BBNRE" data-mft-page-key="'+hashlib.sha256(b'/teen-counseling/').hexdigest()[:16]+'" data-mft-frame-version="'+frame_version+'"></script>'
    body=body.replace('</body>',tag+'</body>')
    for case in ['declined','blocked','gpc','no-javascript']:
        c=browser.new_context(java_script_enabled=case!='no-javascript',viewport={'width':390,'height':844})
        hits=[];departures=[]
        if case=='gpc':c.add_init_script("Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true});")
        def fixture(route):
            q=route.request;u=urlsplit(q.url)
            if 'google' in (u.hostname or '') or 'doubleclick' in (u.hostname or ''):hits.append(u.hostname);route.abort();return
            if q.resource_type=='document' and u.hostname in ['clientsecure.me','marriagefamilytherapy.clientsecure.me']:
                departures.append(q.url);route.fulfill(status=200,content_type='text/html',body='<h1>Intercepted scheduling handoff</h1>');return
            if u.hostname=='www.mft.care':
                if case=='blocked' and 'mft-analytics' in u.path:route.abort();return
                f=DIST/u.path.lstrip('/')
                if u.path=='/teen-counseling/':route.fulfill(status=200,content_type='text/html',body=body);return
                if f.is_file():route.fulfill(status=200,content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream',body=f.read_bytes());return
            route.abort()
        c.route('**/*',fixture);page=c.new_page()
        page.goto('https://www.mft.care/teen-counseling/',wait_until='domcontentloaded')
        if case=='declined':page.locator('[data-choice="deny"]').click();assert page.evaluate('MFTAnalyticsConsent.status()')=='denied'
        if case=='gpc':assert page.evaluate('MFTAnalyticsConsent.status()')=='denied'
        page.locator('[data-teen-primary]').click();page.get_by_role('heading',name='Intercepted scheduling handoff').wait_for()
        assert departures==[destination()];assert not hits,(case,hits)
        if case=='no-javascript':
            page.goto('https://www.mft.care/teen-counseling/');a=page.locator('[data-teen-clinician="sonia"]');assert a.get_attribute('href')==destination(next(p for p in PEOPLE if p['key']=='sonia'));a.click();assert len(departures)==2
        record('Synthetic scheduling works independently of analytics',condition=case,googleRequests=len(hits),confirmedBookings=0);c.close()

def actual_handoff(page,selector,clinician=None):
    ready(page);a=page.locator(selector).first;expected=a.get_attribute('href');a.click()
    page.wait_for_url(re.compile(r'^https://(?:spwidget-)?marriagefamilytherapy\.clientsecure\.me/'),timeout=30000)
    page.get_by_text('Request an appointment',exact=True).first.wait_for(timeout=30000)
    if clinician:
        page.get_by_text(clinician['name'],exact=True).first.wait_for(timeout=30000)
        assert parse_qs(urlsplit(page.url).query).get('clinicianId')==[clinician['id']]
    else:page.get_by_text('Emily Johnsrud',exact=True).first.wait_for(timeout=30000)
    text=page.locator('body').inner_text()
    record('Actual public SimplePractice destination loaded',selector=selector,clinician=clinician['key'] if clinician else None,host=urlsplit(page.url).hostname,path=urlsplit(page.url).path,sameTab=True,diagnosticEvaluationVisible=bool(re.search(r'90791|diagnostic|initial.*(?:assessment|evaluation)',text,re.I)))
    if clinician:
        REPORT.setdefault('publicServiceEvidence',[]).append({'clinician':clinician['key'],'lines':[line for line in text.splitlines() if re.search(r'90791|diagnostic|consult|therapy|telehealth|in person',line,re.I)][:30]})
    return text

try:
    if MODE in ['hosted','handoff']:public_inspection()
    if MODE=='hosted':hosted_revision()
    if MODE in ['local','handoff']:
        class Quiet(SimpleHTTPRequestHandler):
            def log_message(self,*args):pass
        server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(DIST)))
        threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
    with sync_playwright() as p:
        executable=os.getenv('MFT_CHROMIUM') or shutil.which('google-chrome') or shutil.which('chromium')
        browser=p.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
        c=browser.new_context(reduced_motion='reduce');c.route('**/*',(lambda r:r.abort()) if MODE=='offline' else guard)
        page=c.new_page();page.set_default_timeout(12000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        for width in [1440,1024,768,390,320]:
            page.set_viewport_size({'width':width,'height':950 if width>760 else 844});ready(page)
            assert page.locator('h1').count()==1 and page.locator('main').count()==1
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
            assert page.locator('[data-teen-clinician]').count()==3
            assert page.locator('[data-mft-couples-consultation]').count()==0
            assert page.locator('[data-teen-primary]').get_attribute('href')==destination()
            for person in PEOPLE:assert page.locator('[data-teen-clinician="'+person['key']+'"]').get_attribute('href')==destination(person)
            button=page.locator('[data-teen-primary]');button.focus();assert button.evaluate('(a)=>a===document.activeElement')
            page.wait_for_function("document.querySelector('header img')?.complete && document.querySelector('header img').naturalWidth > 0")
            record('Responsive structure and approved links',width=width,primaryButtonTop=round(button.bounding_box()['y']))
            if width in [1440,390,320]:page.screenshot(path=str(OUT/('teen-'+str(width)+'-top.png')));page.screenshot(path=str(OUT/('teen-'+str(width)+'.png')),full_page=True)
        ready(page);menu=page.locator('.menu-button');menu.focus();menu.press('Enter');assert menu.get_attribute('aria-expanded')=='true';menu.press('Enter');assert menu.get_attribute('aria-expanded')=='false';record('Mobile menu keyboard toggle')
        faq=page.locator('#questions details').first;summary=faq.locator('summary');summary.focus();summary.press('Enter');assert faq.get_attribute('open') is not None;summary.press('Space');assert faq.get_attribute('open') is None;record('FAQ keyboard toggle')
        ten=page.locator('[data-teen-ten-minute]');ten.focus();ten.press('Enter');dialog=page.locator('.mft-consultation-gate');expect(dialog).to_be_visible()
        go=dialog.locator('[data-consultation-continue]');assert go.get_attribute('href') is None
        page.keyboard.press('Escape');expect(dialog).not_to_be_visible();assert ten.evaluate('(a)=>a===document.activeElement');ten.press('Enter');dialog.locator('input').check();assert go.get_attribute('href')==destination();dialog.get_by_role('button',name='Cancel',exact=True).click();record('Optional introduction: acknowledgement, Escape, cancel and focus return')
        assert not errors,errors
        if MODE in ['local','hosted']:synthetic_privacy(browser)
        if MODE in ['hosted','handoff']:
            for width in [1440,390]:
                page.set_viewport_size({'width':width,'height':950});actual_handoff(page,'[data-teen-primary]')
                for person in PEOPLE:actual_handoff(page,'[data-teen-clinician="'+person['key']+'"]',person)
            actual_handoff(page,'[data-teen-paid-consultation]')
            ready(page);page.locator('[data-teen-ten-minute]').click();page.locator('.mft-consultation-gate input').check();page.locator('[data-consultation-continue]').click();page.get_by_text('Request an appointment',exact=True).first.wait_for();record('Actual optional phone consultation handoff')
            ready(page);page.locator('.mft-teen-existing').click();page.wait_for_url(re.compile('/sign-in'));page.locator('input[type="email"]').wait_for();record('Actual returning-client sign-in route; no login attempted')
            assert len(c.pages)==1
        REPORT['pass']=True;browser.close()
except Exception as exc:
    REPORT['error']=str(exc)
    try:page.screenshot(path=str(OUT/'failure.png'),full_page=True)
    except Exception:pass
    raise
finally:
    (OUT/('result-'+MODE+'.json')).write_text(json.dumps(REPORT,indent=2));print(json.dumps(REPORT,indent=2))
    if server:server.shutdown()
