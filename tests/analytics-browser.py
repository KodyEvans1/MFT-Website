"""GA4 release verification. Candidate hits are intercepted; live sends one consented homepage view only."""
import hashlib, json, mimetypes, os, re, time
from urllib.request import Request, urlopen
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/analytics-browser';OUT.mkdir(parents=True,exist_ok=True)
BASE='https://www.mft.care';MID='G-BTK39BBNRE';LIVE=os.getenv('MFT_ANALYTICS_LIVE')=='true'
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
report={'pass':False,'live':LIVE,'checks':[],'hits':[],'deliveries':[],'console':[],'failures':[], 'scope':'Public website traffic only. Test hits intercepted; only one actual consented live-homepage visit may be sent. No appointments or client information.'}
fixture=os.getenv('MFT_GTAG_FIXTURE')
current_case=''; google_requests=[]; hits=[]; send_live=False

def decode_hit(req):
    q=parse_qs(urlsplit(req.url).query,keep_blank_values=True)
    raw=req.post_data or ''
    records=[]
    for line in raw.splitlines() or ['']:
        records.append({**q,**parse_qs(line,keep_blank_values=True)})
    return records

def check_hit(data):
    assert data.get('tid')==[MID],('wrong property',data)
    assert data.get('en',[''])[0] in ['page_view','user_engagement','session_start','first_visit'],('unapproved event',data.get('en'))
    assert re.fullmatch(r'https://www\.mft\.care/p/[a-f0-9]{16}/',data.get('dl',[''])[0]),('raw location',data.get('dl'))
    assert data.get('dt')==['M.F.T. Public Website']
    assert data.get('dr',[''])[0] in ['', 'https://www.google.com/','https://www.bing.com/','https://google.com/','https://bing.com/']
    joined=unquote(json.dumps(data)).lower()
    for forbidden in ['test-private','example.invalid','clinicianid','check-my-coverage','user_id','search_term','link_url','form_destination','ep.user_data','up.','email','phone_number']:
        assert forbidden not in joined,('sensitive parameter',forbidden)
    assert data.get('npa')==['1'],('personalization not disabled',data.get('npa'))

def guard(route):
    req=route.request;u=urlsplit(req.url)
    if u.hostname=='www.mft.care':
        if LIVE: route.continue_();return
        f=ROOT/'dist'/u.path.lstrip('/')
        if u.path.endswith('/') or not f.suffix:f=f/'index.html'
        if not f.is_file():route.fulfill(status=404,body='Not found');return
        route.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':mimetypes.guess_type(str(f))[0] or 'application/octet-stream','Content-Security-Policy':CSP,'Referrer-Policy':'no-referrer'})
    elif u.hostname=='www.googletagmanager.com' and u.path=='/gtag/js':
        google_requests.append(req.url)
        assert parse_qs(u.query).get('id')==[MID]
        assert not req.headers.get('referer'),('Google loader referrer',req.headers.get('referer'))
        if fixture:route.fulfill(status=200,content_type='text/javascript',body=Path(fixture).read_bytes())
        else:route.continue_()
    elif u.hostname in ['www.google-analytics.com','region1.google-analytics.com'] and u.path.endswith('/collect'):
        for data in decode_hit(req):
            check_hit(data);hits.append(data)
            report['hits'].append({'case':current_case,'event':data.get('en'),'measurementId':data.get('tid'),'page':data.get('dl'),'personalization':data.get('npa')})
        if send_live:
            response=route.fetch();report['deliveries'].append({'status':response.status,'host':u.hostname,'path':u.path});route.fulfill(response=response)
        else:route.fulfill(status=204,body='')
    else:route.abort()

def wait_hit(page):
    for _ in range(80):
        page.wait_for_timeout(100)
        if any(h.get('en')==['page_view'] for h in hits):return
    report['frameState']=[f.evaluate("""() => ({url:location.href, scripts:[...document.scripts].map(s=>s.src), ready:document.readyState, dataLayer:window.dataLayer ? [...window.dataLayer].map(v=>Array.from(v)) : null})""") for f in page.frames]
    report['googleLoaderRequests']=len(google_requests)
    raise AssertionError('No GA4 page_view observed')

def observe(page):
    page.on('pageerror',lambda error:report['console'].append(str(error)))
    page.on('console',lambda message:report['console'].append(message.text[:1200]) if message.type=='error' else None)
    page.on('requestfailed',lambda request:report['failures'].append({'host':urlsplit(request.url).hostname,'path':urlsplit(request.url).path,'error':request.failure}))

