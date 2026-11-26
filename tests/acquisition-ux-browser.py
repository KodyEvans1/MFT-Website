"""Acquisition-page acceptance with browser DNS denied and every request intercepted.

Default serves the built candidate. --live snapshots public production GETs with
no cookies or credentials and performs only nonconverting popup interactions.
Neither mode sends events, email, appointment requests, or patient information.
Actual Continue and repeated handoff tests run only against local response data.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import mimetypes
import os
from pathlib import Path
import re
import urllib.request
from urllib.parse import parse_qs, urlencode, urlsplit

from playwright.sync_api import expect, sync_playwright
from measurement_privacy_fixture import CONSENT, is_google_url, request_summary
from ops_handoff_fixture import is_handoff_request, validate_handoff, accept_handoff
from scheduling_confirmation_fixture import acknowledge_scheduling_dialog


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
BASE = 'https://www.mft.care'
IMAGE_HOST = 'images.squarespace-cdn.com'
IMAGE_PREFIX = '/content/v1/65b78566ba645b4f0f011c30/'
OUT = ROOT / 'tmp/acquisition-ux'
REQUEST = 'https://marriagefamilytherapy.clientsecure.me/request'
PORTAL = 'https://marriagefamilytherapy.clientsecure.me/sign-in'
ROUTES = ['emily-johnsrud-bio', 'autumn-alexander', 'new-page',
          'marriage-and-couples-therapy-counseling', 'check-my-coverage',
          'how-to-start-therapy', 'online-therapy-washington']
CLINICIANS = {'emily-johnsrud-bio': 'emily', 'autumn-alexander': 'autumn'}
BOOKING = json.loads((ROOT / 'content/simplepractice-booking.json').read_text())
PEOPLE = {person['key']: person for person in BOOKING['clinicians']}
spec = importlib.util.spec_from_file_location('mft_acquisition_harness', ROOT / 'tests/scheduling-browser-harness.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)


def same_destination(actual, expected):
    a, e = urlsplit(actual or ''), urlsplit(expected)
    return (a.scheme, a.netloc, a.path, a.fragment) == (e.scheme, e.netloc, e.path, e.fragment) and parse_qs(a.query) == parse_qs(e.query)


def clinician_destination(key):
    person = PEOPLE[key]
    return 'https://clientsecure.me/widget-redirect?' + urlencode({
        'scopeId': BOOKING['scopeId'], 'applicationId': BOOKING['applicationId'],
        'channel': person.get('channel', 'professional_website'),
        'appearance': '{"fullScreen":true}', 'clinicianId': person['id'],
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Read-only public production snapshots; never activate Continue or an outbound link')
    parser.add_argument('--expected-commit', help='Require the live release record to identify this exact commit')
    args = parser.parse_args()
    if args.expected_commit and not args.live:
        parser.error('--expected-commit is only meaningful with --live')
    OUT.mkdir(parents=True, exist_ok=True)
    media_cache = OUT / 'public-media'
    media_cache.mkdir(exist_ok=True)
    report = {'pass': False, 'startedAtUtc': datetime.now(timezone.utc).isoformat(), 'environment': 'public production GET snapshots' if args.live else 'built candidate at production origin',
              'scope': 'Browser DNS denied; all requests fulfilled or aborted before egress. Live interactions stop before Continue. Local Continue and synthetic Ops receipts do not establish an appointment, production lead, Google receipt, or Ads credit.',
              'checks': [], 'sourceGets': [], 'sourceCacheReads': [], 'googleRequests': [], 'blockedWrites': [], 'errors': [], 'screenshots': []}
    state = {'case': 'setup', 'page': None, 'deliveries': [], 'destinations': [], 'scriptErrors': []}
    snapshots = {}
    interceptor = None
    csp = None if args.live else re.search(r'Content-Security-Policy: ([^\n]+)', (DIST / '_headers').read_text())[1]

    def permitted_public_url(value):
        url = urlsplit(value)
        if url.scheme != 'https' or url.username or url.password or url.port or url.fragment:
            return False
        if url.hostname == 'www.mft.care':
            return url.path in ['/'+slug+'/' for slug in ROUTES] + ['/reports/release-provenance.json', '/favicon.ico'] or url.path.startswith('/assets/')
        return url.hostname == IMAGE_HOST and url.path.startswith(IMAGE_PREFIX) and set(parse_qs(url.query)) <= {'format'}

    class PublicRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            assert permitted_public_url(newurl), 'Public snapshot redirect left the explicit website/static-image scope'
            return super().redirect_request(req, fp, code, msg, headers, newurl)

    # Construct before stripping browser subprocess proxy variables. No cookie
    # handler or authentication handler is installed, and browser headers are
    # never forwarded to this credential-free read-only snapshot client.
    opener = urllib.request.build_opener(PublicRedirect())

    @contextmanager
    def isolated_browser():
        proxy_keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']
        proxy_environment = {key: os.environ[key] for key in proxy_keys if key in os.environ}
        try:
            # Strip before starting the Playwright driver as well as Chromium;
            # otherwise the driver can pass its original proxy environment on.
            for key in proxy_keys:
                os.environ.pop(key, None)
            with sync_playwright() as playwright:
                browser = harness.launch_isolated_chromium(playwright)
                os.environ.update(proxy_environment)
                try:
                    yield browser
                finally:
                    browser.close()
        finally:
            os.environ.update(proxy_environment)

    def public_get(url):
        assert permitted_public_url(url), 'Unexpected public snapshot URL'
        if url in snapshots:
            return snapshots[url]
        image = urlsplit(url).hostname == IMAGE_HOST
        cached = media_cache / (hashlib.sha256(url.encode()).hexdigest()+'.bin')
        cached_type = cached.with_suffix('.json')
        if image and cached.is_file() and cached_type.is_file():
            body = cached.read_bytes()
            headers = json.loads(cached_type.read_text())
            result = (body, headers)
            report['sourceCacheReads'].append({'url': url, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(), 'scope': 'Previously fetched public static media only; page HTML and scripts are not persisted across runs'})
        else:
            with opener.open(urllib.request.Request(url, method='GET'), timeout=20) as response:
                assert response.status == 200, 'Public snapshot must return HTTP 200'
                body = response.read(12_000_001)
                assert len(body) <= 12_000_000, 'Public snapshot exceeds size bound'
                headers = {name: response.headers[name] for name in ('Content-Type', 'Content-Security-Policy', 'Referrer-Policy', 'X-Content-Type-Options') if response.headers.get(name)}
                if image:
                    assert headers.get('Content-Type', '').startswith('image/'), 'Published portrait response is not an image'
                report['sourceGets'].append({'url': url, 'status': response.status, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(), 'cookiesOrCredentials': False})
            result = (body, headers)
            if image:
                cached.write_bytes(body)
                cached_type.write_text(json.dumps(headers))
        snapshots[url] = result
        return result

    def guard(route):
        request, parsed = route.request, urlsplit(route.request.url)
        if is_google_url(request.url):
            report['googleRequests'].append(request_summary(request))
            route.abort()
            raise AssertionError('Google must remain disabled on all acquisition pages')
        if is_handoff_request(request):
            if args.live:
                report['blockedWrites'].append({'case': state['case'], 'host': parsed.hostname, 'path': parsed.path})
                route.abort()
                raise AssertionError('Live nonconverting acceptance attempted a handoff')
            payload = validate_handoff(request)
            state['deliveries'].append(payload)
            accept_handoff(route)
            return
        if parsed.hostname in ('clientsecure.me', 'marriagefamilytherapy.clientsecure.me'):
            if args.live:
                route.abort()
                raise AssertionError('Live nonconverting acceptance attempted scheduler navigation')
            assert request.method == 'GET' and request.is_navigation_request(), 'Unexpected scheduling request'
            state['destinations'].append(request.url)
            route.fulfill(status=200, content_type='text/html', body='<!doctype html><title>Intercepted scheduler</title><link rel="icon" href="data:,"><h1>Intercepted scheduler</h1>')
            return
        if request.method not in ('GET', 'HEAD'):
            report['blockedWrites'].append({'case': state['case'], 'host': parsed.hostname, 'path': parsed.path, 'method': request.method})
            route.abort()
            raise AssertionError('Unexpected write blocked before egress')
        if parsed.hostname == 'www.mft.care':
            if args.live:
                body, headers = public_get(request.url)
            else:
                file = DIST / parsed.path.lstrip('/')
                if parsed.path.endswith('/') or not file.suffix:
                    file /= 'index.html'
                assert file.resolve().is_relative_to(DIST.resolve()), 'Invalid built-site path'
                if not file.is_file():
                    route.fulfill(status=404, body='Not found')
                    return
                body, headers = file.read_bytes(), {'Content-Type': mimetypes.guess_type(str(file))[0] or 'application/octet-stream', 'Content-Security-Policy': csp, 'Referrer-Policy': 'no-referrer'}
            route.fulfill(status=200, body=body, headers=headers)
            return
        if parsed.hostname == IMAGE_HOST and request.resource_type == 'image':
            body, headers = public_get(request.url)
            route.fulfill(status=200, body=body, headers=headers)
            return
        route.abort()
        raise AssertionError('Unexpected external request: '+str(parsed.hostname)+parsed.path)

    def checked(name, action):
        state['case'] = name
        print('Acquisition UX browser case: '+name, flush=True)
        try:
            details = action() or {}
            interceptor.assert_ok()
            assert not state['scriptErrors'], state['scriptErrors']
            report['checks'].append({'case': name, 'pass': True, **details})
        except Exception as error:
            report['checks'].append({'case': name, 'pass': False, 'error': str(error)})
            page = state['page']
            if page and not page.is_closed():
                try:
                    page.screenshot(path=str(OUT / (name+'-failure.png')), timeout=5000)
                except Exception:
                    pass

    def context_for(browser, width=1440, consent='denied', remembered=False):
        values = {CONSENT: consent, 'mft.analytics.consent.v4': 'denied', 'mft.advertising.consent.v2': '{"choice":"denied"}'}
        if remembered:
            values['mft.newClientAccountAcknowledgment.v1'] = 'acknowledged'
        context = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce',
            storage_state={'cookies': [], 'origins': [{'origin': BASE, 'localStorage': [{'name': key, 'value': value} for key, value in values.items()]}]})
        state.update(deliveries=[], destinations=[], scriptErrors=[])
        context.on('page', lambda page: page.on('pageerror', lambda error: state['scriptErrors'].append(str(error))))
        return context

    def visit(context, slug):
        page = context.new_page()
        state['page'] = page
        page.set_default_timeout(8000)
        response = page.goto(BASE+'/'+slug+'/', wait_until='load', timeout=30000)
        assert response and response.status == 200, 'Expected public page HTTP 200'
        assert urlsplit(page.url).path == '/'+slug+'/', 'Existing route changed'
        return page

    def primary(page, slug):
        if slug in CLINICIANS or slug == 'online-therapy-washington':
            return page.locator('a[data-acquisition-appointment="primary"]')
        if slug in ('new-page', 'marriage-and-couples-therapy-counseling'):
            return page.locator('a[data-marketing-appointment="primary"]')
        return page.locator('#individual-journey a[data-mft-booking-intent="appointment"]').first

    def costs(page, slug):
        if slug == 'check-my-coverage':
            return
        block = page.locator('[data-starting-costs]').first
        assert block.count() == 1, 'Distinct starting-cost choices absent'
        expected = {
            'complimentary-introduction': ('0', r'10.minute', r'(?:phone|virtual)'),
            'short-consultation': ('75', r'26.minute', r'30.minute'),
        }
        if slug in ('marriage-and-couples-therapy-counseling', 'how-to-start-therapy'):
            expected['couples-hour-consultation'] = ('150', r'(?:one.hour|1.hour)', r'couples')
            expected['reduced-cost-program'] = ('150', r'couples', r'family')
        if slug != 'marriage-and-couples-therapy-counseling':
            expected['individual-evaluation'] = ('150', r'individual evaluation', r'insurance')
        for option, (price, *terms) in expected.items():
            card = block.locator('[data-care-option="'+option+'"]')
            assert card.count() == 1, 'Missing distinct care option: '+option
            assert card.locator('[data-care-price="'+price+'"]').count() == 1 or card.get_attribute('data-care-price') == price, 'Price mismatches option: '+option
            text = card.inner_text()
            assert all(re.search(term, text, re.I) for term in terms), (option, text)
            if option == 'couples-hour-consultation':
                assert re.search(r'not assume.*replace.*required short', text, re.I | re.S), 'The one-hour option must not replace required couples preparation by implication'
            if option == 'reduced-cost-program':
                assert re.search(r'not.*(?:every|general).*ongoing', text, re.I | re.S), 'Program price became a general ongoing-session fee'
        assert not block.locator('form,input,textarea').count(), 'Costs must not collect patient information'

    def page_acceptance(browser, slug, width):
        context = context_for(browser, width)
        try:
            page = visit(context, slug)
            assert page.locator('main h1').count() == 1, 'Expected one page heading'
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+2'), 'Horizontal overflow'
            assert page.locator('main form, main input, main textarea').count() == 0, 'Acquisition page added a public data-collection field'
            assert page.locator('link[rel="canonical"]').get_attribute('href') == BASE+'/'+slug+'/', 'Canonical route changed'
            assert page.locator('script[src*="mft-google-measurement"],script[src*="googletagmanager"],iframe[src*="mft-ga4"]').count() == 0, 'Excluded page installed Google runtime'
            costs(page, slug)
            if slug in (*CLINICIANS, 'new-page', 'marriage-and-couples-therapy-counseling', 'online-therapy-washington'):
                price = page.locator('[data-acquisition-payment]').first
                expect(price).to_be_visible()
                price_text = price.inner_text()
                if slug == 'marriage-and-couples-therapy-counseling':
                    assert all(re.search(term, price_text, re.I) for term in (r'\$75', r'26.minute', r'30.minute', r'one.hour', r'\$150')), 'Nearby couples pricing conflates the two consultation options'
                else:
                    assert '$150' in price_text and re.search(r'individual evaluation.*insurance', price_text, re.I | re.S), 'Evaluation cost and conditional insurance are absent beside the action'
            if slug in CLINICIANS:
                key = CLINICIANS[slug]
                hero = page.locator('[data-clinician-hero="'+slug+'"]')
                action = primary(page, slug)
                assert action.count() == 1 and 'Individual Evaluation' in action.inner_text()
                assert same_destination(action.get_attribute('href'), clinician_destination(key)), 'Primary action lost clinician-specific destination'
                assert action.get_attribute('data-mft-booking-intent') == 'appointment'
                assert action.get_attribute('data-spwidget-clinician-id') == PEOPLE[key]['id']
                for marker in ('data-acquisition-age-range', 'data-acquisition-format', 'data-acquisition-payment'):
                    assert hero.locator('['+marker+']').count() == 1, 'Missing nearby clinician fact: '+marker
                assert re.search(r'6\s*\+|ages?\s+6', hero.locator('[data-acquisition-age-range]').inner_text(), re.I), 'Published minimum age changed'
                format_text = hero.locator('[data-acquisition-format]').inner_text()
                assert re.search(r'in.person', format_text, re.I) and 'Woodinville' in format_text, 'Verified office format is absent beside the clinician action'
                assert re.search(r'telehealth|online', format_text, re.I) and 'Washington' in format_text, 'Verified telehealth location requirement is absent'
                assert re.search(r'confirm.*(?:format|service|appointment)', format_text, re.I), 'Catalog formats must remain subject to the intended appointment'
                visible = hero.locator('.actions a:visible,.actions button:visible')
                items = [item.get_attribute('data-acquisition-appointment') for item in visible.all()]
                assert items and items[0] == 'primary', 'Clinician hero no longer leads with the individual evaluation'
                action.focus();expect(action).to_be_focused()
                page.keyboard.press('Tab')
                assert page.evaluate('document.activeElement.closest("[data-clinician-hero]") !== null'), 'Keyboard order leaves the nearby secondary choices'
                if key == 'emily':
                    assert page.locator('.acquisition-entry-details [data-acquisition-secondary] a[href="/marriage-and-couples-therapy-counseling/"]').count() == 1, 'Emily couples care must remain a separate path'
                for link in page.locator('a[data-mft-existing-client]').all():
                    assert link.get_attribute('href') == PORTAL and link.get_attribute('data-mft-booking') is None, 'Existing-client portal became an acquisition action'
            if slug == 'check-my-coverage':
                details = page.locator('.mft-insurance-detail')
                text = details.inner_text()
                assert re.search(r'email', text, re.I) and re.search(r'secure', text, re.I), 'Benefits entry and secure follow-up are unclear'
                assert re.search(r'(?:not|isn.t|does not).*instant|not a guarantee|does not guarantee', text, re.I), 'Benefits language implies guaranteed or instant coverage'
                emails = details.locator('a[href^="mailto:"]')
                assert emails.count() >= 1 and all(urlsplit(a.get_attribute('href')).path.lower() == 'support@mft.care' for a in emails.all())
                assert details.locator('[data-benefits-step]').evaluate_all('(els)=>els.map(el=>el.dataset.benefitsStep)') == ['email', 'secure', 'review'], 'Benefits must begin by email, then use secure follow-up before cost review'
                for link in emails.all():
                    body = parse_qs(urlsplit(link.get_attribute('href')).query).get('body', [''])[0]
                    assert not re.search(r'(?:my name|phone number|member (?:number|id)|date of birth|diagnosis)\s*:', body, re.I), 'Ordinary email prefill requested private intake fields'
                assert not details.locator('form,input,textarea').count(), 'Benefits entered patient data on the public page'
            if slug == 'how-to-start-therapy':
                assert page.locator('#individual-journey').count() == 1
                page.goto(BASE+'/'+slug+'/#individual-journey', wait_until='load')
                expect(page.locator('#individual-journey')).to_be_in_viewport()
            page.evaluate('scrollTo({top:0,behavior:"instant"})')
            assert not state['deliveries'] and not state['destinations'], 'Content inspection caused a handoff'
            filename = ('live-' if args.live else 'built-')+slug+'-'+str(width)+'.png'
            page.screenshot(path=str(OUT / filename), full_page=False)
            report['screenshots'].append(filename)
            if width == 390 and slug in ('new-page', 'marriage-and-couples-therapy-counseling', 'how-to-start-therapy', 'check-my-coverage'):
                panel = page.locator('.mft-insurance-detail' if slug == 'check-my-coverage' else '[data-starting-costs]').first
                panel_filename = ('live-' if args.live else 'built-')+slug+'-390-details.png'
                # A tall element capture changes its virtual viewport; omit
                # fixed page chrome from this panel-only review artifact so it
                # cannot be stitched across the middle of the panel text.
                panel.screenshot(path=str(OUT / panel_filename), style='.site-header,.skip-link{visibility:hidden!important}')
                report['screenshots'].append(panel_filename)
            return {'route': '/'+slug+'/', 'viewportWidth': width, 'screenshot': filename}
        finally:
            context.close()

    def popup_actions(browser, slug):
        context = context_for(browser, 390)
        try:
            page = visit(context, slug)
            action = primary(page, slug)
            action.focus();page.keyboard.press('Enter')
            gate = page.locator('dialog.mft-consultation-gate[open]')
            expect(gate).to_be_visible()
            for checkbox in gate.locator('input[type="checkbox"]').all():
                if checkbox.is_visible():
                    checkbox.check()
            assert not state['deliveries'] and not state['destinations'], 'Opening or acknowledging the popup counted a handoff'
            gate.get_by_role('button', name='Cancel', exact=True).click()
            expect(gate).to_have_count(0);expect(action).to_be_focused()
            action.press('Enter')
            page.locator('dialog.mft-consultation-gate[open]').get_by_role('button', name='Close', exact=True).click()
            expect(action).to_be_focused()
            action.press('Enter');page.keyboard.press('Escape')
            expect(page.locator('dialog.mft-consultation-gate[open]')).to_have_count(0)
            expect(action).to_be_focused()
            assert not state['deliveries'] and not state['destinations'], 'Cancel, Close or Escape counted a handoff'
            return {'qualifyingHandoffs': 0, 'schedulerNavigations': 0, 'keyboardFocusRestored': True}
        finally:
            context.close()

    def local_declined_continue(browser, slug):
        context = context_for(browser, 390)
        try:
            page = visit(context, slug)
            primary(page, slug).click()
            go = acknowledge_scheduling_dialog(page)
            expected = clinician_destination(CLINICIANS[slug])
            assert go is not None and same_destination(go.get_attribute('href'), expected)
            go.click();page.wait_for_url(lambda value: same_destination(str(value), expected))
            assert len(state['destinations']) == 1 and same_destination(state['destinations'][0], expected)
            assert not state['deliveries'], 'Consent-declined navigation collected a handoff'
            return {'schedulerNavigations': 1, 'opsHandoffs': 0, 'clinician': CLINICIANS[slug]}
        finally:
            context.close()

    def local_remembered_dedup(browser, slug):
        context = context_for(browser, consent='granted', remembered=True)
        try:
            page = visit(context, slug)
            # Window bubbling is after the unchanged production document handler.
            # Suppress only navigation so two real trusted activations stay in
            # this same document and can exercise its same-handoff guard.
            page.evaluate('''()=>{for(const kind of ['click','auxclick'])window.addEventListener(kind,event=>{
              if(event.target.closest('a[data-acquisition-appointment="primary"]'))event.preventDefault();
            });}''')
            action = primary(page, slug)
            action.dblclick();action.click(button='middle')
            page.wait_for_timeout(350)
            assert len(state['deliveries']) == 1, 'Repeated trusted activation of one remembered link must yield one Ops handoff'
            assert page.locator('dialog.mft-consultation-gate[open]').count() == 0
            assert same_destination(action.get_attribute('href'), clinician_destination(CLINICIANS[slug]))
            assert not state['destinations'], 'Local navigation hold did not preserve the test document'
            return {'trustedActivations': 3, 'opsHandoffs': 1, 'googleRequests': 0, 'clinician': CLINICIANS[slug]}
        finally:
            context.close()

    try:
        if args.live:
            body, _ = public_get(BASE+'/reports/release-provenance.json')
            provenance = json.loads(body)
            report['productionCommit'] = provenance['source']['commit']
            if args.expected_commit:
                assert report['productionCommit'] == args.expected_commit, 'Live release record does not match the deployed commit'
        with isolated_browser() as browser:
            report['browserVersion'] = browser.version
            interceptor = harness.install_browser_interceptor(browser, guard)
            for width in (1440, 390):
                for slug in ROUTES:
                    checked(slug+'-'+str(width), lambda slug=slug, width=width: page_acceptance(browser, slug, width))
            for slug in CLINICIANS:
                checked(slug+'-nonconverting-keyboard-popup', lambda slug=slug: popup_actions(browser, slug))
                if not args.live:
                    checked(slug+'-declined-native-continue', lambda slug=slug: local_declined_continue(browser, slug))
                    checked(slug+'-remembered-handoff-dedup', lambda slug=slug: local_remembered_dedup(browser, slug))
            interceptor.assert_ok()
        interceptor.assert_ok()
        report['pass'] = all(item['pass'] for item in report['checks']) and not report['googleRequests'] and not report['blockedWrites']
    except Exception as error:
        report['errors'].append(str(error))
    finally:
        report['completedAtUtc'] = datetime.now(timezone.utc).isoformat()
        if interceptor:
            report['interceptedRequests'] = interceptor.request_count
            report['interceptorErrors'] = interceptor.errors
        filename = 'live-result.json' if args.live else 'built-result.json'
        (OUT / filename).write_text(json.dumps(report, indent=2)+'\n')
        print(json.dumps(report, indent=2))
    return 0 if report['pass'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
