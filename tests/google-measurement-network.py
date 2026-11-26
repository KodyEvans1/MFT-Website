"""Real Google tag probe in a browser with every request intercepted and DNS denied.

The public tag is downloaded once with a credential-free, read-only GET unless
an explicit temporary bundle path and matching download metadata are supplied.
The fixture's approval digest is synthetic and never changes repository policy.
No request from the browser can reach Google, Ops, or SimplePractice. A green
probe is not Google Ads attribution or approval to activate sensitive measurement.
"""
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, parse_qsl, unquote, urlencode, urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/google-measurement-network'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.mft.care'
ID = 'G-BTK39BBNRE'
TAG_CANONICAL_CONTAINER_ID = '267080605'
VENDOR_URL = 'https://www.googletagmanager.com/gtag/js?id=' + ID
VENDOR = None
VENDOR_METADATA = None
REVIEW = 'a' * 64
AD_CHOICE = 'mft.advertising.consent.v2'
GOOGLE_SOURCE = 'mft.google.source.v1'
SYNTHETIC_CLICK = 'SYNTHETIC_GCLID_20261126_TEST_ONLY'
PRIVATE_CANARY = 'SYNTHETIC_PRIVATE_VALUE_NEVER_EXPORT'
FLOW = json.loads((ROOT / 'content/google-measurement-flow.json').read_text())
PUBLIC_TITLES = FLOW['reviewedDocumentTitles']
GA4_HOSTS = ('analytics.google.com', 'www.google-analytics.com', 'region1.google-analytics.com', 'www.google.com')
AUTOMATIC_EVENTS = set(FLOW['standardRuntimeEvents'])
OPS = 'https://ops.mft.care/api/marketing/attribution'
# A permissive isolated fixture exposes unexpected vendor destinations to the
# interceptor. Production remains Google-denied; this is not its CSP.
PROBE_CSP = "default-src 'self'; script-src 'self' https://www.googletagmanager.com; connect-src https:; img-src https: data:; frame-src https:; style-src 'self' 'unsafe-inline'"
REVIEWED_CSP = subprocess.check_output(['node','-e',"const fs=require('fs'),c=require('./src/google-measurement-csp');console.log(c.headerPolicy(c.permitGoogle(c.removeGooglePermission(fs.readFileSync('dist/_headers','utf8'))).headers));"],cwd=ROOT,text=True).strip()
GOOGLE_HOSTS = ('googletagmanager.com', 'google-analytics.com', 'google.com', 'googleadservices.com',
                'googlesyndication.com', 'doubleclick.net', 'gstatic.com', 'googleapis.com', 'googleusercontent.com')
