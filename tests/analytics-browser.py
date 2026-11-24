"""Nonconverting privacy verification, including optional read-only live assets.

Browser DNS is denied. Candidate files or allowlisted public GETs are supplied
by the verifier. Google, Ops POSTs and scheduler requests are never sent.
"""
import hashlib
import importlib.util
import json
import mimetypes
import os
import re
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from playwright.sync_api import sync_playwright, expect
from measurement_privacy_fixture import (
    CONSENT, CONTROLLER, ADVERTISING_CONSENT, is_google_url, request_summary,
    assert_advertising_unavailable, assert_no_google_cookies, assert_no_google_dom,
    assert_no_raw_identifier_storage,
)
from scheduling_confirmation_fixture import acknowledge_scheduling_dialog

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/analytics-browser'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.mft.care'
LIVE = os.getenv('MFT_ANALYTICS_LIVE') == 'true'
CSP = re.search(r'Content-Security-Policy: ([^\n]+)', (ROOT / 'dist/_headers').read_text())[1]
spec = importlib.util.spec_from_file_location('mft_scheduling_harness', ROOT / 'tests/scheduling-browser-harness.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
report = {'pass': False, 'live': LIVE, 'checks': [], 'googleRequests': [], 'handoffRequests': [],
          'scope': 'Nonconverting verification. All browser DNS denied. Only public website GETs may be fetched in live mode. No Google requests, Ops receipts, SimplePractice navigation or appointments are authorized.'}
interceptor = None
errors = []
public_cache = {}


class PublicOnlyRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, newurl):
        target = urlsplit(newurl)
        assert target.scheme == 'https' and target.netloc == 'www.mft.care', 'Refusing an external public-resource redirect'
        return super().redirect_request(request, response, code, message, headers, newurl)


public_reader = build_opener(PublicOnlyRedirect())


def public_get(path):
    if path not in public_cache:
        with public_reader.open(Request(BASE + path, headers={'Cache-Control': 'no-cache'}), timeout=20) as response:
            assert urlsplit(response.url).hostname == 'www.mft.care', 'Unexpected public resource redirect'
            public_cache[path] = (response.status, response.read(), {
                key: value for key, value in response.headers.items()
                if key.lower() in {'content-type', 'content-security-policy', 'referrer-policy', 'cache-control'}
            })
    return public_cache[path]


def guard(route):
    request = route.request
    url = urlsplit(request.url)
    if is_google_url(request.url):
        report['googleRequests'].append(request_summary(request))
        route.abort()
        raise AssertionError('Google must not be requested in any consent state')
    if url.hostname == 'ops.mft.care':
        report['handoffRequests'].append(request_summary(request))
        route.abort()
        raise AssertionError('The nonconverting verifier must not attempt an Ops handoff')
    if url.hostname == 'www.mft.care' and request.method in {'GET', 'HEAD'}:
        if LIVE:
            status, body, headers = public_get(url.path + ('?' + url.query if url.query else ''))
            route.fulfill(status=status, body=body, headers=headers)
            return
        file = ROOT / 'dist' / url.path.lstrip('/')
        if url.path.endswith('/') or not file.suffix:
            file = file / 'index.html'
        if not file.is_file():
            route.fulfill(status=404, body='Not found')
            return
        route.fulfill(status=200, body=file.read_bytes(), headers={
            'Content-Type': mimetypes.guess_type(str(file))[0] or 'application/octet-stream',
            'Content-Security-Policy': CSP, 'Referrer-Policy': 'no-referrer',
        })
        return
    route.abort()
    if url.hostname in {'clientsecure.me', 'marriagefamilytherapy.clientsecure.me'}:
        raise AssertionError('The nonconverting verifier must not navigate to SimplePractice')


def record(name, page=None, context=None):
    interceptor.assert_ok()
    assert not errors, errors
    assert not report['googleRequests'] and not report['handoffRequests']
    if page:
        assert_no_google_dom(page)
        assert_no_raw_identifier_storage(page)
        if page.locator(CONTROLLER).count():
            assert_advertising_unavailable(page)
    if context:
        assert_no_google_cookies(context)
    report['checks'].append({'name': name, 'pass': True})


def new_context(browser, width=1440, height=1000, seed=None, signal=None):
    context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce')
    if seed:
        context.add_init_script('if(location.origin===' + json.dumps(BASE) + '){for(const [key,value] of ' +
                                json.dumps(list(seed.items())) + ')localStorage.setItem(key,value)}')
    if signal:
        value = 'true' if signal == 'globalPrivacyControl' else '"1"'
        context.add_init_script('Object.defineProperty(Navigator.prototype,' + json.dumps(signal) + ',{get:()=>'+value+'})')
    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
    return context