def context(browser,**kwargs):
    c=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',**kwargs);c.route('**/*',guard);c.on('page',observe);return c

def record(label):report['checks'].append({'name':label,'pass':True})

try:
    if LIVE:
        version=hashlib.sha256((ROOT/'src/assets/mft-analytics.js').read_bytes()).hexdigest()[:16]
        deadline=time.monotonic()+180
        while True:
            try:
                with urlopen(Request(BASE+'/',headers={'Cache-Control':'no-cache'}),timeout=20) as response:
                    html=response.read().decode();headers=dict(response.headers)
                assert '/assets/mft-analytics.js?v='+version in html
                with urlopen(BASE+'/assets/mft-analytics.js?v='+version,timeout=20) as response:
                    assert response.read()==(ROOT/'src/assets/mft-analytics.js').read_bytes()
                report['matchingPublishedAssets']=True
                report['assetVersion']=version
                break
            except Exception:
                if time.monotonic()>=deadline:raise
                time.sleep(6)
    with sync_playwright() as p:
        options={'headless':True}
        if os.getenv('MFT_CHROMIUM'):options['executable_path']=os.environ['MFT_CHROMIUM']
        browser=p.chromium.launch(**options)
        c=context(browser);page=c.new_page();current_case='initial-consent'
        page.goto(BASE+'/?q=test-private&email=test-private%40example.invalid#test-private',wait_until='domcontentloaded')
        page.wait_for_timeout(1800)
        assert not google_requests and not hits,'Google contacted before consent'
        assert page.locator('#mft-analytics-consent').is_visible()
        assert not any(x['name'].startswith('mftga') for x in c.cookies())
        record('No Google requests or analytics cookies before consent')
        page.locator('[data-choice="deny"]').click();page.wait_for_timeout(300)
        assert not google_requests and not hits
        page.reload(wait_until='domcontentloaded');page.wait_for_timeout(300)
        assert page.locator('#mft-analytics-consent').count()==0 and not google_requests
        record('Decline persists and sends nothing')
        page.locator('.mft-analytics-settings').click();page.locator('[data-choice="grant"]').click();wait_hit(page)
        assert len([h for h in hits if h.get('en')==['page_view']])==1
        assert len(google_requests)==1
        assert page.locator('#mft-analytics-consent').count()==0
        record('One sanitized page_view with correct ID after consent')
        page.evaluate('''() => {const form=document.createElement('form');form.id='test-private';form.innerHTML='<input name="email" value="test-private@example.invalid"><button>Test</button>';form.addEventListener('submit',e=>e.preventDefault());document.body.append(form);form.querySelector('input').dispatchEvent(new Event('change',{bubbles:true}));form.dispatchEvent(new Event('submit',{bubbles:true}));history.pushState({},'', '?q=test-private&email=test-private%40example.invalid');window.scrollTo(0,document.body.scrollHeight);const a=document.createElement('a');a.href='https://example.invalid/test-private';a.textContent='Test';a.addEventListener('click',e=>e.preventDefault());document.body.append(a);a.click();}''')
        page.wait_for_timeout(1800)
        assert not any(h.get('en',[''])[0] in ['form_start','form_submit','click','scroll','view_search_results'] for h in hits)
        record('No form, click, search or scroll events from the parent document')
        page.evaluate("document.querySelector('#test-private').remove()")
        cookies=[x for x in c.cookies() if x['name'].startswith('mftga')]
        assert cookies and all(x['domain']=='www.mft.care' for x in cookies),('cookies not host-only',cookies)
        record('Analytics cookies stay on public hostname, not Ops')
        page.locator('.mft-analytics-settings').click();before=len(hits);page.locator('[data-choice="deny"]').click();page.wait_for_timeout(500)
        assert page.locator('iframe[title="Optional website traffic measurement"]').count()==0
        assert not any(x['name'].startswith('mftga') for x in c.cookies())
        assert len(hits)==before
        record('Revocation removes the counter and analytics cookies')
        c.close()
        for signal in ['globalPrivacyControl','doNotTrack']:
            google_requests.clear();hits.clear();current_case=signal;c=context(browser)
            value='true' if signal=='globalPrivacyControl' else "'1'"
            c.add_init_script(f"Object.defineProperty(Navigator.prototype,'{signal}',{{get:()=>{value}}});localStorage.setItem('mft.analytics.consent.v2','granted');")
            page=c.new_page();page.goto(BASE+'/',wait_until='domcontentloaded');page.wait_for_timeout(600)
            assert not google_requests and not hits;record(signal+' overrides stored consent');c.close()
        for path in ['/check-my-coverage/','/marriage-reset-assessment/','/start/','/marriagereset/']:
            google_requests.clear();hits.clear();current_case=path;c=context(browser);c.add_init_script("localStorage.setItem('mft.analytics.consent.v2','granted')")
            page=c.new_page();page.goto(BASE+path,wait_until='domcontentloaded');page.wait_for_timeout(250)
            assert page.locator('script[data-mft-measurement-id]').count()==0
            assert not google_requests and not hits;record('Excluded '+path);c.close()
        google_requests.clear();hits.clear();current_case='mobile';c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');c.route('**/*',guard)
        page=c.new_page();page.goto(BASE+'/',wait_until='domcontentloaded');page.screenshot(path=str(OUT/'consent-mobile.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.locator('[data-choice="deny"]').click();page.locator('.mh-hero a[data-mft-booking]').click()
        gate=page.locator('.mft-consultation-gate');assert gate.is_visible();gate.locator('input[type="checkbox"]').check()
        assert gate.locator('[data-consultation-continue]').get_attribute('href')=='https://marriagefamilytherapy.clientsecure.me/request'
        assert not google_requests;record('Mobile layout and scheduling unchanged after decline');c.close()
        if LIVE:
            current_case='live-consented-homepage';google_requests.clear();hits.clear();send_live=True
            c=context(browser);page=c.new_page();page.goto(BASE+'/',wait_until='domcontentloaded')
            page.locator('[data-choice="grant"]').click();wait_hit(page);page.wait_for_timeout(1200)
            assert report['deliveries'] and all(200<=d['status']<300 for d in report['deliveries'])
            page.locator('.mft-analytics-settings').click();page.locator('[data-choice="deny"]').click()
            record('Google collector accepted the real consented homepage view');c.close()
        browser.close()
    report['pass']=True
except Exception as error:
    report['error']=str(error)
    try:
        report['frameState']=[f.evaluate("""() => ({url:location.protocol+'//'+location.host+location.pathname, scripts:[...document.scripts].map(s=>s.src), ready:document.readyState, dataLayer:window.dataLayer ? [...window.dataLayer].map(v=>Array.from(v)) : null})""") for f in page.frames]
        report['googleLoaderRequests']=len(google_requests)
        page.screenshot(path=str(OUT/'failure.png'))
    except Exception as e:report['captureError']=str(e)
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
