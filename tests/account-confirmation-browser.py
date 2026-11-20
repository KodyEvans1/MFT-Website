"""Synthetic account acknowledgment checks; all external requests are intercepted."""
import importlib.util
import json
import mimetypes
import re
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright, expect
from scheduling_confirmation_fixture import acknowledge_scheduling_dialog

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/account-confirmation'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.mft.care'
REQUEST = 'https://marriagefamilytherapy.clientsecure.me/request'
SIGN_IN = 'https://marriagefamilytherapy.clientsecure.me/sign-in'
ACK = 'mft.newClientAccountAcknowledgment.v1'
CONSENT = 'mft.analytics.consent.v4'
PRIMARY = 'a[data-marketing-appointment="primary"]'
FREE = '.mh-hero a[data-mft-ten-minute-consultation="true"]'
CSP = re.search(r'Content-Security-Policy: ([^\n]+)', (ROOT / 'dist/_headers').read_text())[1]
spec = importlib.util.spec_from_file_location('mft_scheduling_harness', ROOT / 'tests/scheduling-browser-harness.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
report = {'passed': False, 'checks': [], 'scope': 'Production-origin built candidate; synthetic measurement observer; browser DNS denied and all external requests intercepted. No Google hits, appointments, account creation or patient data.'}
active = None
interceptor = None


def guard(route):
    request = route.request
    url = urlsplit(request.url)
    if url.hostname == 'www.mft.care' and request.method in ['GET', 'HEAD']:
        if active and active.mode == 'blocked-booking' and url.path == '/assets/mft-booking.js':
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
    elif url.hostname in ['marriagefamilytherapy.clientsecure.me', 'clientsecure.me'] and request.method == 'GET' and request.is_navigation_request():
        active.destinations.append(request.url)
        route.fulfill(status=200, content_type='text/html', body='<!doctype html><title>Intercepted scheduler</title><link rel="icon" href="data:,"><h1>Scheduling navigation intercepted</h1>')
    else:
        if active and url.hostname == 'www.googletagmanager.com':
            active.google_loads.append(request.url)
        route.abort()
        if url.hostname in ['www.google-analytics.com', 'region1.google-analytics.com']:
            raise AssertionError('Focused UI tests must not produce a Google collector request')


class Case:
    def __init__(self, browser, path='/new-page/', width=1440, consent=None, acknowledgment=None, storage=None, mode=None, signal=None, javascript=True):
        global active
        self.mode = mode
        self.events, self.errors, self.destinations, self.google_loads = [], [], [], []
        self.context = browser.new_context(viewport={'width': width, 'height': 844}, reduced_motion='reduce', java_script_enabled=javascript)
        self.context.on('page', self.observe)
        if consent is not None:
            self.context.add_init_script('if (window.top===window && location.origin===' + json.dumps(BASE) + ') localStorage.setItem(' + json.dumps(CONSENT) + ',' + json.dumps(consent) + ')')
        if acknowledgment is not None:
            self.context.add_init_script('if (window.top===window && location.origin===' + json.dumps(BASE) + ') localStorage.setItem(' + json.dumps(ACK) + ',' + json.dumps(acknowledgment) + ')')
        if storage:
            self.context.add_init_script('''(() => {
                const key = %s, get = Storage.prototype.getItem, set = Storage.prototype.setItem;
                Storage.prototype.getItem = function(k) { if(k===key) throw new DOMException('Synthetic blocked storage','SecurityError'); return get.call(this,k); };
                Storage.prototype.setItem = function(k,v) { if(k===key) throw new DOMException('Synthetic blocked storage','QuotaExceededError'); return set.call(this,k,v); };
            })()''' % json.dumps(ACK))
        if mode == 'missing-dialog':
            self.context.add_init_script('HTMLDialogElement.prototype.showModal=undefined')
        if mode == 'throwing-dialog':
            self.context.add_init_script("HTMLDialogElement.prototype.showModal=function(){throw new Error('Synthetic unsupported dialog')}")
        if signal:
            value = 'true' if signal == 'globalPrivacyControl' else "'1'"
            self.context.add_init_script('Object.defineProperty(Navigator.prototype,' + json.dumps(signal) + ',{get:()=>'+value+'})')
        active = self
        self.page = self.context.new_page()
        self.visit(path, javascript=javascript)

    def observe(self, page):
        def console(message):
            if message.text.startswith('MFT_TEST_MEASURE '):
                self.events.append(json.loads(message.text[len('MFT_TEST_MEASURE '):]))
        page.on('console', console)
        page.on('pageerror', lambda error: self.errors.append(str(error)))

    def visit(self, path, javascript=True):
        self.page.goto(BASE + path, wait_until='domcontentloaded')
        if javascript:
            self.page.evaluate('''mode => {
                window.MFTSchedulingMeasurement = {track(names, placement) {
                    console.info('MFT_TEST_MEASURE '+JSON.stringify({names,placement}));
                    if(mode==='throwing-measurement') throw new Error('Synthetic optional measurement failure');
                    if(mode==='stalled-measurement') return new Promise(()=>{});
                }};
                if(mode==='missing-measurement') delete window.MFTSchedulingMeasurement;
            }''', self.mode)

    def value(self, key):
        return self.page.evaluate("key => {try{return localStorage.getItem(key)}catch{return 'storage-blocked'}}", key)

    def gate(self):
        return self.page.locator('dialog.mft-consultation-gate')

    def names(self):
        return [name for event in self.events for name in event['names']]

    def close(self):
        assert not self.errors, self.errors
        interceptor.assert_ok()
        self.context.close()


def checked(name):
    interceptor.assert_ok()
    assert not active.errors, active.errors
    report['checks'].append({'name': name, 'pass': True})


def no_handoff(case):
    assert not case.destinations
    assert 'simplepractice_exit' not in case.names()


def finish(case, expected=REQUEST):
    go = acknowledge_scheduling_dialog(case.page)
    assert go is not None and go.get_attribute('href') == expected
    go.click()
    case.page.wait_for_url(expected)
    expect(case.page.get_by_role('heading', name='Scheduling navigation intercepted')).to_be_visible()
    assert case.destinations[-1] == expected


try:
    analytics = json.loads((ROOT / 'dist/reports/analytics-integration.json').read_text())
    marketing = json.loads((ROOT / 'dist/reports/marketing-review.json').read_text())
    publication = json.loads((ROOT / 'dist/reports/publication.json').read_text())
    assert analytics['enabled'] is True and analytics['finalVerified'] is True
    assert len(analytics['injected']) == 60 and len(analytics['finalPages']) == 60
    assert marketing['revision'] == marketing['recordedRevision'] == 'a0384330504791dd1d536059871befc45672776d2a24df8acee4ef4c231a1c36'
    assert marketing['publicationApproved'] is True
    assert publication['context'] == 'production' and publication['indexingEnabled'] is True
    assert len(publication['expectedSitemapUrls']) == 63
    assert len([item for item in publication['generatedRoutes'] if item['status'] == 'draft']) == 757
    report['buildBaseline'] = {'analyticsPages': 60, 'sitemapUrls': 63, 'draftRoutes': 757, 'marketingApprovalCurrent': True}
    with sync_playwright() as playwright:
        browser = harness.launch_isolated_chromium(playwright)
        interceptor = harness.install_browser_interceptor(browser, guard)
        report['isolation'] = 'Collector DNS preflight failed with ERR_NAME_NOT_RESOLVED before browser-target request interception'

        case = Case(browser, width=320)
        page, gate = case.page, case.gate()
        link = page.locator(PRIMARY)
        expected = link.get_attribute('href')
        banner = page.locator('#mft-analytics-consent')
        expect(banner).to_be_visible()
        link.focus(); page.keyboard.press('Enter')
        expect(gate).to_be_visible()
        assert page.locator('dialog[open]').count() == 1
        expect(gate.locator('h2')).to_be_focused()
        expect(gate.locator('[data-mft-account-ack]')).to_be_visible()
        expect(gate.locator('[data-mft-consultation-ack]')).not_to_be_visible()
        go = gate.locator('[data-consultation-continue]')
        assert go.get_attribute('href') is None and go.get_attribute('aria-disabled') == 'true'
        assert banner.evaluate('(el)=>el.hidden && el.inert && el.getAttribute("aria-hidden")==="true"')
        assert case.value(CONSENT) is None and case.value(ACK) is None and not case.events
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert gate.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
        for step in range(10):
            page.keyboard.press('Tab')
            focus = gate.evaluate('''el => {
                const active = document.activeElement;
                return {tag: active?.tagName || null, id: active?.id || null,
                    role: active?.getAttribute('role') || null,
                    insideDialog: el.contains(active), documentHasFocus: document.hasFocus(),
                    pageRoot: active === document.body || active === document.documentElement};
            }''')
            report.setdefault('tabFocus', []).append({'step': step + 1, **focus})
            # Native dialogs may tab to browser chrome (WHATWG/html#8339).
            # This never permits focus on an interactive background page control.
            assert focus['insideDialog'] or (focus['pageRoot'] and not focus['documentHasFocus']), {
                'error': 'Focus escaped the native modal into the page', 'step': step + 1, 'focus': focus}
        account = gate.locator('[data-mft-account-ack]')
        account.focus(); page.keyboard.press('Space')
        assert account.is_checked() and go.get_attribute('href') == expected
        assert case.value(ACK) is None, 'Checking a box must not persist acknowledgment'
        gate.get_by_role('button', name='Cancel', exact=True).click()
        expect(gate).not_to_be_visible(); expect(link).to_be_focused(); expect(banner).to_be_visible()
        assert banner.evaluate('(el)=>!el.hidden && !el.inert && !el.hasAttribute("aria-hidden")')
        no_handoff(case)
        # Keep this undecided-consent narrow-screen scenario keyboard-driven;
        # the restored privacy banner must remain untouched throughout it.
        link.focus(); page.keyboard.press('Enter'); page.keyboard.press('Escape')
        expect(gate).not_to_be_visible(); expect(link).to_be_focused()
        assert case.value(ACK) is None and case.value(CONSENT) is None and not case.events
        checked('320px keyboard flow, native focus boundaries/restoration, Cancel/Escape, unchanged consent and no premature persistence or events')
        link.focus(); page.keyboard.press('Enter'); go = acknowledge_scheduling_dialog(page)
        page.screenshot(path=str(OUT / 'account-320.png'))
        # An untrusted programmatic activation cannot save or measure. A second
        # listener prevents its native default action solely within this fixture.
        go.evaluate("el=>{el.addEventListener('click',e=>{if(!e.isTrusted)e.preventDefault()});el.click()}")
        assert case.value(ACK) is None and not case.events
        go.focus(); page.keyboard.press('Enter'); page.wait_for_url(expected)
        assert case.names() == ['appointment_request_click', 'simplepractice_exit'] and case.destinations == [expected]
        case.visit('/new-page/')
        assert case.value(ACK) == 'acknowledged' and case.value(CONSENT) is None
        link.focus(); page.keyboard.press('Enter'); page.wait_for_url(expected)
        assert case.names() == ['appointment_request_click', 'simplepractice_exit'] * 2 and len(case.destinations) == 2
        checked('Only a trusted enabled Continue persists; reload reuses the acknowledgment and each native handoff counts once')
        case.close()

        case = Case(browser, width=320, consent='denied')
        page = case.page
        menu = page.locator('.menu-button')
        menu.click()
        link = page.locator('header a[data-mft-booking="true"]').first
        expect(link).to_be_visible(); link.click(); expect(case.gate()).to_be_visible()
        page.keyboard.press('Escape')
        expect(case.gate()).not_to_be_visible(); expect(link).to_be_visible(); expect(link).to_be_focused()
        assert menu.get_attribute('aria-expanded') == 'true'
        no_handoff(case)
        checked('Escape closes the scheduling dialog while preserving the expanded mobile menu and initiating-link focus')
        case.close()

        case = Case(browser, path='/', consent='denied')
        page, gate = case.page, case.gate()
        page.locator(FREE).click()
        expect(gate.locator('[data-mft-account-ack]')).to_be_visible()
        expect(gate.locator('[data-mft-consultation-ack]')).to_be_visible()
        assert page.locator('dialog[open]').count() == 1 and case.names() == ['consultation_click']
        gate.locator('[data-mft-account-ack]').check()
        assert gate.locator('[data-consultation-continue]').get_attribute('href') is None
        gate.get_by_role('button', name='Cancel', exact=True).click(); no_handoff(case)
        assert case.value(ACK) is None
        page.locator(FREE).click(); page.keyboard.press('Escape'); no_handoff(case)
        page.locator(FREE).click(); finish(case)
        assert case.names() == ['consultation_click'] * 3 + ['simplepractice_exit'] and len(case.destinations) == 1
        case.visit('/')
        page.locator(FREE).click()
        expect(gate.locator('[data-mft-account-ack]')).not_to_be_visible()
        expect(gate.locator('[data-mft-consultation-ack]')).to_be_visible()
        assert not gate.locator('[data-mft-consultation-ack]').is_checked()
        assert gate.locator('[data-consultation-continue]').get_attribute('href') is None
        assert case.value(CONSENT) == 'denied' and not case.google_loads
        checked('One combined first-use dialog; consultation remains transient after persistent account acknowledgment; cancel and Escape are not exits')
        case.close()

        for invalid in ['true', '{"acknowledged":true}']:
            case = Case(browser, acknowledgment=invalid, consent='denied')
            case.page.locator(PRIMARY).click(); expect(case.gate()).to_be_visible()
            assert not case.gate().locator('[data-mft-account-ack]').is_checked()
            finish(case); assert case.names() == ['appointment_request_click', 'simplepractice_exit']
            checked('Corrupt acknowledgment is not accepted: ' + invalid)
            case.close()

        case = Case(browser, storage='blocked', consent='denied')
        page = case.page
        page.locator(PRIMARY).click()
        go = acknowledge_scheduling_dialog(page)
        with case.context.expect_page() as popup:
            go.click(modifiers=['Control'])
        popup.value.wait_for_url(REQUEST); expect(case.gate()).not_to_be_visible()
        assert case.value(ACK) == 'storage-blocked'
        with case.context.expect_page() as second:
            page.locator(PRIMARY).click(modifiers=['Control'])
        second.value.wait_for_url(REQUEST)
        assert not case.gate().is_visible() and len(case.destinations) == 2
        assert case.names() == ['appointment_request_click', 'simplepractice_exit'] * 2
        checked('Blocked storage preserves native modified Continue and uses memory acknowledgment for the current document')
        case.close()

        for activation in ['modified', 'middle']:
            case = Case(browser, consent='denied')
            link = case.page.locator(PRIMARY)
            link.click(**({'modifiers': ['Control']} if activation == 'modified' else {'button': 'middle'}))
            expect(case.gate()).to_be_visible()
            assert len(case.context.pages) == 1 and not case.events
            no_handoff(case); finish(case)
            assert case.names() == ['appointment_request_click', 'simplepractice_exit'] and len(case.destinations) == 1
            checked('First-use ' + activation + ' activation still requires acknowledgment before native handoff')
            case.close()

        for slug, clinician, channel in [('emily-johnsrud-bio', '2027366', 'professional_website'), ('autumn-alexander', '2183370', 'client_portal'), ('sonia-hassan-bio', '2065412', 'professional_website')]:
            case = Case(browser, path='/' + slug + '/', consent='denied')
            link = case.page.locator('main a[data-spwidget-clinician-id="' + clinician + '"]').first
            expected = link.get_attribute('href')
            query = parse_qs(urlsplit(expected).query)
            assert query['clinicianId'] == [clinician] and query['channel'] == [channel]
            assert query.get('appearance') == ['{"fullScreen":true}'] and 'serviceId' not in query
            link.click(); expect(case.gate()).to_be_visible(); no_handoff(case)
            finish(case, expected)
            assert case.names().count('simplepractice_exit') == 1 and case.destinations == [expected]
            checked('Account confirmation preserves clinician and full-page channel: ' + slug)
            case.close()

        case = Case(browser, consent='denied')
        case.page.locator('a[data-mft-existing-client="true"]').first.click(); case.page.wait_for_url(SIGN_IN)
        assert case.destinations == [SIGN_IN] and not case.events
        checked('Existing-client sign-in bypasses the acknowledgment and new-client measurement')
        case.close()

        case = Case(browser, consent='denied')
        case.page.locator(PRIMARY).click()
        case.page.evaluate('window.MFTAnalyticsConsent.show()')
        banner = case.page.locator('#mft-analytics-consent')
        expect(banner).to_be_hidden()
        assert banner.evaluate('(el)=>el.hidden && el.inert')
        assert case.value(CONSENT) == 'denied'
        case.page.keyboard.press('Escape'); expect(banner).to_be_visible()
        assert banner.evaluate('(el)=>!el.hidden && !el.inert && !el.hasAttribute("aria-hidden")')
        assert case.value(CONSENT) == 'denied' and not case.google_loads
        no_handoff(case)
        checked('An analytics banner created late is suspended and restored without granting or changing consent')
        case.close()

        for mode in ['missing-dialog', 'throwing-dialog', 'blocked-booking', 'no-javascript']:
            case = Case(browser, mode=mode, consent='denied', javascript=mode != 'no-javascript')
            link = case.page.locator(PRIMARY)
            assert link.get_attribute('href') == REQUEST
            link.click(); case.page.wait_for_url(REQUEST)
            assert case.destinations == [REQUEST] and len(case.context.pages) == 1
            checked('Native scheduling remains usable with ' + mode)
            case.close()

        for mode in ['missing-measurement', 'throwing-measurement', 'stalled-measurement']:
            case = Case(browser, mode=mode, consent='denied')
            case.page.locator(PRIMARY).click()
            go = acknowledge_scheduling_dialog(case.page)
            started = time.monotonic()
            go.click(); case.page.wait_for_url(REQUEST)
            assert time.monotonic() - started < 1.5
            assert case.destinations == [REQUEST]
            checked('Final native Continue does not wait for ' + mode)
            case.close()

        for signal in ['globalPrivacyControl', 'doNotTrack']:
            case = Case(browser, consent='granted', signal=signal)
            case.page.locator(PRIMARY).click(); finish(case)
            assert not case.google_loads
            checked(signal + ' does not prevent the account acknowledgment or native scheduling')
            case.close()

        browser.close()
        interceptor.assert_ok()
    report['passed'] = True
except Exception as error:
    report['error'] = str(error)
    if active:
        report['failure'] = {'events': active.events, 'destinations': active.destinations, 'pageErrors': active.errors}
        try:
            active.page.screenshot(path=str(OUT / 'failure.png'))
        except Exception:
            pass
    raise
finally:
    report['checkedAtUtc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    if interceptor:
        report['interceptorErrors'] = interceptor.errors
        report['interceptedRequests'] = interceptor.request_count
    (OUT / 'result.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