try:
    if LIVE:
        version = hashlib.sha256((ROOT / 'src/assets/mft-analytics.js').read_bytes()).hexdigest()[:16]
        deadline = time.monotonic() + 180
        while True:
            try:
                public_cache.clear()
                status, body, _ = public_get('/')
                assert status == 200 and '/assets/mft-analytics.js?v=' + version in body.decode()
                _, script, _ = public_get('/assets/mft-analytics.js?v=' + version)
                assert script == (ROOT / 'src/assets/mft-analytics.js').read_bytes()
                _, raw, _ = public_get('/reports/analytics-integration.json')
                integration = json.loads(raw)
                assert integration['enabled'] is False and integration['googlePages'] == []
                report['matchingPublishedAssets'] = True
                report['assetVersion'] = version
                break
            except Exception:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(6)
    with sync_playwright() as playwright:
        browser = harness.launch_isolated_chromium(playwright)
        interceptor = harness.install_browser_interceptor(browser, guard)
        context = new_context(browser)
        page = context.new_page()
        path = '/' if LIVE else '/?gclid=secret-click&gbraid=secret-click&wbraid=secret-click&email=private-canary%40example.invalid'
        page.goto(BASE + path, wait_until='domcontentloaded')
        expect(page.locator('#mft-analytics-consent')).to_be_visible()
        page.wait_for_timeout(350)
        assert page.locator(CONTROLLER).get_attribute('data-mft-google-mode') == 'disabled'
        record('Before consent: no Google resources, cookies, requests or handoff', page, context)
        page.locator('[data-choice="deny"]').click()
        page.reload(wait_until='domcontentloaded')
        assert page.locator('#mft-analytics-consent').count() == 0
        assert page.evaluate('window.MFTAnalyticsConsent.status()') == 'denied'
        record('Refusal persists without Google or Ops collection', page, context)
        page.get_by_role('button', name='Analytics choices', exact=True).click()
        notice = page.get_by_role('dialog', name='Analytics privacy choice')
        assert 'Google' in notice.inner_text() and 'disabled' in notice.inner_text().lower()
        notice.get_by_role('button', name='Allow analytics', exact=True).click()
        page.wait_for_timeout(500)
        assert page.evaluate('window.MFTAnalyticsConsent.status()') == 'granted'
        assert page.locator('iframe').count() == 0
        record('First-party analytics permission does not load Google or create a pageview', page, context)
        page.evaluate("""() => {
          const form=document.createElement('form');form.id='privacy-synthetic-form';
          form.innerHTML='<input name="email" value="private-canary@example.invalid"><button>Test</button>';
          form.addEventListener('submit',event=>event.preventDefault());document.body.append(form);
          form.querySelector('input').dispatchEvent(new Event('change',{bubbles:true}));
          form.dispatchEvent(new Event('submit',{bubbles:true}));
          history.pushState({},'', '?q=private-canary&email=private-canary%40example.invalid');
          window.scrollTo(0,document.body.scrollHeight);
          const link=document.createElement('a');link.href='https://example.invalid/private-canary';
          link.addEventListener('click',event=>event.preventDefault());document.body.append(link);link.click();
          form.remove();link.remove();history.replaceState({},'', '/');
        }""")
        page.wait_for_timeout(350)
        record('Forms, history, search, scrolling and outbound diagnostics send no Google event', page, context)
        page.get_by_role('button', name='Analytics choices', exact=True).click()
        page.locator('[data-choice="deny"]').click()
        page.wait_for_timeout(350)
        record('Withdrawal leaves Google disabled and measurement cookies cleared', page, context)
        context.close()

        for signal in ['globalPrivacyControl', 'doNotTrack']:
            context = new_context(browser, seed={CONSENT: 'granted', ADVERTISING_CONSENT: 'granted'}, signal=signal)
            page = context.new_page(); page.goto(BASE + '/', wait_until='domcontentloaded')
            assert page.evaluate('window.MFTAnalyticsConsent.status()') == 'denied'
            record(signal + ' overrides stored permission; advertising remains unavailable', page, context)
            context.close()

        for path in ['/check-my-coverage/', '/marriage-reset-assessment/', '/start/', '/marriagereset/']:
            context = new_context(browser, seed={CONSENT: 'granted'})
            page = context.new_page(); page.goto(BASE + path, wait_until='domcontentloaded')
            assert page.locator(CONTROLLER).count() == 0
            record('Excluded route has no controller or Google resource: ' + path, page, context)
            context.close()

        for width, height in [(390, 844), (320, 568), (844, 390)]:
            context = new_context(browser, width, height)
            page = context.new_page(); page.goto(BASE + '/', wait_until='domcontentloaded')
            notice = page.get_by_role('dialog', name='Analytics privacy choice')
            for name in ['Close analytics notice', 'Decline', 'Allow analytics']:
                expect(notice.get_by_role('button', name=name, exact=True)).to_be_in_viewport(ratio=1)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(OUT / f'consent-{width}x{height}.png'))
            notice.get_by_role('button', name='Decline', exact=True).click()
            page.locator('.mh-hero a[data-mft-ten-minute-consultation="true"]').click()
            gate = page.locator('dialog.mft-consultation-gate[open]')
            expect(gate).to_be_visible()
            go = acknowledge_scheduling_dialog(page)
            assert go is not None and go.get_attribute('href') == 'https://marriagefamilytherapy.clientsecure.me/request'
            gate.get_by_role('button', name='Cancel', exact=True).click()
            expect(gate).to_have_count(0)
            record(f'{width}x{height}: visible notice, popup and acknowledgment/cancel remain nonconverting', page, context)
            context.close()
        browser.close()
        interceptor.assert_ok()
    report['pass'] = True
except Exception as error:
    report['error'] = str(error)
    try:
        page.screenshot(path=str(OUT / 'failure.png'))
    except Exception:
        pass
    raise
finally:
    if interceptor:
        report['interceptorErrors'] = interceptor.errors
        report['interceptedRequests'] = interceptor.request_count
    (OUT / 'result.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
