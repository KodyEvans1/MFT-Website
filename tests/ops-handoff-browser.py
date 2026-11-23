"""Actual website controller; intercepted Ops receipt and native scheduling.

Every browser DNS lookup is denied. Google is deliberately blocked. An in-memory
receiver models idempotent receipt; production database proof is separate.
"""
import importlib.util
import json
import mimetypes
import re
import time
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright, expect
from scheduling_confirmation_fixture import acknowledge_scheduling_dialog
from ops_handoff_fixture import ENDPOINT, is_handoff_request, validate_handoff, accept_handoff

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/ops-handoff'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.mft.care'
REQUEST = 'https://marriagefamilytherapy.clientsecure.me/request'
SIGN_IN = 'https://marriagefamilytherapy.clientsecure.me/sign-in'
CONSENT = 'mft.analytics.consent.v4'
SOURCE = 'mft.analytics.source.v1'
PRIMARY = 'a[data-marketing-appointment="primary"]'
FREE = '.mh-hero a[data-mft-ten-minute-consultation="true"]'
PAID = '?utm_source=google&utm_medium=cpc&utm_campaign_id=24530528782&utm_adgroup_id=202031516078&utm_creative_id=701234567890&gclid=secret-click&utm_term=private-canary&email=private-canary%40example.invalid'
CSP = re.search(r'Content-Security-Policy: ([^\n]+)', (ROOT / 'dist/_headers').read_text())[1]
spec = importlib.util.spec_from_file_location('mft_scheduling_harness', ROOT / 'tests/scheduling-browser-harness.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
report = {'passed': False, 'checks': [], 'scope': 'Built production-origin candidate; real website controller and trusted UI actions; all Ops, Google and SimplePractice traffic intercepted with DNS denied. Synthetic Ops receipt is not production receipt or SimplePractice verification.'}
active = None
interceptor = None


def guard(route):
    req = route.request
    url = urlsplit(req.url)
    if is_handoff_request(req):
        payload = validate_handoff(req)
        active.deliveries.append(payload)
        if active.mode == 'unavailable':
            route.abort()
            return
        active.records.setdefault(payload['eventId'], payload)
        if active.mode == 'lost-response' and len(active.deliveries) == 1:
            route.abort()  # Modeled receipt succeeded, but the client lost its response.
            return
        accept_handoff(route)
    elif url.hostname == 'www.mft.care' and req.method in ['GET', 'HEAD']:
        if active and active.mode == 'missing-controller' and url.path == '/assets/mft-analytics.js':
            route.abort()
            return
        file = ROOT / 'dist' / url.path.lstrip('/')
        if url.path.endswith('/') or not file.suffix:
            file = file / 'index.html'
        if not file.is_file():
            route.fulfill(status=404, body='Not found')
            return
        route.fulfill(status=200, body=file.read_bytes(), headers={
            'Content-Type': mimetypes.guess_type(str(file))[0] or 'application/octet-stream',
            'Content-Security-Policy': CSP, 'Referrer-Policy': 'no-referrer'})
    elif url.hostname in ['marriagefamilytherapy.clientsecure.me', 'clientsecure.me'] and req.method == 'GET' and req.is_navigation_request():
        active.destinations.append(req.url)
        route.fulfill(status=200, content_type='text/html', body='<!doctype html><title>Intercepted scheduler</title><link rel="icon" href="data:,"><h1>Intercepted scheduler</h1>')
    else:
        route.abort()
        if url.hostname in ['www.google-analytics.com', 'region1.google-analytics.com']:
            raise AssertionError('Blocked Google library must not produce a Google collector request')


class Case:
    def __init__(self, browser, path='/new-page/', consent='granted', mode=None, signal=None, viewport=None):
        global active
        self.mode = mode
        self.deliveries, self.records, self.destinations, self.errors = [], {}, [], []
        self.context = browser.new_context(viewport=viewport or {'width': 1440, 'height': 1000}, reduced_motion='reduce')
        if consent is not None:
            self.context.add_init_script('if(window.top===window && location.origin===' + json.dumps(BASE) + ')localStorage.setItem(' + json.dumps(CONSENT) + ',' + json.dumps(consent) + ')')
        if signal:
            value = 'true' if signal == 'globalPrivacyControl' else '"1"'
            self.context.add_init_script('Object.defineProperty(Navigator.prototype,' + json.dumps(signal) + ',{get:()=>'+value+'})')
        self.context.on('page', lambda p: p.on('pageerror', lambda error: self.errors.append(str(error))))
        active = self
        self.page = self.context.new_page()
        self.page.goto(BASE + path, wait_until='domcontentloaded')
        assert self.page.locator('script[data-mft-measurement-id]').get_attribute('data-mft-handoff-endpoint') == ENDPOINT

    def open(self, selector=PRIMARY):
        link = self.page.locator(selector).first
        link.focus()
        self.page.keyboard.press('Enter')
        return self.page.locator('dialog.mft-consultation-gate[open]')

    def go(self, expected=REQUEST):
        go = acknowledge_scheduling_dialog(self.page)
        assert go is not None and go.get_attribute('href') == expected
        started = time.monotonic()
        go.click()
        self.page.wait_for_url(expected)
        assert time.monotonic() - started < 1.5, 'Measurement delayed native scheduling'

    def wait(self, deliveries=1):
        deadline = time.monotonic() + 8
        while len(self.deliveries) < deliveries and time.monotonic() < deadline:
            self.page.wait_for_timeout(50)
            interceptor.assert_ok()
        assert len(self.deliveries) == deliveries, {'expected': deliveries, 'received': len(self.deliveries)}

    def zero(self):
        self.page.wait_for_timeout(150)
        assert not self.deliveries and not self.records

    def close(self):
        interceptor.assert_ok()
        assert not self.errors, self.errors
        self.context.close()


def checked(name):
    interceptor.assert_ok()
    assert not active.errors, active.errors
    report['checks'].append({'name': name, 'pass': True})


try:
    with sync_playwright() as playwright:
        browser = harness.launch_isolated_chromium(playwright)
        interceptor = harness.install_browser_interceptor(browser, guard)

        # Use the real consent UI and pointer clicks, without seeded consent or
        # forced clicks. The former tall notice blocked the mobile hero button.
        for choice, width, height in [('dismiss', 390, 950), ('deny', 390, 950), ('grant', 390, 950), ('dismiss', 320, 568), ('dismiss', 844, 390), ('dismiss', 320, 320)]:
            case = Case(browser, path='/', consent=None, viewport={'width': width, 'height': height})
            notice = case.page.get_by_role('dialog', name='Analytics privacy choice')
            expect(notice).to_be_visible()
            for name in ['Close analytics notice', 'Decline', 'Allow analytics']:
                expect(notice.get_by_role('button', name=name, exact=True)).to_be_in_viewport(ratio=1)
            disclosure = notice.get_by_role('region', name='How optional analytics work')
            disclosure.focus()
            expect(disclosure).to_be_focused()
            if disclosure.evaluate('(el)=>el.scrollHeight>el.clientHeight'):
                case.page.keyboard.press('End')
                case.page.wait_for_function('document.querySelector("#mft-analytics-consent p").scrollTop>0')
            if choice == 'dismiss':
                case.page.screenshot(path=str(OUT / f'consent-{width}x{height}.png'))
            # At the mobile sizes that regressed, scheduling remains clickable
            # with the notice open. Shorter/zoomed layouts offer visible Close,
            # Decline and Allow controls before continuing to the page.
            if height >= 568:
                case.page.locator(FREE).click()
                gate = case.page.locator('dialog.mft-consultation-gate[open]')
                expect(gate).to_be_visible()
                expect(notice).to_be_hidden()
                case.zero()
                gate.get_by_role('button', name='Cancel', exact=True).click()
                expect(notice).to_be_visible()
            case.zero()
            notice.locator('[data-choice="' + choice + '"]').click()
            expect(notice).to_have_count(0)
            expected_consent = {'dismiss': 'unset', 'deny': 'denied', 'grant': 'granted'}[choice]
            assert case.page.evaluate('window.MFTAnalyticsConsent.status()') == expected_consent
            assert case.page.evaluate('key=>localStorage.getItem(key)', CONSENT) == (None if choice == 'dismiss' else expected_consent)
            case.zero()
            settings = case.page.get_by_role('button', name='Analytics choices', exact=True)
            settings.click()
            expect(notice).to_be_visible()
            notice.get_by_role('button', name='Close analytics notice').press('Enter')
            expect(settings).to_be_focused()
            assert case.page.evaluate('window.MFTAnalyticsConsent.status()') == expected_consent
            assert case.page.evaluate('key=>localStorage.getItem(key)', CONSENT) == (None if choice == 'dismiss' else expected_consent)
            case.zero()
            case.page.locator(FREE).click()
            case.zero()
            case.go()
            if choice == 'grant':
                case.wait()
                assert len(case.records) == 1
            else:
                case.zero()
            assert case.destinations == [REQUEST]
            checked(f'Visible {choice} choice at {width}x{height}: accessible notice, pointer scheduling, zero on open/cancel, ' + ('one consented handoff' if choice == 'grant' else 'no collection'))
            case.close()

        case = Case(browser, '/new-page/' + PAID)
        original_source = case.page.evaluate('key => JSON.parse(sessionStorage.getItem(key))', SOURCE)
        gate = case.open()
        case.zero()
        gate.locator('[data-mft-account-ack]').check()
        case.zero()
        gate.get_by_role('button', name='Cancel', exact=True).click()
        case.zero()
        case.open().get_by_role('button', name='Close', exact=True).click()
        case.zero()
        case.open()
        case.page.keyboard.press('Escape')
        case.zero()
        checked('Opening, acknowledgment alone, Cancel, Close and Escape produce zero first-party handoffs')
        case.open()
        case.go()
        case.wait()
        first = case.deliveries[0]
        assert len(case.records) == 1 and case.destinations == [REQUEST]
        assert first['source'] == 'google' and first['medium'] == 'cpc' and first['campaignId'] == '24530528782'
        assert first['placement'] == 'dialog'
        checked('Enabled native Continue produces one minimized paid-source handoff even while Google is blocked')
        case.page.goto(BASE + '/new-page/', wait_until='domcontentloaded')
        case.page.locator('header a[href="/team/"]').click()
        case.page.wait_for_url(BASE + '/team/')
        saved = case.page.evaluate('key => JSON.parse(sessionStorage.getItem(key))', SOURCE)
        assert saved['campaignId'] == '24530528782' and saved['expiresAt'] == original_source['expiresAt']
        new_page_code = case.page.locator('script[data-mft-page-key]').get_attribute('data-mft-page-key')
        assert case.page.evaluate("localStorage.getItem('mft.newClientAccountAcknowledgment.v1')") == 'acknowledged'
        # Team's header is a free consultation and correctly keeps its transient
        # notice. Use the existing ordinary request to test remembered bypass.
        link = case.page.locator('footer a[data-mft-booking="true"]:not([data-mft-couples-consultation]):not([data-mft-ten-minute-consultation])').first
        link.click()
        case.page.wait_for_url(REQUEST)
        case.wait(2)
        assert len(case.records) == 2 and case.deliveries[1]['eventId'] != first['eventId']
        assert case.deliveries[1]['campaignId'] == '24530528782' and case.deliveries[1]['pageCode'] == new_page_code
        assert case.deliveries[1]['placement'] == 'footer'
        checked('Remembered account acknowledgment still measures a new eligible activation and preserves paid source across internal navigation')
        case.close()

        case = Case(browser, path='/')
        gate = case.open(FREE)
        assert gate.locator('[data-mft-account-ack]').is_visible() and gate.locator('[data-mft-consultation-ack]').is_visible()
        gate.locator('[data-mft-account-ack]').check()
        case.zero()
        assert gate.locator('[data-consultation-continue]').get_attribute('href') is None
        case.go()
        case.wait()
        assert len(case.records) == 1
        checked('Combined consultation diagnostics and acknowledgment are excluded; only final Continue reaches first-party receipt')
        case.close()

        case = Case(browser)
        case.open()
        go = acknowledge_scheduling_dialog(case.page)
        # Keep this test dialog open for two trusted clicks. Test-only final
        # preventDefault stops navigation after the product listener; the native
        # navigation assertion is exercised independently above.
        case.page.evaluate('''() => {
          const go=document.querySelector('[data-consultation-continue]');
          const original=window.setTimeout,held=[];
          window.setTimeout=(fn,delay,...args)=>{if(delay===0){held.push(()=>fn(...args));return -1;}return original(fn,delay,...args);};
          window.__restoreHandoffTest=()=>{window.setTimeout=original;for(const fn of held)fn();};
          go.addEventListener('click',event=>event.preventDefault());
        }''')
        go.dblclick()
        case.wait()
        assert len(case.records) == 1 and not case.destinations
        expect(case.page.locator('dialog.mft-consultation-gate[open]')).to_be_visible()
        case.page.evaluate('window.__restoreHandoffTest()')
        checked('Two trusted Continue activations within the same held-open dialog produce one first-party handoff total')
        case.close()

        case = Case(browser, '/new-page/' + PAID, mode='lost-response')
        case.open()
        go = acknowledge_scheduling_dialog(case.page)
        with case.context.expect_page() as popup:
            go.click(modifiers=['Control'])
        popup.value.wait_for_url(REQUEST)
        case.wait(2)
        assert case.deliveries[0] == case.deliveries[1] and len(case.records) == 1
        assert case.destinations == [REQUEST]
        checked('A lost first-party response retries the identical ID, UTC timestamp and source; synthetic idempotent receipt stores one record')
        case.close()

        case = Case(browser)
        case.page.locator('a[data-mft-existing-client="true"]').first.click()
        case.page.wait_for_url(SIGN_IN)
        case.zero()
        assert case.destinations == [SIGN_IN]
        checked('Existing-client sign-in remains separate and produces no first-party handoff')
        case.close()

        for consent, signal in [(None, None), ('denied', None), ('granted', 'globalPrivacyControl'), ('granted', 'doNotTrack')]:
            case = Case(browser, consent=consent, signal=signal)
            case.open()
            case.go()
            case.zero()
            assert case.destinations == [REQUEST]
            checked('Native scheduling works without first-party collection: ' + str(signal or consent or 'unset consent'))
            case.close()

        for mode in ['unavailable', 'missing-controller']:
            case = Case(browser, mode=mode)
            case.open()
            case.go()
            assert case.destinations == [REQUEST] and not case.records
            if mode == 'unavailable':
                case.wait()
            else:
                case.zero()
            checked('Native scheduling is independent of ' + mode)
            case.close()

        for slug, clinician in [('emily-johnsrud-bio', '2027366'), ('gary-ashley', '2154633'), ('sonia-hassan-bio', '2065412'), ('autumn-alexander', '2183370')]:
            case = Case(browser, '/' + slug + '/')
            selector = 'main a[data-spwidget-clinician-id="' + clinician + '"]'
            expected = case.page.locator(selector).first.get_attribute('href')
            assert parse_qs(urlsplit(expected).query)['clinicianId'] == [clinician]
            case.open(selector)
            case.go(expected)
            case.wait()
            assert case.destinations == [expected] and clinician not in json.dumps(case.deliveries)
            checked('Native clinician destination preserved without identity in first-party envelope: ' + slug)
            case.close()

        case = Case(browser, '/new-page/' + PAID)
        saved = case.page.evaluate('key => JSON.parse(sessionStorage.getItem(key))', SOURCE)
        case.page.goto(BASE + '/new-page/', wait_until='domcontentloaded')
        assert case.page.evaluate('key => JSON.parse(sessionStorage.getItem(key)).expiresAt', SOURCE) == saved['expiresAt']
        case.page.evaluate('(expiry) => {Date.now=()=>expiry}', saved['expiresAt'])
        case.open()
        case.go()
        case.wait()
        assert case.deliveries[0]['source'] == 'direct' and case.deliveries[0]['medium'] == 'none' and 'campaignId' not in case.deliveries[0]
        checked('First-party collection enforces the original 30-minute source deadline even when the expiry timer is throttled')
        case.close()

        case = Case(browser, '/new-page/' + PAID)
        case.page.locator('.mft-analytics-settings').click()
        case.page.locator('[data-choice="deny"]').click()
        assert case.page.evaluate('key=>sessionStorage.getItem(key)', SOURCE) is None
        case.open()
        case.go()
        case.zero()
        checked('Consent withdrawal clears source state and prevents first-party handoffs while scheduling stays usable')
        case.close()

        browser.close()
        interceptor.assert_ok()
    report['passed'] = True
except Exception as error:
    report['error'] = str(error)
    if active:
        report['failure'] = {'deliveries': active.deliveries, 'destinations': active.destinations, 'pageErrors': active.errors}
        try:
            active.page.screenshot(path=str(OUT / 'failure.png'))
        except Exception:
            pass
    raise
finally:
    if interceptor:
        report['interceptorErrors'] = interceptor.errors
        report['interceptedRequests'] = interceptor.request_count
    (OUT / 'result.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
