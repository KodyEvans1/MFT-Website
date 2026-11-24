"""Current controller and retired helpers: no Google sender under any permission.

All browser DNS is denied. Real website UI and source storage are exercised;
Ops and scheduler destinations are intercepted. No vendor library is fetched.
"""
import importlib.util
import json
import mimetypes
import re
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
from measurement_privacy_fixture import (
    CONSENT, ADVERTISING_CONSENT, CONTROLLER, is_google_url, request_summary,
    assert_advertising_unavailable, assert_no_google_cookies, assert_no_google_dom,
    assert_no_raw_identifier_storage,
)
from ops_handoff_fixture import is_handoff_request, validate_handoff, accept_handoff

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/scheduling-measurement'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.mft.care'
SOURCE = 'mft.analytics.source.v1'
CSP = re.search(r'Content-Security-Policy: ([^\n]+)', (ROOT / 'dist/_headers').read_text())[1]
# This isolated fixture deliberately permits scripts/connects, so the retired
# helper's own inactivity is proven independently of production CSP denial.
PROBE_CSP = "default-src 'self'; script-src 'self' https://www.googletagmanager.com; connect-src https:; frame-src 'self'; style-src 'self' 'unsafe-inline'"
spec = importlib.util.spec_from_file_location('mft_scheduling_harness', ROOT / 'tests/scheduling-browser-harness.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
report = {'passed': False, 'checks': [], 'googleRequests': [],
          'scope': 'Production-origin candidate; all browser DNS denied and every external request intercepted. No Google scripts fetched, no production Ops receipt and no SimplePractice request. Old-protocol probes exercise current retired assets, not arbitrary already-running pre-release tabs.'}
deliveries, errors = [], []
interceptor = None


def guard(route):
    request = route.request
    url = urlsplit(request.url)
    if is_google_url(request.url):
        report['googleRequests'].append(request_summary(request))
        route.abort()
        raise AssertionError('Google request attempted by disabled measurement path')
    if is_handoff_request(request):
        deliveries.append(validate_handoff(request))
        accept_handoff(route)
        return
    if url.hostname == 'www.mft.care' and request.method in {'GET', 'HEAD'}:
        if url.path == '/__mft-helper-probe__/':
            route.fulfill(status=200, content_type='text/html', body='<!doctype html><title>Isolated retired-helper probe</title><link rel="icon" href="data:,"><main>Test-only parent</main>',
                          headers={'Content-Security-Policy': PROBE_CSP, 'Referrer-Policy': 'no-referrer'})
            return
        file = ROOT / 'dist' / url.path.lstrip('/')
        if url.path.endswith('/') or not file.suffix:
            file = file / 'index.html'
        if not file.is_file():
            route.fulfill(status=404, body='Not found')
            return
        route.fulfill(status=200, body=file.read_bytes(), headers={
            'Content-Type': mimetypes.guess_type(str(file))[0] or 'application/octet-stream',
            'Content-Security-Policy': PROBE_CSP if url.path == '/assets/mft-ga4-frame.html' else CSP,
            'Referrer-Policy': 'no-referrer',
        })
        return
    route.abort()
    if url.hostname in {'clientsecure.me', 'marriagefamilytherapy.clientsecure.me'}:
        raise AssertionError('This privacy suite does not activate a scheduling handoff; Ops suite tests native Continue separately')


def start(browser, seed=None, path='/', signal=None):
    storage = {'cookies': [], 'origins': [{'origin': BASE, 'localStorage': [
        {'name': key, 'value': value} for key, value in (seed or {}).items()
    ]}]}
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', storage_state=storage)
    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
    if signal:
        value = 'true' if signal == 'globalPrivacyControl' else '"1"'
        context.add_init_script('Object.defineProperty(Navigator.prototype,' + json.dumps(signal) + ',{get:()=>'+value+'})')
    page = context.new_page()
    page.goto(BASE + path, wait_until='domcontentloaded')
    return context, page


def checked(name, page=None, context=None):
    interceptor.assert_ok()
    assert not errors, errors
    assert not report['googleRequests']
    if page:
        assert_no_google_dom(page)
        assert_no_raw_identifier_storage(page)
        if page.locator(CONTROLLER).count():
            assert_advertising_unavailable(page)
    if context:
        assert_no_google_cookies(context)
    report['checks'].append({'name': name, 'pass': True})


try:
    integration = json.loads((ROOT / 'dist/reports/analytics-integration.json').read_text())
    assert integration['enabled'] is False and integration['googlePages'] == []
    assert integration['finalVerified'] is True and integration['controllerPages']
    with sync_playwright() as playwright:
        browser = harness.launch_isolated_chromium(playwright)
        interceptor = harness.install_browser_interceptor(browser, guard)

        cases = [('unset', {}, 'unset'), ('current grant', {CONSENT: 'granted'}, 'granted'),
                 ('current refusal', {CONSENT: 'denied'}, 'denied'),
                 ('v4 Ops grant', {'mft.analytics.consent.v4': 'granted'}, 'granted')]
        for version in ['v2', 'v3']:
            cases.append((version + ' Google-only grant', {'mft.analytics.consent.' + version: 'granted'}, 'unset'))
        for version in ['v2', 'v3', 'v4']:
            cases.append((version + ' refusal', {'mft.analytics.consent.' + version: 'denied'}, 'denied'))
        for label, seed, expected in cases:
            seed = {**seed, ADVERTISING_CONSENT: 'granted'}
            context, page = start(browser, seed)
            assert page.evaluate('window.MFTAnalyticsConsent.status()') == expected
            assert page.locator('#mft-analytics-consent').count() == (1 if expected == 'unset' else 0)
            if label == 'v4 Ops grant':
                assert page.evaluate('key=>localStorage.getItem(key)', CONSENT) == 'granted'
            page.wait_for_timeout(200)
            checked(label + ': exact permission migration, advertising unavailable, zero Google requests', page, context)
            context.close()

        context, page = start(browser)
        page.locator('[data-choice="grant"]').click()
        assert page.evaluate('key=>localStorage.getItem(key)', CONSENT) == 'granted'
        assert page.evaluate("['v2','v3','v4'].map(v=>localStorage.getItem('mft.analytics.consent.'+v))") == [None, None, None]
        page.get_by_role('button', name='Analytics choices', exact=True).click()
        page.locator('[data-choice="deny"]').click()
        assert page.evaluate("['v2','v3','v4','v5'].map(v=>localStorage.getItem('mft.analytics.consent.'+v))") == ['denied'] * 4
        checked('New permission never flows backward; withdrawal propagates refusal to older tabs', page, context)
        context.close()

        for campaign, path in [('24530528782', '/emily-johnsrud-bio/'), ('24524392745', '/autumn-alexander/')]:
            suffix = '?utm_source=google&utm_medium=cpc&utm_campaign_id=' + campaign + '&utm_adgroup_id=202031516078&utm_creative_id=701234567890&gclid=secret-click&gbraid=secret-click&wbraid=secret-click&utm_term=private-canary'
            context, page = start(browser, path=path + suffix)
            assert page.evaluate('key=>sessionStorage.getItem(key)', SOURCE) is None
            page.locator('[data-choice="grant"]').click()
            saved = page.evaluate('key=>JSON.parse(sessionStorage.getItem(key))', SOURCE)
            assert set(saved) == {'source', 'medium', 'campaignId', 'expiresAt'}
            assert saved['source'] == 'google' and saved['medium'] == 'cpc' and saved['campaignId'] == campaign
            page.goto(BASE + '/team/', wait_until='domcontentloaded')
            assert page.evaluate('key=>JSON.parse(sessionStorage.getItem(key))', SOURCE) == saved
            before = len(deliveries)
            page.evaluate("window.MFTSchedulingMeasurement.track(['consultation_click','clinician_schedule_click','appointment_request_click'],'body')")
            page.wait_for_timeout(250)
            assert len(deliveries) == before, 'Diagnostic events must not produce an Ops handoff'
            checked('Consented first-party source survives internal navigation with no raw IDs or Google diagnostics: ' + campaign, page, context)
            context.close()

        for signal in ['globalPrivacyControl', 'doNotTrack']:
            context, page = start(browser, {CONSENT: 'granted', ADVERTISING_CONSENT: 'granted'}, signal=signal)
            assert page.evaluate('window.MFTAnalyticsConsent.status()') == 'denied'
            checked(signal + ' prevents collection after a stored grant', page, context)
            context.close()

        # Same-origin stale-parent messages must not revive the retired helper.
        # The current assets are tested with relaxed fixture CSP, while DNS
        # denial and the browser interceptor still prevent external delivery.
        context, page = start(browser, {CONSENT: 'granted', ADVERTISING_CONSENT: 'granted'}, '/__mft-helper-probe__/')
        page.evaluate('window.__bootstrapCalls=[];window.gtag=(...args)=>window.__bootstrapCalls.push(args[0]);window.dataLayer=[]')
        page.add_script_tag(url=BASE + '/assets/mft-ga4-bootstrap.js?v=old-cached-parent')
        assert page.evaluate('window.__bootstrapCalls') == []
        page.evaluate("""async () => {
          const iframe=document.createElement('iframe');iframe.id='retired-helper';
          iframe.src='/assets/mft-ga4-frame.html?v=old-cached-parent';
          await new Promise((resolve,reject)=>{iframe.onload=resolve;iframe.onerror=reject;document.body.append(iframe)});
          window.__helperLoaded=true;
          const init={type:'mft:analytics:init',pageKey:'0123456789abcdef',sendPageView:true,
            referrer:'https://www.google.com/',source:{source:'google',medium:'cpc',campaignId:'24530528782'},
            sourceExpiresAt:Date.now()+1800000};
          const intent={type:'mft:analytics:intent',id:'m1',placement:'dialog',
            names:['consultation_click','clinician_schedule_click','appointment_request_click','simplepractice_exit']};
          iframe.contentWindow.postMessage(init,location.origin);
          iframe.contentWindow.postMessage(intent,location.origin);
          iframe.contentWindow.postMessage(intent,location.origin);
          window.__syncResult=typeof iframe.contentWindow.MFTAnalyticsReceiveIntent==='function'
            ? iframe.contentWindow.MFTAnalyticsReceiveIntent(intent) : false;
        }""")
        page.wait_for_timeout(400)
        assert page.evaluate('window.__helperLoaded===true && window.__syncResult!==true')
        assert len(page.frames) == 2
        for frame in page.frames:
            assert frame.evaluate("!Array.from(window.dataLayer||[]).some(entry=>['config','event'].includes(entry[0]))")
            assert_no_google_dom(frame)
        assert not deliveries, 'Neither diagnostics nor retired-helper messages may create a handoff'
        checked('Retired bootstrap and embedded helper reject old init/intent protocol without Google execution', context=context)
        page.goto(BASE + '/assets/mft-ga4-frame.html?gclid=secret-click#old-parent', wait_until='domcontentloaded')
        page.add_script_tag(url=BASE + '/assets/mft-ga4-bootstrap.js?v=old-cached-parent')
        page.wait_for_timeout(250)
        checked('Direct retired-helper navigation stays inert', page, context)
        context.close()
        browser.close()
        interceptor.assert_ok()
    report['passed'] = True
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