spec = importlib.util.spec_from_file_location('google_probe_harness', ROOT / 'tests/scheduling-browser-harness.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)

report = {'pass': False, 'scope': 'Synthetic approved main-page fixture only. Browser-level interception and DNS denial; no external event delivery, production approval, Ops receipt, appointment or Ads credit.',
          'fixtureReview': REVIEW, 'checks': [], 'cases': [], 'blockers': [], 'googleRequests': []}
requests = []
ops_requests = []
destinations = []
case = 'initialization'
fixture_options = {}
interceptor = None
browser_errors = []


def prepare_vendor():
    """No analytics calls, credentials, cookies, or browser requests are used."""
    explicit = os.environ.get('MFT_GOOGLE_VENDOR_JS')
    if explicit:
        path = Path(explicit)
        metadata_path = path.with_name('gtag-metadata.json')
        assert path.is_file(), 'Explicit MFT_GOOGLE_VENDOR_JS does not exist'
        assert metadata_path.is_file(), 'Explicit vendor bundle needs gtag-metadata.json'
        return path, metadata_path

    class SamePublicTagRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            target = urlsplit(newurl)
            assert target.scheme == 'https' and target.hostname == 'www.googletagmanager.com'
            assert target.path == '/gtag/js' and parse_qs(target.query) == {'id': [ID]}
            assert not target.username and not target.password
            return super().redirect_request(req, fp, code, msg, headers, newurl)

    destination = Path(tempfile.mkdtemp(prefix='mft-google-vendor-'))
    path = destination / ('gtag-' + ID + '.js')
    metadata_path = destination / 'gtag-metadata.json'
    opener = urllib.request.build_opener(SamePublicTagRedirect())
    with opener.open(urllib.request.Request(VENDOR_URL, method='GET'), timeout=30) as response:
        assert response.status == 200, 'Public Google tag download failed'
        data = response.read(2_000_001)
        assert len(data) <= 2_000_000, 'Public Google tag exceeds the download size limit'
        content_type = response.headers.get('Content-Type', '')
        assert 'javascript' in content_type, 'Public Google tag is not JavaScript'
    path.write_bytes(data)
    metadata_path.write_text(json.dumps({
        'downloadedAtUtc': datetime.now(timezone.utc).isoformat(), 'source': VENDOR_URL,
        'method': 'GET', 'status': 200, 'contentType': content_type, 'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(),
        'scope': 'Public vendor JavaScript only. No cookies, credentials, event calls, advertising clicks or patient data.'
    }, indent=2) + '\n')
    return path, metadata_path


def is_google(host):
    return any(host == item or host.endswith('.'+item) for item in GOOGLE_HOSTS) or bool(re.search(r'(^|\.)google\.[a-z.]+$', host))


def decoded(value):
    for _ in range(3):
        value = unquote(value)
    return value


def parse_request(request):
    parsed = urlsplit(request.url)
    base = dict(parse_qsl(parsed.query, keep_blank_values=True))
    bodies = (request.post_data or '').splitlines() or ['']
    rows = []
    for body in bodies:
        params = dict(base)
        params.update(parse_qsl(body, keep_blank_values=True))
        rows.append(params)
    return {'case': case, 'url': request.url, 'body': request.post_data or '', 'headers': request.headers,
            'method': request.method, 'host': parsed.hostname, 'path': parsed.path,
            'resourceType': request.resource_type, 'rows': rows}


def summarized(item):
    rows = item['rows']
    metadata = []
    for row in rows:
        entry = {key: row[key] for key in ('en', 'tid', 'gcs', 'gcd', 'npa', 'dma', 'pscdl') if key in row}
        for key in ('dl', 'page_location', 'url'):
            if key in row:
                url = urlsplit(row[key])
                entry[key] = {'origin': url.scheme+'://'+url.netloc, 'path': url.path,
                              'queryKeys': sorted(parse_qs(url.query)), 'hasSyntheticClick': SYNTHETIC_CLICK in row[key]}
        for key in ('dt', 'page_title', 'dr', 'page_referrer', 'tiba'):
            if key in row:
                entry[key] = row[key] if row[key] in ('', 'M.F.T. Public Website', *PUBLIC_TITLES.values()) else 'UNEXPECTED_VALUE'
        entry['automaticMarkers'] = {key: row[key] for key in ('_fv', '_ss', '_ee', 'seg') if key in row}
        if item['host']=='www.googletagmanager.com' and item['path']=='/a' and row.get('t')=='l':
            # These are tag configuration identifiers in the v=3,t=l variant,
            # not the unrelated visitor cid used by the GA4 collector.
            entry['loadDiagnostic'] = {
                'scriptContainerId': row.get('cid') if row.get('cid')==ID else 'UNEXPECTED_VALUE',
                'canonicalContainerId': row.get('ccid') if row.get('ccid')==TAG_CANONICAL_CONTAINER_ID else 'UNEXPECTED_VALUE',
                'summaryCharacters': len(row.get('l','')),
            }
        metadata.append(entry)
    return {key: item[key] for key in ('case','method','host','path','resourceType')} | {
        'fieldNames': sorted({key for row in rows for key in row}), 'metadata': metadata,
        'httpReferrerPresent': bool(item['headers'].get('referer')),
        'requestHeaderNames': sorted(item['headers']),
        'cookieHeaderNames': sorted(part.split('=')[0].strip() for part in item['headers'].get('cookie','').split(';') if part.strip()),
        'privateCanaryPresent': PRIVATE_CANARY in decoded(item['url']+'\n'+item['body']+'\n'+str(item['headers']))}


def fixture_html(path):
    approved = path in ('/', '/about/') and not fixture_options.get('no_approval')
    google = ''
    if approved or fixture_options.get('force_module'):
        configured_route = path if approved else '/'
        google = '<script src="/assets/mft-google-measurement.js" defer data-mft-google-mode="approved-main-page" data-mft-google-measurement-id="'+ID+'" data-mft-google-route="'+configured_route+'" data-mft-google-event="simplepractice_exit" data-mft-google-approved-review="'+REVIEW+'"></script>'
    controller = ''
    if fixture_options.get('controller'):
        key = hashlib.sha256(path.encode()).hexdigest()[:16]
        controller = '<script src="/assets/mft-analytics.js" defer data-mft-measurement-controller="first-party" data-mft-page-key="'+key+'" data-mft-handoff-endpoint="'+OPS+'"></script>'
    stale = '<script src="/assets/mft-ga4-bootstrap.js" defer></script>' if fixture_options.get('legacy_helper') else ''
    booking = ''.join('<script defer src="/assets/'+name+'"></script>' for name in ('mft-booking-core.js','mft-booking-config.js','mft-booking.js')) if fixture_options.get('booking') else ''
    clinician = json.loads((ROOT/'content/simplepractice-booking.json').read_text())['clinicians'][0]['key']
    title = PRIVATE_CANARY if fixture_options.get('private_title') else PUBLIC_TITLES.get(path, 'Excluded public page')
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>'+title+'</title><style>body{min-height:200vh}a{display:block;margin:2rem}dialog{max-width:40rem}</style>'+stale+google+controller+booking+'</head><body><h1>'+PRIVATE_CANARY+'</h1><a id="internal" href="/about/">About</a><a id="scheduler" href="https://marriagefamilytherapy.clientsecure.me/request">Request an appointment</a><a id="clinician" data-mft-clinician="'+clinician+'" href="https://marriagefamilytherapy.clientsecure.me/request">Schedule appointment</a><a id="existing" data-mft-existing-client="true" href="https://marriagefamilytherapy.clientsecure.me/">Existing client sign-in</a><footer></footer></body></html>'


INERT_CASE_PATH = '/__measurement_probe_teardown__/'


def guard(route):
    request = route.request
    url = urlsplit(request.url)
    if is_google(url.hostname or ''):
        item = parse_request(request)
        item['probePhase'] = fixture_options.get('_probe_phase', 'exercise')
        requests.append(item)
        try:
            if url.hostname == 'www.googletagmanager.com' and url.path == '/gtag/js' and parse_qs(url.query).get('id') == [ID]:
                if fixture_options.get('vendor_blocked'):
                    route.abort()
                elif fixture_options.get('vendor_timeout'):
                    route.fulfill(status=408, body='Request Timeout', content_type='text/plain')
                else:
                    route.fulfill(status=200, body=VENDOR.read_bytes(), content_type='application/javascript')
            else:
                if request.resource_type == 'script':
                    report['blockers'].append({'case': case, 'reason': 'Additional vendor script was requested but is not available as an inspected local fixture', 'host': url.hostname, 'path': url.path})
                route.fulfill(status=204)
        except Exception as error:
            failure = {'case':case, 'phase':item['probePhase'], 'method':request.method,
                       'host':url.hostname, 'path':url.path, 'resourceType':request.resource_type,
                       'bodyCaptured':request.post_data is not None,
                       'capturedBodyBytes':len((request.post_data or '').encode('utf-8')),
                       'message':str(error)}
            report['cases'].append({'case':case, 'requestLifecycleFailure':failure})
            print('Google request lifecycle failure: '+json.dumps(failure),flush=True)
            raise  # The unchanged browser interceptor must still fail the run.
        return
    if request.url == OPS:
        ops_requests.append({'case': case, 'body': request.post_data or ''})
        route.fulfill(status=202, body='{"accepted":true}', content_type='application/json', headers={'Access-Control-Allow-Origin':BASE})
        return
    if url.hostname == 'www.mft.care' and request.method in ('GET', 'HEAD'):
        if url.path == INERT_CASE_PATH:
            # A real navigation, with no vendor, controller, booking code or
            # force_module behavior inherited from the current case fixture.
            route.fulfill(status=200,
                          body='<!doctype html><html><head><title>Completed isolated case</title></head><body data-measurement-probe-inert="true"></body></html>',
                          content_type='text/html',
                          headers={'Content-Security-Policy':"default-src 'none';", 'Referrer-Policy':'no-referrer'})
            return
        if url.path.startswith('/assets/'):
            if url.path == '/assets/mft-booking-core.js':
                route.fulfill(status=200, body=(ROOT/'src/booking-core.js').read_bytes(), content_type='application/javascript')
                return
            if url.path == '/assets/mft-booking-config.js':
                config = json.loads((ROOT/'content/simplepractice-booking.json').read_text())
                config['measurementEnabled'] = False
                route.fulfill(status=200, body='window.MFT_BOOKING_CONFIG='+json.dumps(config)+';', content_type='application/javascript')
                return
            file = ROOT / 'src' / url.path.lstrip('/')
            if file.is_file() and file.parent == ROOT / 'src/assets':
                route.fulfill(status=200, body=file.read_bytes(), content_type='application/javascript', headers={'Referrer-Policy':'no-referrer'})
            else:
                route.fulfill(status=404, body='Not found')
        else:
            route.fulfill(status=200, body=fixture_html(url.path), content_type='text/html', headers={'Content-Security-Policy':REVIEWED_CSP if fixture_options.get('reviewed_csp') else PROBE_CSP,'Referrer-Policy':'no-referrer'})
        return
    if url.hostname in ('marriagefamilytherapy.clientsecure.me','clientsecure.me'):
        destinations.append({'case': case, 'host': url.hostname, 'path': url.path})
        route.fulfill(status=200, body='<p>Intercepted synthetic scheduler destination</p>', content_type='text/html')
        return
    report['blockers'].append({'case':case,'reason':'Unexpected external destination was blocked','host':url.hostname,'path':url.path,'resourceType':request.resource_type})
    route.abort()


def check(name, passed, detail=None):
    report['checks'].append({'case': case, 'name': name, 'pass': bool(passed), **({'detail':detail} if detail is not None else {})})


def current_requests(start=0):
    return [item for item in requests[start:] if item['case'] == case]


def current_events(start=0):
    # Native linked-Ads requests can repeat the event name. Count the one GA4
    # event, inspect every transport separately, and never infer Ads credit here.
    return [row for item in current_requests(start) if item['host'] in GA4_HOSTS and item['path']=='/g/collect' for row in item['rows'] if row.get('en')]


def current_handoffs(start=0):
    return [row for row in current_events(start) if row['en']=='simplepractice_exit']


def inspect_cookies(context, page):
    permission = page.evaluate('key => JSON.parse(localStorage.getItem(key)||"null")', AD_CHOICE)
    deadline = (permission or {}).get('expiresAt', 0)/1000
    cookies = []
    for cookie in context.cookies():
        entry = {key: cookie[key] for key in ('name','domain','path','expires','httpOnly','secure','sameSite')}
        entry['secondsUntilExpiry'] = round(cookie['expires']-time.time(), 2) if cookie['expires'] > 0 else None
        entry['secondsBeyondPermission'] = round(cookie['expires']-deadline, 2) if deadline and cookie['expires'] > 0 else None
        cookies.append(entry)
    report['cases'].append({'case':case,'cookieMetadata':cookies,'localStorageKeys':page.evaluate('Object.keys(localStorage)'), 'sessionStorageKeys':page.evaluate('Object.keys(sessionStorage)')})
    over = [entry for entry in cookies if entry['domain'].lstrip('.')=='www.mft.care' and entry['name'].startswith('mftga_') and entry['secondsBeyondPermission'] is not None and entry['secondsBeyondPermission'] > 2]
    check('New first-party measurement cookies expire within the permission window', not over, over)
    return cookies


def new_context(browser, seed=None, signal=None, existing=None):
    context = browser.new_context()
    if fixture_options.get('existing_google_cookies'):
        context.add_cookies([
            {'name':'NID','value':'SYNTHETIC_GOOGLE_COOKIE_TEST_ONLY','domain':'.google.com','path':'/','secure':True,'sameSite':'None','expires':time.time()+86400},
            {'name':'IDE','value':'SYNTHETIC_DOUBLECLICK_COOKIE_TEST_ONLY','domain':'.doubleclick.net','path':'/','secure':True,'sameSite':'None','expires':time.time()+86400},
        ])
    # Observe command order before the unchanged native append sends the loader.
    context.add_init_script("""(() => {
      const original=Node.prototype.appendChild;
      window.__cspViolations=[];
      document.addEventListener('securitypolicyviolation',event=>window.__cspViolations.push({directive:event.effectiveDirective,blockedURI:event.blockedURI,originalPolicy:event.originalPolicy}));
      Node.prototype.appendChild=function(node){
        if(node?.tagName==='SCRIPT' && String(node.src).startsWith('https://www.googletagmanager.com/gtag/js')) {
          window.__queueBeforeVendor=JSON.parse(JSON.stringify((window.dataLayer||[]).map(item=>Array.from(item))));
          node.addEventListener('load',()=>window.__vendorLoaded=true);
        }
        return original.call(this,node);
      };
    })();""")
    if seed:
        context.add_init_script('if(location.origin==='+json.dumps(BASE)+'&&!localStorage.getItem("mft.syntheticFixtureSeeded")){for(const [key,value] of '+json.dumps(list(seed.items()))+')localStorage.setItem(key,value);localStorage.setItem("mft.syntheticFixtureSeeded","true")}')
    if signal:
        context.add_init_script('Object.defineProperty(Navigator.prototype,'+json.dumps(signal)+',{get:()=>'+('true' if signal=='globalPrivacyControl' else '"1"')+',configurable:true})')
    if existing:
        context.add_init_script(existing)
    context.on('page', lambda page: page.on('pageerror', lambda error: browser_errors.append({'case':case,'message':str(error)})))
    return context


def default_order(page):
    queue = page.evaluate('window.__queueBeforeVendor||[]')
    report['cases'].append({'case':case,'commandsBeforeVendor':[entry[:2] if entry[0] != 'set' or isinstance(entry[1],str) else ['set','configuration'] for entry in queue]})
    defaults = queue[0] if queue else []
    check('Consent defaults precede all configuration and events', len(defaults)==3 and defaults[:2]==['consent','default'] and all(defaults[2].get(key)=='denied' for key in ('analytics_storage','ad_storage','ad_user_data','ad_personalization')))
    configs = [entry for entry in queue if entry[:2]==['config',ID]]
    check('One correct GA4 config with bounded metadata and no automatic pageview', len(configs)==1 and configs[0][2].get('send_page_view') is False and configs[0][2].get('page_title')=='M.F.T. Public Website' and configs[0][2].get('page_referrer')=='')


def assess_requests(start=0):
    items = current_requests(start)
    unexpected_destinations = [{'host':item['host'],'path':item['path'],'resourceType':item['resourceType']} for item in items if not (
        item['host']=='www.googletagmanager.com' and item['path']=='/gtag/js' and item['method']=='GET' and parse_qs(urlsplit(item['url']).query).get('id')==[ID]
        or item['host'] in GA4_HOSTS and item['path']=='/g/collect' and item['method'] in ('GET','POST')
        or item['host']=='www.google.com' and item['path']=='/measurement/conversion' and item['method'] in ('GET','POST')
        or item['host']=='stats.g.doubleclick.net' and item['path']=='/g/collect' and item['method'] in ('GET','POST')
        or item['host']=='www.googletagmanager.com' and item['path'] in ('/a','/td') and item['method'] in ('GET','POST')
    )]
    check('All vendor destinations are in the explicit proposed flow',not unexpected_destinations,unexpected_destinations)
    check('No private title, DOM, provider, form, or query canary is sent', not any(PRIVATE_CANARY in decoded(item['url']+'\n'+item['body']+'\n'+str(item['headers'])) for item in items))
    events = current_events(start)
    all_rows = [row for item in items for row in item['rows']]
    unexpected = sorted({row['en'] for row in all_rows if row.get('en') and row['en'] not in AUTOMATIC_EVENTS|{'simplepractice_exit'}})
    check('Only the handoff and explicitly reviewed standard GA4 activity are emitted', not unexpected, unexpected)
    check('All event rows use the existing GA4 measurement ID; no separate Ads action is dispatched', all(row.get('tid')==ID for row in all_rows if row.get('en')) and not any(str(value).startswith('AW-') for row in all_rows for value in row.values()))
    check('HTTP referrer is absent on Google requests', not any(item['headers'].get('referer') for item in items))
    allowed_fields = {'send_to','page_location','page_title','page_referrer'}
    leaks = sorted({key for row in all_rows for key in row if key.startswith(('ep.','epn.')) and key[3:] not in allowed_fields})
    check('No custom Ops, clinician, placement, form, or identity parameters', not leaks, leaks)
    for row in events:
        url = urlsplit(row.get('dl',''))
        check('Event page location stays on an approved canonical route with native identifiers only', url.scheme == 'https' and url.netloc == 'www.mft.care' and url.path in ('/','/about/') and not url.fragment and set(parse_qs(url.query)) <= {'gclid','gbraid','wbraid'})
        check('Event title and referrer are bounded', row.get('dt') == 'M.F.T. Public Website' and not row.get('dr'))
        check('Advertising personalization stays disabled on event requests', row.get('npa') == '1')
    for item in items:
        if item['host']=='www.google.com' and item['path']=='/measurement/conversion':
            for row in item['rows']:
                url=urlsplit(row.get('url',''))
                check('Linked measurement uses only the canonical public URL and native identifiers',url.scheme=='https' and url.netloc=='www.mft.care' and url.path in PUBLIC_TITLES and not url.fragment and set(parse_qs(url.query))<={'gclid','gbraid','wbraid'})
                check('Linked measurement discloses exactly the reviewed public title',row.get('tiba')==PUBLIC_TITLES.get(url.path))
                check('Linked measurement carries non-personalization and no referrer',row.get('npa')=='1' and not any(row.get(key) for key in ('ref','referrer','dr','page_referrer')))
        if item['host']=='stats.g.doubleclick.net':
            check('Supplemental identifier ping remains non-personalized and has no additional event',all(row.get('npa')=='1' and not row.get('en') for row in item['rows']))
        if item['host']=='www.googletagmanager.com' and item['path'] in ('/a','/td'):
            fields = {
                '/a': {'ccid','cid','cv','e','eid','epr','es','gtm','h','id','l','pid','rv','t','tag_exp','tc','ti','tr','u','ut','v','z'},
                '/td': {'bt','ct','dl','exp','fin','frm','gtm','hlo','id','lst','pid','rtg','seq','slo','t','tdp','v','z'},
            }
            check('Vendor diagnostic fields stay within the recorded unapproved envelope',all(set(row)<=fields[item['path']] and not row.get('en') for row in item['rows']))
            for row in item['rows']:
                if item['path']=='/a' and any(key in row for key in ('ccid','cid','l')):
                    check('Load diagnostics belong to the existing tag configuration',row.get('v')=='3' and row.get('t')=='l' and row.get('cid')==ID and row.get('ccid')==TAG_CANONICAL_CONTAINER_ID)
                if 'dl' in row:
                    location=row['dl']
                    url=urlsplit(location if location.startswith('https://') else 'https://'+location)
                    check('Diagnostic location stays on a reviewed public route with native identifiers only',url.scheme=='https' and url.netloc=='www.mft.care' and url.path in PUBLIC_TITLES and not url.fragment and set(parse_qs(url.query))<={'gclid','gbraid','wbraid'})


def open_case(browser, name, path='/', *, seed=None, signal=None, existing=None, options=None):
    global case, fixture_options
    case, fixture_options = name, dict(options or {})
    fixture_options['_probe_phase'] = 'opening'
    print('Google network case: ' + name, flush=True)
    context = new_context(browser, seed, signal, existing)
    page = context.new_page()
    page.goto(BASE+path, wait_until='domcontentloaded')
    page.wait_for_timeout(200)
    fixture_options['_probe_phase'] = 'exercise'
    return context, page


def close_case(context, pump):
    # Closing a whole browser context can destroy its renderer while the final
    # engagement XHR is paused at the browser Fetch hook. Exercise genuine
    # pagehide/unload first and keep the context alive while those requests are
    # captured and fulfilled. Do not suppress the vendor before that navigation.
    fixture_options['_probe_phase'] = 'native-unload'
    before_unload = len(current_requests())
    pages = [page for page in context.pages if not page.is_closed()]
    try:
        for page in pages:
            page.goto(BASE+INERT_CASE_PATH, wait_until='load', timeout=10000)
            assert page.locator('body[data-measurement-probe-inert="true"]').count()==1, 'Teardown must reach the explicit inert fixture'
        fixture_options['_probe_phase'] = 'draining-live-context'
        last_count = interceptor.request_count
        quiet_since = time.monotonic()
        deadline = quiet_since+5
        while time.monotonic()<deadline:
            pump.wait_for_timeout(50)
            if interceptor.request_count!=last_count:
                last_count=interceptor.request_count
                quiet_since=time.monotonic()
            elif time.monotonic()-quiet_since>=0.5:
                break
        else:
            raise AssertionError('Case requests did not drain while the browser context remained alive')
        interceptor.assert_ok()
        report['cases'].append({'case':case, 'teardown':{
            'inertPages':len(pages), 'vendorRequestsDuringNativeUnload':len(current_requests())-before_unload,
            'quietMillisecondsBeforeContextClose':500}})
        before_close = len(current_requests())
        fixture_options['_probe_phase'] = 'closing-inert-context'
        context.close()
        pump.wait_for_timeout(300)
        check('Disposing inert pages produces no additional vendor request',len(current_requests())==before_close)
        interceptor.assert_ok()
    finally:
        # Include every captured unload and disposal request, even on failure.
        assess_requests()


def ready(page):
    started, immediate = page.evaluate('()=>{const started=window.MFTGoogleMeasurement.grant();return [started,window.MFTGoogleMeasurement.handoff()]}')
    check('Eligible explicit grant starts the runtime', started is True)
    check('Handoff before the vendor load event is not queued', immediate is False)
    page.wait_for_function('() => window.__vendorLoaded===true', timeout=10000)
    page.wait_for_timeout(300)
    default_order(page)
    check('Grant and vendor load alone create no analytics event', not current_events())


def exercise_after_stop(page):
    page.mouse.wheel(0, 900)
    page.evaluate('()=>{window.focus();document.dispatchEvent(new Event("visibilitychange"));window.dispatchEvent(new Event("pageshow"));document.body.click()}')
    page.wait_for_timeout(600)
    check('Stopped handoff stays unavailable', page.evaluate('window.MFTGoogleMeasurement.handoff()') is False)
    check('A previously loaded stopped sender installs one restrictive document policy',page.locator('meta[data-mft-google-stopped="true"]').count()==1 and page.evaluate('window.MFTGoogleMeasurement.requiresReload()') is True)


def prove_csp_blocks_future_transports(page, policy, transports=('fetch','beacon','image','script','frame','worker')):
    """Fixture-only attempts: CSP must reject them before the browser interceptor.

    The unchanged DNS backstop and Fetch guard still protect a failed assertion.
    Matching originalPolicy distinguishes this barrier from any earlier CSP.
    A blob worker would attempt a Google fetch if it could execute; its creation
    must be blocked, so it cannot become a context that outlives the document.
    """
    expected = {
        'fetch': {'directives':['connect-src'],'host':'analytics.google.com'},
        'beacon': {'directives':['connect-src'],'host':'www.google-analytics.com'},
        'image': {'directives':['img-src'],'host':'stats.g.doubleclick.net'},
        'script': {'directives':['script-src','script-src-elem'],'host':'www.googletagmanager.com'},
        'frame': {'directives':['frame-src'],'host':'www.google.com'},
        'worker': {'directives':['worker-src'],'blob':True},
    }
    selected = {kind:expected[kind] for kind in transports}
    before_requests, before_interceptions = len(current_requests()), interceptor.request_count
    violation_start = page.evaluate('window.__cspViolations.length')
    page.evaluate('''([kinds,id])=>{
      const probe={attempted:[],fetchRejected:false,beaconQueued:null,imageError:false,scriptError:false,workerRan:false,workerError:false};
      const elements=[];let worker=null,blobUrl=null;
      window.__futureTransportProbe=probe;
      window.__cleanupFutureTransportProbe=()=>{for(const element of elements)element.remove();worker?.terminate();if(blobUrl)URL.revokeObjectURL(blobUrl);};
      for(const kind of kinds){
        probe.attempted.push(kind);
        if(kind==='fetch')fetch('https://analytics.google.com/g/collect?fixture_probe=fetch',{method:'POST',mode:'no-cors',body:'Synthetic CSP rejection probe'}).catch(()=>{probe.fetchRejected=true;});
        if(kind==='beacon')probe.beaconQueued=navigator.sendBeacon('https://www.google-analytics.com/g/collect?fixture_probe=beacon','Synthetic CSP rejection probe');
        if(kind==='image'){
          const img=new Image();img.onerror=()=>{probe.imageError=true;};img.src='https://stats.g.doubleclick.net/g/collect?fixture_probe=image';elements.push(img);
        }
        if(kind==='script'){
          const script=document.createElement('script');script.onerror=()=>{probe.scriptError=true;};script.src='https://www.googletagmanager.com/gtag/js?id='+id+'&fixture_probe=script';elements.push(script);document.head.appendChild(script);
        }
        if(kind==='frame'){
          const frame=document.createElement('iframe');frame.hidden=true;frame.src='https://www.google.com/measurement/conversion?fixture_probe=frame';elements.push(frame);document.body.appendChild(frame);
        }
        if(kind==='worker'){
          blobUrl=URL.createObjectURL(new Blob(['postMessage("fixture-worker-executed");fetch("https://analytics.google.com/g/collect?fixture_probe=worker",{mode:"no-cors"}).catch(()=>{});'],{type:'application/javascript'}));
          try{worker=new Worker(blobUrl);worker.onmessage=()=>{probe.workerRan=true;};worker.onerror=event=>{event.preventDefault();probe.workerError=true;};}
          catch(error){probe.workerError=true;}
        }
      }
    }''',[list(transports),ID])
    try:
        page.wait_for_function('''([start,policy,expected])=>{
          const events=window.__cspViolations.slice(start);
          return Object.values(expected).every(want=>events.some(event=>{
            if(event.originalPolicy!==policy||!want.directives.includes(event.directive))return false;
            if(want.blob)return event.blockedURI.startsWith('blob');
            try{return new URL(event.blockedURI).hostname===want.host;}catch{return false;}
          }));
        }''',arg=[violation_start,policy,selected],timeout=5000)
        observed=page.evaluate('window.__futureTransportProbe')
        violations=page.evaluate('start=>window.__cspViolations.slice(start)',violation_start)
        check('Every fixture transport is rejected by the specified CSP before interception',len(current_requests())==before_requests and interceptor.request_count==before_interceptions,{'transports':list(transports),'googleRequests':len(current_requests())-before_requests,'interceptorRequests':interceptor.request_count-before_interceptions})
        check('The rejected worker cannot execute or outlive the stopped document',not observed['workerRan'])
        check('The fixture attempted every requested future transport',observed['attempted']==list(transports))
        report['cases'].append({'case':case,'futureTransportCspProbe':{
            'transports':list(transports),'policySha256':hashlib.sha256(policy.encode()).hexdigest(),
            'violations':[{'directive':v['directive'],'blockedOrigin':urlsplit(v['blockedURI']).netloc or v['blockedURI'].split(':')[0],'matchesSpecifiedPolicy':v['originalPolicy']==policy} for v in violations],
            'fetchRejected':observed['fetchRejected'],'beaconQueued':observed['beaconQueued'],
            'imageError':observed['imageError'],'scriptError':observed['scriptError'],'workerExecuted':observed['workerRan']}})
        interceptor.assert_ok()
    finally:
        page.evaluate('window.__cleanupFutureTransportProbe()')


def click_continue(page, selector='#scheduler'):
    page.locator(selector).click()
    dialog = page.locator('dialog.mft-consultation-gate[open]')
    if dialog.count():
        for key in ('data-mft-account-ack','data-mft-consultation-ack'):
            box = dialog.locator('['+key+']')
            if box.is_visible(): box.check()
        dialog.locator('[data-consultation-continue]').click()
    page.wait_for_url(lambda url:urlsplit(url).hostname in ('marriagefamilytherapy.clientsecure.me','clientsecure.me'), timeout=10000)


try:
    VENDOR, VENDOR_METADATA = prepare_vendor()
    metadata=json.loads(VENDOR_METADATA.read_text())
    assert hashlib.sha256(VENDOR.read_bytes()).hexdigest()==metadata['sha256'], 'Vendor bundle differs from its recorded download'
    assert metadata['source']=='https://www.googletagmanager.com/gtag/js?id='+ID and metadata['status']==200
    report['vendor']=metadata
    with sync_playwright() as playwright:
        browser=harness.launch_isolated_chromium(playwright)
        report['browserVersion']=browser.version
        interceptor=harness.install_browser_interceptor(browser,guard)
        control=browser.new_context(); pump=control.new_page()
        # None of these historic or refused choices authorizes this purpose.
        choices = [
            ('no-consent',{}),
            ('legacy-analytics-grant',{'mft.analytics.consent.v4':'granted'}),
            ('current-first-party-grant',{'mft.analytics.consent.v5':'granted'}),
            ('legacy-advertising-grant',{'mft.advertising.consent.v1':'granted'}),
            ('advertising-refused',{AD_CHOICE:json.dumps({'choice':'denied'})}),
            ('advertising-expired',{AD_CHOICE:json.dumps({'choice':'granted','review':REVIEW,'expiresAt':int(time.time()*1000)-1})}),
            ('advertising-other-review',{AD_CHOICE:json.dumps({'choice':'granted','review':'b'*64,'expiresAt':int(time.time()*1000)+60000})}),
        ]
        for name, seed in choices:
            context,page=open_case(browser,name,'/?gclid='+SYNTHETIC_CLICK,seed=seed)
            check('No vendor request without a current separate advertising grant',not current_requests())
            check('No unconsented handoff is queued',page.evaluate('window.MFTGoogleMeasurement.handoff()') is False)
            check('Native source is not stored before permission',page.evaluate('key=>sessionStorage.getItem(key)',GOOGLE_SOURCE) is None)
            close_case(context,pump)
        context,page=open_case(browser,'refusal-before-first-loader')
        page.evaluate('()=>{window.__initialDocumentSentinel=true;window.MFTGoogleMeasurement.deny();}')
        check('Refusal before any vendor request does not impose a document CSP or reload requirement',not page.locator('meta[data-mft-google-stopped="true"]').count() and page.evaluate('window.MFTGoogleMeasurement.requiresReload()') is False and not current_requests())
        ready(page)
        check('A later first grant can start in the same never-loaded document',page.evaluate('window.__initialDocumentSentinel===true') and not page.locator('meta[data-mft-google-stopped="true"]').count())
        close_case(context,pump)
        for name,signal in [('gpc','globalPrivacyControl'),('dnt','doNotTrack')]:
            context,page=open_case(browser,name,'/?gclid='+SYNTHETIC_CLICK,signal=signal)
            check('Privacy signal refuses a requested advertising grant',page.evaluate('window.MFTGoogleMeasurement.grant()') is False)
            check('Privacy signal prevents all Google requests',not current_requests())
            close_case(context,pump)
        for name,path in [
            ('unknown-contact-query','/?email='+PRIVATE_CANARY),
            ('free-text-query','/?utm_content='+PRIVATE_CANARY),
            ('incoming-linker','/?_gl='+PRIVATE_CANARY),
            ('duplicate-click-id','/?gclid='+SYNTHETIC_CLICK+'&gclid=SECOND_SYNTHETIC'),
            ('fragment','/#'+PRIVATE_CANARY),
        ]:
            context,page=open_case(browser,name,path)
            check('Unsafe page context rejects loader even after attempted grant',page.evaluate('window.MFTGoogleMeasurement.grant()') is False)
            check('Unsafe context makes no Google request',not current_requests())
            close_case(context,pump)
        context,page=open_case(browser,'unreviewed-document-title',options={'private_title':True})
        check('An unreviewed actual document title rejects permission activation',page.evaluate('window.MFTGoogleMeasurement.grant()') is False)
        check('Unreviewed title makes no Google request',not current_requests())
        close_case(context,pump)
        for name,existing,options in [
            ('existing-gtag','window.gtag=function(){}',{}),
            ('existing-data-layer','window.dataLayer=[]',{}),
            ('cached-legacy-helper',None,{'legacy_helper':True}),
        ]:
            context,page=open_case(browser,name,existing=existing,options=options)
            check('Existing sender or retired helper conflicts fail closed',page.evaluate('window.MFTGoogleMeasurement.grant()') is False)
            check('No second or conflicting Google loader starts',not current_requests())
            close_case(context,pump)
        context,page=open_case(browser,'excluded-clinician-route','/gary-ashley/',options={'force_module':True})
        check('Route mismatch never installs a sender',page.evaluate('window.MFTGoogleMeasurement===undefined'))
        check('Excluded page sends no Google requests',not current_requests())
        close_case(context,pump)

        # Real, unchanged vendor: inspect native click transport and actual
        # cookie deadlines. Synthetic IDs do not demonstrate Ads credit.
        for native_key in ('gclid','gbraid','wbraid'):
            context,page=open_case(browser,'native-'+native_key,'/?'+native_key+'='+SYNTHETIC_CLICK+'&utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053')
            check('No loader before separate permission',not current_requests())
            ready(page)
            original_deadline=page.evaluate('key=>JSON.parse(localStorage.getItem(key)).expiresAt',AD_CHOICE)
            check('A ready handoff is accepted',page.evaluate('window.MFTGoogleMeasurement.handoff()') is True)
            page.wait_for_timeout(2200)
            check('One explicit handoff produces one GA4 acquisition event',len(current_handoffs())==1)
            check('Native click context reaches the intended page-location field',bool(current_handoffs()) and all(parse_qs(urlsplit(row.get('dl','')).query).get(native_key)==[SYNTHETIC_CLICK] for row in current_handoffs()))
            inspect_cookies(context,page)
            if native_key == 'gclid':
                page.locator('#internal').click()
                page.wait_for_function('() => window.__vendorLoaded===true',timeout=10000)
                check('Eligible navigation preserves the original permission deadline',page.evaluate('key=>JSON.parse(localStorage.getItem(key)).expiresAt',AD_CHOICE)==original_deadline)
                check('Eligible navigation keeps native source without renewal',page.evaluate('key=>JSON.parse(sessionStorage.getItem(key)).expiresAt',GOOGLE_SOURCE)==original_deadline)
                page.evaluate('window.MFTGoogleMeasurement.handoff()')
                page.wait_for_timeout(2200)
                check('Next eligible page sends the same native source on its own canonical URL',any(urlsplit(row.get('dl','')).path=='/about/' and parse_qs(urlsplit(row.get('dl','')).query).get('gclid')==[SYNTHETIC_CLICK] for row in current_events()))
                inspect_cookies(context,page)
            close_case(context,pump)

        context,page=open_case(browser,'reviewed-conditional-csp','/?gclid='+SYNTHETIC_CLICK,options={'reviewed_csp':True})
        ready(page)
        page.evaluate('window.MFTGoogleMeasurement.handoff()')
        page.wait_for_timeout(2200)
        check('Actual proposed CSP permits the one GA4 handoff and native linked transports',len(current_handoffs())==1 and any(r['host']=='www.google.com' for r in current_requests()))
        check('Proposed CSP creates no blocked vendor requests',not page.evaluate('window.__cspViolations'),page.evaluate('window.__cspViolations'))
        close_case(context,pump)

        context,page=open_case(browser,'active-reviewed-csp-context-isolation',options={'reviewed_csp':True})
        directives={part.split()[0]:part.split()[1:] for part in REVIEWED_CSP.split(';') if part.strip()}
        check('Approved-page HTTP policy forbids workers from the initial document response',directives.get('worker-src')==["'none'"])
        check('Approved-page HTTP policy admits only the existing SimplePractice frame origins',set(directives.get('frame-src',[]))=={'https://clientsecure.me','https://marriagefamilytherapy.clientsecure.me','https://spwidget-marriagefamilytherapy.clientsecure.me'})
        prove_csp_blocks_future_transports(page,REVIEWED_CSP,transports=('frame','worker'))
        check('Initial worker and Google-frame rejection does not request a Google loader',not current_requests())
        ready(page)
        check('Blocking persistent child contexts preserves the eligible main-page vendor loader',page.evaluate('window.__vendorLoaded===true'))
        close_case(context,pump)

        # Observe enough active time and pagehide for engagement behavior;
        # send_page_view:false alone is not evidence of no automatic events.
        context,page=open_case(browser,'grant-only-automatic-activity')
        ready(page)
        page.mouse.wheel(0,900)
        page.wait_for_timeout(11000)
        check('Consent, load, scroll and more than ten seconds create no acquisition event',not current_handoffs())
        page.locator('#scheduler').click()
        page.wait_for_timeout(1500)
        check('Uninstrumented outbound link and pagehide create no acquisition or enhanced-measurement event',not current_handoffs() and all(row['en'] in AUTOMATIC_EVENTS for row in current_events()))
        close_case(context,pump)

        # Existing external cookie lifetime is not bounded by first-party cookie
        # settings. Record what this browser exposes without treating omission
        # at a pre-egress Fetch hook as proof of cookie-free network transport.
        context,page=open_case(browser,'preexisting-third-party-cookies','/?gclid='+SYNTHETIC_CLICK,options={'existing_google_cookies':True})
        check('Seeded Google cookies do not cause pre-consent loading',not current_requests())
        ready(page)
        page.evaluate('window.MFTGoogleMeasurement.handoff()')
        page.wait_for_timeout(2200)
        check('Existing cookies still produce one application handoff',len(current_handoffs())==1)
        inspect_cookies(context,page)
        report['cases'].append({'case':case,'thirdPartyCookieCaveat':'Synthetic Google/DoubleClick cookies seeded. Browser cookie restrictions and pre-egress Fetch interception can omit Cookie headers; this does not establish that normal transport never sends existing Google cookies.'})
        page.evaluate('window.MFTGoogleMeasurement.deny()')
        before=len(current_requests())
        exercise_after_stop(page)
        close_case(context,pump)
        check('Withdrawal stops requests even with existing third-party cookies',len(current_requests())==before)

        for reason in ('withdrawal','legacy-cross-tab-withdrawal','dynamic-gpc','expiry'):
            seed = {AD_CHOICE:json.dumps({'choice':'granted','review':REVIEW,'expiresAt':int(time.time()*1000)+4500})} if reason=='expiry' else None
            context,page=open_case(browser,'after-'+reason,seed=seed)
            if reason=='expiry':
                page.wait_for_function('() => window.__vendorLoaded===true',timeout=10000)
                page.wait_for_timeout(5000)
            else:
                ready(page)
                if reason=='dynamic-gpc':
                    page.evaluate('Object.defineProperty(Navigator.prototype,"globalPrivacyControl",{get:()=>true,configurable:true});window.MFTGoogleMeasurement.enforceBoundary()')
                elif reason=='legacy-cross-tab-withdrawal':
                    other=context.new_page()
                    other.goto(BASE+'/privacy/',wait_until='domcontentloaded')
                    other.evaluate('localStorage.setItem("mft.analytics.consent.v4","denied")')
                    page.wait_for_timeout(300)
                else: page.evaluate('window.MFTGoogleMeasurement.deny()')
            before=len(current_requests())
            check('Withdrawal or expiry retains the current page',page.url==BASE+'/')
            exercise_after_stop(page)
            check('Stopped runtime clears its native source',page.evaluate('key=>sessionStorage.getItem(key)',GOOGLE_SOURCE) is None)
            check('Stopped runtime clears vendor localStorage',page.evaluate('localStorage.getItem("_gcl_ls")') is None)
            check('Stopped runtime clears measurement cookies',not [c for c in context.cookies() if re.match(r'^(?:mftga_|_ga|_gcl_)',c['name'])])
            page.locator('#scheduler').click()
            page.wait_for_timeout(1500)
            close_case(context,pump)
            check('No vendor request after stop, activity, native navigation or pagehide',len(current_requests())==before)

        context,page=open_case(browser,'withdrawal-csp-preserves-open-scheduling',options={'controller':True,'booking':True})
        ready(page)
        page.evaluate('window.MFTAnalyticsConsent.grant()')
        page.locator('#scheduler').click()
        gate=page.locator('dialog.mft-consultation-gate[open]')
        gate.locator('[data-mft-account-ack]').check()
        before=len(current_requests())
        page.evaluate('()=>{window.__stoppedDocumentSentinel=true;window.MFTGoogleMeasurement.deny();}')
        policy=page.locator('meta[data-mft-google-stopped="true"]').get_attribute('content')
        prove_csp_blocks_future_transports(page,policy)
        check('Withdrawal and the document barrier preserve the open acknowledged scheduling dialog',page.evaluate('window.__stoppedDocumentSentinel===true') and page.url==BASE+'/' and gate.is_visible() and gate.locator('[data-mft-account-ack]').is_checked())
        check('Withdrawal leaves the permitted first-party choice intact',page.evaluate('window.MFTAnalyticsConsent.status()')=='granted')
        check('Opening and acknowledging under the barrier still produce no handoff',not current_handoffs() and not [r for r in ops_requests if r['case']==case])
        gate.locator('[data-consultation-continue]').click()
        page.wait_for_url(lambda url:urlsplit(url).hostname=='marriagefamilytherapy.clientsecure.me',timeout=10000)
        page.wait_for_timeout(300)
        check('The stop policy permits one native scheduler navigation and the independent Ops handoff',len([r for r in ops_requests if r['case']==case])==1 and len([r for r in destinations if r['case']==case and r['path']=='/request'])==1)
        close_case(context,pump)
        check('The stopped vendor sends nothing through the probes, Continue or native unload',len(current_requests())==before)

        context,page=open_case(browser,'fresh-regrant-reloads-stopped-document',options={'controller':True})
        page.evaluate('window.__preRegrantDocumentSentinel=true')
        page.get_by_role('button',name='Allow Google advertising measurement',exact=True).click()
        page.wait_for_function('()=>window.__vendorLoaded===true',timeout=10000)
        default_order(page)
        first_permission=page.evaluate('key=>JSON.parse(localStorage.getItem(key))',AD_CHOICE)
        page.evaluate('window.MFTGoogleMeasurement.handoff()')
        page.wait_for_timeout(2200)
        check('The first explicit grant and handoff produce one acquisition event',len(current_handoffs())==1)
        page.get_by_role('button',name='Analytics choices',exact=True).click()
        page.get_by_role('button',name='Decline Google advertising measurement',exact=True).click()
        before=len(current_requests())
        exercise_after_stop(page)
        check('Refusal alone does not reload or resume the existing document',page.evaluate('window.__preRegrantDocumentSentinel===true') and page.evaluate('window["ga-disable-G-BTK39BBNRE"]') is True and len(current_requests())==before)
        page.evaluate('''()=>window.addEventListener('beforeunload',()=>sessionStorage.setItem('mft.probe.regrant-state',JSON.stringify({
          disabled:window['ga-disable-G-BTK39BBNRE'],requiresReload:window.MFTGoogleMeasurement.requiresReload(),
          handoffAccepted:window.MFTGoogleMeasurement.handoff(),barriers:document.querySelectorAll('meta[data-mft-google-stopped="true"]').length
        })),{once:true})''')
        page.get_by_role('button',name='Analytics choices',exact=True).click()
        regrant=page.get_by_role('button',name=re.compile(r'Allow Google.*reload',re.I))
        check('The separate regrant choice explicitly discloses the required reload',regrant.count()==1 and regrant.is_visible() and 'reload' in regrant.inner_text().lower())
        with page.expect_navigation(wait_until='domcontentloaded',timeout=10000):
            regrant.click()
        page.wait_for_function('()=>window.__vendorLoaded===true',timeout=10000)
        page.wait_for_timeout(300)
        old_document=page.evaluate('JSON.parse(sessionStorage.getItem("mft.probe.regrant-state"))')
        second_permission=page.evaluate('key=>JSON.parse(localStorage.getItem(key))',AD_CHOICE)
        check('The departing document stays disabled and cannot replay a handoff after regrant',old_document=={'disabled':True,'requiresReload':True,'handoffAccepted':False,'barriers':1})
        check('Regrant creates a new document rather than loosening the stopped document policy',page.evaluate('window.__preRegrantDocumentSentinel===undefined') and page.evaluate('performance.getEntriesByType("navigation")[0].type')=='reload' and page.evaluate('window.MFTGoogleMeasurement.requiresReload()') is False and not page.locator('meta[data-mft-google-stopped="true"]').count())
        check('The fresh explicit choice persists a new current consent window',second_permission.get('choice')=='granted' and second_permission.get('review')==REVIEW and second_permission.get('expiresAt',0)>first_permission['expiresAt'])
        loaders=[r for r in current_requests() if r['host']=='www.googletagmanager.com' and r['path']=='/gtag/js']
        check('Regrant loads one vendor in each of the two documents without replaying the prior event',len(loaders)==2 and len(current_handoffs())==1)
        default_order(page)
        page.evaluate('sessionStorage.removeItem("mft.probe.regrant-state")')
        check('Only a new handoff in the new consented document is accepted',page.evaluate('window.MFTGoogleMeasurement.handoff()') is True)
        page.wait_for_timeout(2200)
        check('The new document records exactly one additional explicit handoff',len(current_handoffs())==2)
        close_case(context,pump)

        context,page=open_case(browser,'form-added-after-permission')
        ready(page)
        before=len(current_requests())
        page.evaluate('value=>{const f=document.createElement("form");f.addEventListener("submit",event=>event.preventDefault());f.innerHTML="<input id=private-field><button id=private-submit>Submit</button>";document.body.appendChild(f);document.getElementById("private-field").value=value}',PRIVATE_CANARY)
        page.locator('#private-field').fill(PRIVATE_CANARY)
        page.locator('#private-submit').click()
        page.wait_for_timeout(1200)
        check('A newly added form stops the conditional sender',page.evaluate('window.MFTGoogleMeasurement.handoff()') is False)
        close_case(context,pump)
        check('Form fields and native submit cause no post-boundary Google request',len(current_requests())==before)

        for action in ('handoff','visibilitychange','pagehide'):
            context,page=open_case(browser,'title-change-'+action,'/?gclid='+SYNTHETIC_CLICK)
            ready(page)
            before=len(current_requests())
            result=page.evaluate('([value,action])=>{document.title=value;if(action==="handoff")return window.MFTGoogleMeasurement.handoff();if(action==="visibilitychange")document.dispatchEvent(new Event(action));else window.dispatchEvent(new PageTransitionEvent(action));return false}',[PRIVATE_CANARY,action])
            check('Same-turn title change cannot qualify a handoff',result is False)
            page.wait_for_timeout(1200)
            check('A changed actual title stops the conditional sender',page.evaluate('window.MFTGoogleMeasurement.handoff()') is False)
            if action=='pagehide':
                policy=page.locator('meta[data-mft-google-stopped="true"]').get_attribute('content')
                prove_csp_blocks_future_transports(page,policy)
            close_case(context,pump)
            check('Title change followed immediately by activity creates no post-boundary request',len(current_requests())==before)

        for action in ('handoff','visibilitychange','pagehide'):
            context,page=open_case(browser,'query-change-'+action,'/?gclid='+SYNTHETIC_CLICK)
            ready(page)
            before=len(current_requests())
            result=page.evaluate('([value,action])=>{history.replaceState(null,"","/?email="+value);if(action==="handoff")return window.MFTGoogleMeasurement.handoff();if(action==="visibilitychange")document.dispatchEvent(new Event(action));else window.dispatchEvent(new PageTransitionEvent(action));return false}',[PRIVATE_CANARY,action])
            check('Same-turn unsafe query change cannot qualify a handoff',result is False)
            page.wait_for_timeout(1200)
            check('An unsafe changed query stops the conditional sender',page.evaluate('window.MFTGoogleMeasurement.handoff()') is False)
            close_case(context,pump)
            check('Unsafe query followed immediately by activity creates no post-boundary request',len(current_requests())==before)

        # Native production booking/controller code, isolated response fixtures.
        options={'controller':True,'booking':True}
        for mode in ('native-continue','repeat-same-dialog','remembered-ack','repeat-remembered-ack','clinician-excluded','existing-client-excluded','vendor-blocked','vendor-timeout'):
            selected_options=options|({'vendor_blocked':True} if mode=='vendor-blocked' else {'vendor_timeout':True} if mode=='vendor-timeout' else {})
            seed={'mft.newClientAccountAcknowledgment.v1':'acknowledged'} if mode in ('remembered-ack','repeat-remembered-ack') else None
            context,page=open_case(browser,mode,seed=seed,options=selected_options)
            page.get_by_role('button',name='Allow Google advertising measurement',exact=True).click()
            if mode.startswith('vendor-'):
                page.wait_for_timeout(600)
            else:
                page.wait_for_function('() => window.__vendorLoaded===true',timeout=10000)
            page.evaluate('window.MFTAnalyticsConsent.grant()')
            check('Independent consent choices alone create no handoff',not current_handoffs() and not [r for r in ops_requests if r['case']==case])
            if mode=='existing-client-excluded':
                page.locator('#existing').click()
            elif mode=='repeat-same-dialog':
                page.locator('#scheduler').click()
                dialog=page.locator('dialog.mft-consultation-gate[open]')
                dialog.locator('[data-mft-account-ack]').check()
                page.evaluate('''()=>{const go=document.querySelector('[data-consultation-continue]');const original=window.setTimeout;window.setTimeout=(fn,delay,...args)=>delay===0&&String(fn).includes('dialog.close')?-1:original(fn,delay,...args);go.addEventListener('click',event=>event.preventDefault());}''')
                dialog.locator('[data-consultation-continue]').dblclick()
            elif mode=='repeat-remembered-ack':
                # Cancel only the final native default action, after the real
                # document-level booking handlers observed each trusted click.
                page.evaluate('document.addEventListener("click",event=>{if(event.target.closest("#scheduler"))event.preventDefault()})')
                page.locator('#scheduler').dblclick()
            else:
                if mode=='native-continue':
                    page.locator('#scheduler').click()
                    dialog=page.locator('dialog.mft-consultation-gate[open]')
                    check('Opening the actual scheduling dialog creates no handoff',not current_events() and not [r for r in ops_requests if r['case']==case])
                    dialog.locator('[data-mft-account-ack]').check()
                    check('Acknowledgment alone creates no handoff',not current_events() and not [r for r in ops_requests if r['case']==case])
                    page.keyboard.press('Escape')
                    page.wait_for_timeout(200)
                    check('Dismissing the dialog creates no handoff',not current_events() and not [r for r in ops_requests if r['case']==case])
                click_continue(page,'#clinician' if mode=='clinician-excluded' else '#scheduler')
            page.wait_for_timeout(2200)
            observed=[r for r in ops_requests if r['case']==case]
            expected=0 if mode in ('clinician-excluded','existing-client-excluded','vendor-blocked','vendor-timeout') else 1
            check('Only an eligible generic Continue sends one Google handoff',len(current_handoffs())==expected)
            check('Existing-client sign-in stays outside Ops; new-client actions remain usable',len(observed)==(0 if mode=='existing-client-excluded' else 1))
            if mode not in ('repeat-same-dialog','repeat-remembered-ack'):
                check('Native scheduling navigation is preserved',urlsplit(page.url).hostname in ('marriagefamilytherapy.clientsecure.me','clientsecure.me'))
            if mode=='repeat-same-dialog':
                check('Two activations remain one Ops event in the same dialog',len(observed)==1 and page.locator('dialog.mft-consultation-gate[open]').is_visible())
            if mode=='repeat-remembered-ack':
                check('Repeated trusted direct activations remain one Ops event',len(observed)==1)
            google_text='\n'.join(r['url']+'\n'+r['body'] for r in current_requests())
            handoff_ids=[json.loads(r['body']).get('eventId') for r in observed]
            check('Internal handoff IDs never enter Google requests',all(value and value not in google_text for value in handoff_ids))
            close_case(context,pump)
        control.close(); browser.close(); interceptor.assert_ok()
    report['googleRequests']=[summarized(item) for item in requests]
    report['browserErrors']=browser_errors
    report['pass']=all(item['pass'] for item in report['checks']) and not report['blockers'] and not browser_errors
except Exception as error:
    report['pass']=False
    report['error']=str(error)
    raise
finally:
    report['googleRequests']=[summarized(item) for item in requests]
    report['observedGoogleHosts']=sorted({item['host'] for item in requests})
    report['observedEventNames']=sorted({row['en'] for item in requests for row in item['rows'] if row.get('en')})
    report['automaticEventMarkers']=sorted({key for item in requests for row in item['rows'] for key in ('_fv','_ss','_ee') if key in row})
    report['syntheticOpsDeliveries']=len(ops_requests)
    report['syntheticDestinations']=destinations
    if interceptor:
        report['interceptedRequests']=interceptor.request_count
        report['interceptorErrors']=interceptor.errors
    (OUT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if not report['pass']:
    raise SystemExit(1)
