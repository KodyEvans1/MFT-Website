"""Native new-tab return regression; every browser request is intercepted.

Run with a real display, e.g. xvfb-run -a python tests/booking-return-browser.py.
The browser uses DNS denial plus the shared browser-target Fetch interceptor.
Fixtures load the actual booking/controller/runtime sources. Google is absent
in the production-mode case; the separately approved synthetic case uses the
unchanged public tag, served locally. Neither case delivers events externally.
This proves handoff behavior, not production Ops receipt or Google attribution.
"""
import hashlib
import importlib.util
import inspect
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit
from playwright.sync_api import sync_playwright
from ops_handoff_fixture import ENDPOINT, accept_handoff, is_handoff_request, validate_handoff
from measurement_privacy_fixture import is_google_url

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/booking-return'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.mft.care'
REQUEST = 'https://marriagefamilytherapy.clientsecure.me/request'
ID = 'G-BTK39BBNRE'
TAG_CANONICAL_CONTAINER_ID = '267080605'
VENDOR_URL = 'https://www.googletagmanager.com/gtag/js?id=' + ID
VENDOR = OUT / 'gtag.js'
METADATA = OUT / 'gtag-metadata.json'
TITLE = 'Marriage.Family.Therapy | Woodinville & Online in Washington'
PAGE_KEY = hashlib.sha256(b'/').hexdigest()[:16]
REVIEW = 'a' * 64
TD_FIELDS = {'bt','ct','dl','exp','fin','frm','gtm','hlo','id','lst','mde','pid','rtg','seq','slo','t','tdp','v','z'}
DIAGNOSTIC_SCRIPT_FIELDS = {'dl','exp','fin','gtm','id','is_td','mde','pid','seq','t','tdp','v','z'}
BASE_CSP = "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://ops.mft.care; frame-src https://clientsecure.me https://marriagefamilytherapy.clientsecure.me https://spwidget-marriagefamilytherapy.clientsecure.me; worker-src 'none';"
HEADERS = '/*\n  Content-Security-Policy: ' + BASE_CSP + '\n'
GOOGLE_CSP = subprocess.check_output(['node', '-e', "const c=require('./src/google-measurement-csp');process.stdout.write(c.headerPolicy(c.permitGoogle(process.argv[1]).headers))", HEADERS], cwd=ROOT, text=True)
spec = importlib.util.spec_from_file_location('return_browser_harness', ROOT / 'tests/scheduling-browser-harness.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
report = {'passed': False, 'scope': __doc__.strip(), 'checks': [], 'cases': []}
state = None
interceptor = None
interceptors = []


def prepare_vendor():
    class ExactTagRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            assert newurl == VENDOR_URL, 'Unexpected vendor redirect'
            return super().redirect_request(req, fp, code, msg, headers, newurl)
    opener = urllib.request.build_opener(ExactTagRedirect)
    with opener.open(urllib.request.Request(VENDOR_URL, method='GET'), timeout=30) as response:
        assert response.status == 200 and 'javascript' in response.headers.get('Content-Type', '')
        body = response.read(2_000_001)
        assert len(body) <= 2_000_000
    VENDOR.write_bytes(body)
    METADATA.write_text(json.dumps({'source': VENDOR_URL, 'method': 'GET', 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'downloadedAtUtc': datetime.now(timezone.utc).isoformat(), 'scope': 'Public script download only; no cookies, credentials, event delivery or patient data.'}, indent=2) + '\n')


def fixture():
    google = '<script defer src="/assets/mft-google-measurement.js" data-mft-google-mode="approved-main-page" data-mft-google-measurement-id="'+ID+'" data-mft-google-route="/" data-mft-google-event="simplepractice_exit" data-mft-google-approved-review="'+REVIEW+'"></script>' if state['google'] else ''
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><link rel="icon" href="data:,"><title>'+TITLE+'</title><style>body{font-family:sans-serif;margin:2rem}a{display:block;margin:2rem 0}dialog{max-width:35rem}</style>'+google+'<script defer src="/assets/mft-analytics.js" data-mft-measurement-controller="first-party" data-mft-page-key="'+PAGE_KEY+'" data-mft-handoff-endpoint="'+ENDPOINT+'"></script><script defer src="/assets/mft-booking-core.js"></script><script defer src="/assets/mft-booking-config.js"></script><script defer src="/assets/mft-booking.js"></script></head><body><h1>Isolated scheduling return</h1><a id="scheduler" href="'+REQUEST+'" data-mft-booking-intent="appointment">Request an appointment</a><footer></footer></body></html>'


def initial_loader(item):
    url = urlsplit(item['url'])
    return (url.scheme == 'https' and url.netloc == 'www.googletagmanager.com' and url.path == '/gtag/js'
            and item['method'] == 'GET' and item['resourceType'] == 'script' and not item['body']
            and parse_qsl(url.query, keep_blank_values=True) == [('id', ID)])


def diagnostic_counters(value):
    # Match the reviewed serializer in google-measurement-network.py: one
    # existing destination, unique sorted numeric endpoint/count pairs.
    parts = value.split(';')
    if len(parts) < 2 or parts[0] != ID:
        return False
    endpoints = []
    for part in parts[1:]:
        match = re.fullmatch(r'(0|[1-9]\d*)_([1-9]\d*)', part)
        if not match:
            return False
        endpoints.append(int(match[1]))
    return endpoints == sorted(set(endpoints))


def diagnostic_row(row, *, script=False):
    if not set(row) <= (DIAGNOSTIC_SCRIPT_FIELDS if script else TD_FIELDS):
        return False
    if any(row.get(key) != value for key, value in {'id': ID, 'v': '3', 't': 't', 'z': '0',
            'tdp': ID+';'+TAG_CANONICAL_CONTAINER_ID+';0;0;0'}.items()):
        return False
    # This probe has only the reviewed homepage fixture, never a private route.
    if row.get('dl') != 'www.mft.care/':
        return False
    if 'fin' in row and row['fin'] != '1':
        return False
    if not re.fullmatch(r'[1-9]\d*', row.get('seq', '')):
        return False
    if not re.fullmatch(r'0|[1-9]\d*', row.get('pid', '')) or int(row['pid']) > 2147483647:
        return False
    if 'mde' in row and not diagnostic_counters(row['mde']):
        return False
    return not script or row.get('is_td') == '1' and 'mde' in row


def diagnostic_script(item):
    url = urlsplit(item['url'])
    pairs = parse_qsl(url.query, keep_blank_values=True)
    row = dict(pairs)
    return (url.scheme == 'https' and url.netloc == 'www.googletagmanager.com' and url.path == '/gtag/js'
            and item['method'] == 'GET' and item['resourceType'] == 'script' and not item['body']
            and len(row) == len(pairs) and diagnostic_row(row, script=True))


def guard(route):
    request = route.request
    url = urlsplit(request.url)
    if is_handoff_request(request):
        state['ops'].append(validate_handoff(request))
        accept_handoff(route)
    elif is_google_url(request.url):
        assert state['google'], 'Production-mode fixture attempted Google collection'
        rows = []
        for body in (request.post_data or '').splitlines() or ['']:
            rows.append(dict(parse_qsl(url.query, keep_blank_values=True)) | dict(parse_qsl(body, keep_blank_values=True)))
        item = {'url': request.url, 'body': request.post_data or '', 'host': url.hostname, 'path': url.path,
                'method': request.method, 'resourceType': request.resource_type, 'rows': rows}
        state['googleRequests'].append(item)
        assert not request.headers.get('referer'), 'Unexpected Google HTTP referrer'
        if initial_loader(item):
            item['fixtureResponseRole'] = 'initial-loader'
            route.fulfill(status=200, body=VENDOR.read_bytes(), content_type='application/javascript')
        elif diagnostic_script(item):
            # An inspected diagnostic sink, not another runtime loader and not
            # a claim about Google's real server response. Never execute the
            # vendor fixture twice when its sampled is_td fallback is emitted.
            item['fixtureResponseRole'] = 'diagnostic-script'
            route.fulfill(status=200, body='', content_type='application/javascript')
        else:
            fields = sorted({key for row in rows for key in row})
            assert request.resource_type != 'script', 'Unexpected additional vendor script: '+str(url.hostname)+url.path+' fields='+str(fields)
            if url.hostname == 'www.googletagmanager.com' and url.path == '/td':
                assert request.method in ('GET', 'POST') and all(diagnostic_row(row) for row in rows), 'Unreviewed tag diagnostic envelope: '+str(fields)
            item['fixtureResponseRole'] = 'collector'
            route.fulfill(status=204)
    elif url.hostname == 'www.mft.care' and request.method == 'GET':
        if url.path == '/':
            route.fulfill(status=200, body=fixture(), content_type='text/html', headers={'Content-Security-Policy': GOOGLE_CSP if state['google'] else BASE_CSP, 'Referrer-Policy': 'no-referrer'})
        elif url.path == '/__return_finished__/':
            route.fulfill(status=200, body='<!doctype html><title>Finished</title><link rel="icon" href="data:,">', content_type='text/html', headers={'Content-Security-Policy': "default-src 'none';"})
        elif url.path == '/assets/mft-booking-core.js':
            route.fulfill(status=200, body=(ROOT/'src/booking-core.js').read_bytes(), content_type='application/javascript')
        elif url.path == '/assets/mft-booking-config.js':
            config = json.loads((ROOT/'content/simplepractice-booking.json').read_text())
            config['measurementEnabled'] = False
            route.fulfill(status=200, body='window.MFT_BOOKING_CONFIG='+json.dumps(config)+';', content_type='application/javascript')
        elif url.path in ['/assets/'+name for name in ('mft-analytics.js', 'mft-booking.js', 'mft-google-measurement.js')]:
            route.fulfill(status=200, body=(ROOT/'src'/url.path.lstrip('/')).read_bytes(), content_type='application/javascript')
        else:
            raise AssertionError('Unexpected fixture URL: '+url.path)
    elif url.hostname == 'marriagefamilytherapy.clientsecure.me' and request.method == 'GET' and url.path == '/request':
        state['destinations'].append(request.url)
        route.fulfill(status=200, body='<!doctype html><title>Intercepted scheduler</title><link rel="icon" href="data:,"><h1>Intercepted scheduler</h1>', content_type='text/html')
    else:
        route.abort()
        raise AssertionError('Unexpected destination: '+str(url.hostname)+url.path)


def check(name, condition):
    interceptor.assert_ok()
    assert not state['errors'], state['errors']
    report['checks'].append({'case': state['name'], 'name': name, 'pass': bool(condition)})
    assert condition, name


def google_handoffs():
    return [row for request in state['googleRequests'] if request['path'] == '/g/collect' and request['host'] in ('analytics.google.com', 'www.google-analytics.com', 'region1.google-analytics.com', 'www.google.com') for row in request['rows'] if row.get('en') == 'simplepractice_exit']


def settle(page, count):
    deadline = time.monotonic() + 8
    while (len(state['ops']) < count or (state['google'] and len(google_handoffs()) < count)) and time.monotonic() < deadline:
        page.wait_for_timeout(50)
        interceptor.assert_ok()
    page.wait_for_timeout(300)
    check('Expected handoff count '+str(count), len(state['ops']) == count and len(google_handoffs()) == (count if state['google'] else 0))


@contextmanager
def native_browser(playwright):
    # The public no_defaults attachment (Playwright >=1.60) avoids installing
    # focus emulation in the first place. It applies only to the externally
    # launched browser's default context, so each case gets a fresh process and
    # profile. A second CDP session cannot undo another session's focus capture.
    # https://playwright.dev/python/docs/api/class-browsertype#browser-type-connect-over-cdp
    assert 'no_defaults' in inspect.signature(playwright.chromium.connect_over_cdp).parameters, 'Native tab visibility requires Playwright >=1.60 with no_defaults'
    chrome = Path(os.environ.get('CHROME_PATH') or os.environ.get('MFT_CHROMIUM') or playwright.chromium.executable_path)
    assert chrome.is_file() and 'headless' not in chrome.name.lower(), 'A full headed Chromium binary is required, not headless-shell'
    with tempfile.TemporaryDirectory(prefix='mft-native-return-') as directory:
        profile = Path(directory) / 'profile'
        log_path = Path(directory) / 'chromium.log'
        with log_path.open('w+b') as browser_log:
            process = subprocess.Popen([str(chrome), '--remote-debugging-port=0', '--user-data-dir='+str(profile),
                '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
                '--disable-component-update', '--disable-default-apps', '--disable-extensions', '--disable-sync',
                '--metrics-recording-only', '--password-store=basic', '--no-sandbox', '--no-proxy-server',
                '--host-resolver-rules=MAP * ~NOTFOUND', 'about:blank'], stdout=browser_log, stderr=subprocess.STDOUT)
            browser = None
            try:
                active_port = profile / 'DevToolsActivePort'
                deadline = time.monotonic()+15
                while not active_port.is_file() and process.poll() is None and time.monotonic() < deadline:
                    time.sleep(0.05)
                if not active_port.is_file() or process.poll() is not None:
                    browser_log.seek(0)
                    raise AssertionError('Headed Chromium did not start: '+browser_log.read().decode('utf-8', errors='replace')[-4000:])
                port = active_port.read_text().splitlines()[0]
                assert port.isdigit() and 0 < int(port) < 65536, 'Invalid local DevTools port'
                browser = playwright.chromium.connect_over_cdp('http://127.0.0.1:'+port, no_defaults=True, timeout=15000)
                assert len(browser.contexts) == 1, 'Expected only the fresh default browser context'
                yield browser, browser.contexts[0]
            finally:
                try:
                    if browser is not None and browser.is_connected():
                        browser.close()
                finally:
                    if process.poll() is None:
                        process.terminate()
                        try:
                            process.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            process.kill()
                            process.wait(timeout=5)


def visibility_snapshot(page):
    snapshot = {'url': page.url, 'closed': page.is_closed()}
    if not snapshot['closed']:
        try:
            snapshot.update(page.evaluate('''() => ({
                visibilityState: document.visibilityState, hidden: document.hidden,
                hasFocus: document.hasFocus(), readyState: document.readyState,
                events: window.__returnVisibility || [], pageshows: window.__returnPageshows || [],
                sentinel: window.__returnSentinel || null
            })'''))
        except Exception as error:
            snapshot['snapshotError'] = str(error)
    return snapshot


def background_handoff(context, page, button='left'):
    with context.expect_page(timeout=10000) as opened:
        page.locator('#scheduler').click(**({'button': 'middle'} if button == 'middle' else {'modifiers': ['Control']}))
    child = opened.value
    child.wait_for_url(REQUEST, wait_until='load')
    check('Background scheduler navigation leaves the source document visible', page.evaluate('document.visibilityState') == 'visible')
    return child


def return_from_scheduler(source, scheduler):
    prior = source.evaluate('window.__returnVisibility.length')
    phase = 'foreground-scheduler'
    try:
        scheduler.bring_to_front()
        source.wait_for_function('n => document.visibilityState === "hidden" && window.__returnVisibility.slice(n).some(event => event.state === "hidden" && event.trusted)', arg=prior, polling=50, timeout=10000)
        phase = 'return-to-source'
        source.bring_to_front()
        source.wait_for_function('n => document.visibilityState === "visible" && window.__returnVisibility.slice(n).some(event => event.state === "visible" && event.trusted)', arg=prior, polling=50, timeout=10000)
    except Exception as error:
        diagnostic = {'case': state['name'], 'phase': phase, 'priorEventCount': prior,
                      'source': visibility_snapshot(source), 'scheduler': visibility_snapshot(scheduler),
                      'error': str(error)}
        report.setdefault('visibilityFailures', []).append(diagnostic)
        print('Native visibility failure: '+json.dumps(diagnostic), flush=True)
        raise
    events = source.evaluate('n => window.__returnVisibility.slice(n)', prior)
    check('Real scheduler tab foreground and source return produce trusted hidden-to-visible states', [event['state'] for event in events] == ['hidden', 'visible'] and all(event['trusted'] for event in events))
    check('The original source document survives without navigation or BFCache restoration', source.url == BASE+'/' and source.evaluate('window.__returnSentinel') == 'same-original-document' and not any(source.evaluate('window.__returnPageshows')))
    return events


if '--prepare-vendor' in sys.argv:
    prepare_vendor()
    print(METADATA.read_text())
    raise SystemExit(0)

try:
    if not VENDOR.exists() or not METADATA.exists():
        prepare_vendor()
    vendor = json.loads(METADATA.read_text())
    assert vendor['source'] == VENDOR_URL and hashlib.sha256(VENDOR.read_bytes()).hexdigest() == vendor['sha256']
    report['vendor'] = vendor
    source_files = ['src/assets/mft-booking.js', 'src/assets/mft-analytics.js', 'src/assets/mft-google-measurement.js', 'src/google-measurement-csp.js', 'tests/booking-return-browser.py', 'tests/scheduling-browser-harness.py']
    report['sourceSha256'] = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in source_files}
    with sync_playwright() as playwright:
        report['focusControl'] = 'External headed Chromium; first Playwright attachment uses connect_over_cdp(no_defaults=True) and only the fresh default context. Native bring_to_front transitions and trusted visibility events are required.'
        for google in (False, True):
            state = {'name': 'conditional-google-fixture' if google else 'production-google-blocked', 'google': google, 'ops': [], 'googleRequests': [], 'destinations': [], 'errors': []}
            with native_browser(playwright) as (browser, context):
                report['browserVersion'] = browser.version
                # Keep a blank control tab alive while checking the hard DNS
                # backstop, before any interception or measurement fixture.
                control = context.pages[0] if context.pages else context.new_page()
                probe = context.new_page()
                try:
                    probe.goto('https://www.google-analytics.com/', timeout=10000)
                except Exception as error:
                    assert 'ERR_NAME_NOT_RESOLVED' in str(error), str(error)
                else:
                    raise AssertionError('Browser DNS denial is not effective')
                finally:
                    probe.close()
                interceptor = harness.install_browser_interceptor(browser, guard)
                interceptors.append((state['name'], interceptor))
                context.on('page', lambda page: page.on('pageerror', lambda error: state['errors'].append(str(error))))
                context.add_init_script('''(() => {
                    if(location.origin !== 'https://www.mft.care')return;
                    localStorage.setItem('mft.analytics.consent.v5','granted');
                    localStorage.setItem('mft.newClientAccountAcknowledgment.v1','acknowledged');
                    window.__returnVisibility=[];window.__returnPageshows=[];
                    document.addEventListener('visibilitychange',event=>window.__returnVisibility.push({state:document.visibilityState,trusted:event.isTrusted}));
                    window.addEventListener('pageshow',event=>window.__returnPageshows.push(event.persisted));
                    const append=Node.prototype.appendChild;
                    Node.prototype.appendChild=function(node){if(node?.tagName==='SCRIPT'&&node.src==='https://www.googletagmanager.com/gtag/js?id=G-BTK39BBNRE')node.addEventListener('load',()=>window.__returnVendorLoaded=true);return append.call(this,node);};
                })();''')
                page = context.new_page()
                page.goto(BASE+'/', wait_until='load')
                page.bring_to_front()
                page.wait_for_function('() => document.visibilityState === "visible"')
                page.evaluate("window.__returnSentinel='same-original-document'")
                if google:
                    page.get_by_role('button', name='Allow Google advertising measurement', exact=True).click()
                    page.wait_for_function('() => window.__returnVendorLoaded === true')
                check('The remembered acknowledgment starts with zero handoffs', not state['ops'] and not google_handoffs())
                first = background_handoff(context, page)
                settle(page, 1)
                background_handoff(context, page, 'middle')
                settle(page, 1)
                check('Repeated background activations retain one handoff while both destinations work', len(state['destinations']) == 2)
                events = return_from_scheduler(page, first)
                settle(page, 1)
                background_handoff(context, page)
                settle(page, 2)
                background_handoff(context, page, 'middle')
                settle(page, 2)
                check('The new visible visit retains duplicate protection and every native destination', len(state['destinations']) == 4)
                ids = [row['eventId'] for row in state['ops']]
                check('The new handoff has a distinct Ops action ID', len(ids) == 2 and len(set(ids)) == 2)
                check('No scheduling dialog is reopened by a document return', page.locator('dialog.mft-consultation-gate[open]').count() == 0)
                pageshows = page.evaluate('window.__returnPageshows')
                # Drain genuine unload while its document is alive, then close
                # inert fixture tabs. Every interception failure stays fatal.
                page.goto(BASE+'/__return_finished__/', wait_until='load')
                page.wait_for_timeout(500)
                check('Genuine unload does not replay acquisition handoffs', len(state['ops']) == 2 and len(google_handoffs()) == (2 if google else 0))
                for fixture_page in list(context.pages):
                    if fixture_page is not control:
                        fixture_page.close()
                control.wait_for_timeout(300)
                check('Closing the drained fixture tabs preserves acquisition totals', len(state['ops']) == 2 and len(google_handoffs()) == (2 if google else 0))
            check('Closing the drained browser preserves acquisition totals', len(state['ops']) == 2 and len(google_handoffs()) == (2 if google else 0))
            google_text = '\n'.join(row['url']+'\n'+row['body'] for row in state['googleRequests'])
            check('Ops IDs remain separate from every Google request including unload', all(event_id not in google_text for event_id in ids))
            check('Google application events retain the one existing GA4 destination', all(row.get('tid') == ID for row in google_handoffs()))
            loaders = sum(request.get('fixtureResponseRole') == 'initial-loader' for request in state['googleRequests'])
            diagnostics = sum(request.get('fixtureResponseRole') == 'diagnostic-script' for request in state['googleRequests'])
            check('Only the exact initial loader can execute the vendor fixture', loaders == (1 if google else 0))
            report['cases'].append({'name': state['name'], 'opsHandoffs': len(state['ops']), 'uniqueOpsActions': len(set(ids)), 'googleHandoffs': len(google_handoffs()), 'nativeDestinations': len(state['destinations']), 'returnVisibility': events, 'persistedPageshows': pageshows, 'googleRequestCount': len(state['googleRequests']), 'nativeVendorLoads': loaders, 'inertDiagnosticScripts': diagnostics})
        for _, case_interceptor in interceptors:
            case_interceptor.assert_ok()
        report['passed'] = True
except Exception as error:
    report['error'] = str(error)
    raise
finally:
    if interceptors:
        report['interceptedRequests'] = sum(case_interceptor.request_count for _, case_interceptor in interceptors)
        report['interceptorErrors'] = [dict(error, case=name) for name, case_interceptor in interceptors for error in case_interceptor.errors]
    (OUT/'result.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))
