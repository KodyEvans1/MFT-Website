"""Trace the real first-party handoff transport with all external delivery blocked."""
import importlib.util
import json
import mimetypes
import re
import time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from scheduling_confirmation_fixture import acknowledge_scheduling_dialog
from ops_handoff_fixture import is_handoff_request, validate_handoff, accept_handoff
from measurement_privacy_fixture import CONSENT, is_google_url, request_summary

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/scheduling-measurement'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.mft.care'
REQUEST = 'https://marriagefamilytherapy.clientsecure.me/request'
CSP = re.search(r'Content-Security-Policy: ([^\n]+)', (ROOT / 'dist/_headers').read_text())[1]
spec = importlib.util.spec_from_file_location('mft_scheduling_harness', ROOT / 'tests/scheduling-browser-harness.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
trace, requests, destinations, google, errors = [], [], [], [], []
result = {'passed': False, 'scope': 'Local production-origin candidate with all browser DNS denied. Actual first-party keepalive output is checked against the unchanged Ops contract; the synthetic receiver is not production receipt, Google attribution or SimplePractice verification.',
          'trace': trace, 'requests': requests, 'googleRequests': google}
interceptor = None


def guard(route):
    request = route.request
    url = urlsplit(request.url)
    if is_google_url(request.url):
        google.append(request_summary(request))
        route.abort()
        raise AssertionError('Google loader and collection must remain disabled')
    if is_handoff_request(request):
        payload = validate_handoff(request)
        requests.append({'event': payload['eventType'], 'parameterNames': sorted(payload),
                         'resourceType': request.resource_type, 'consentVersion': payload['consentVersion']})
        accept_handoff(route)
    elif url.hostname == 'www.mft.care' and request.method in {'GET', 'HEAD'}:
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
    elif request.url == REQUEST and request.method == 'GET' and request.is_navigation_request():
        destinations.append(request.url)
        route.fulfill(status=200, content_type='text/html', body='<!doctype html><title>Intercepted scheduler</title><link rel="icon" href="data:,"><h1>No actual scheduling request</h1>')
    else:
        route.abort()


def console_message(message):
    for prefix in ['MFTPROBE ', 'MFTNET ']:
        if message.text.startswith(prefix):
            trace.append(json.loads(message.text[len(prefix):]))


try:
    with sync_playwright() as playwright:
        browser = harness.launch_isolated_chromium(playwright)
        interceptor = harness.install_browser_interceptor(browser, guard)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', storage_state={
            'cookies': [], 'origins': [{'origin': BASE, 'localStorage': [{'name': CONSENT, 'value': 'granted'}]}],
        })
        context.add_init_script(path=ROOT / 'tests/fixtures/scheduling-network-probe.js')
        page = context.new_page()
        page.on('console', console_message)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/?utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053', wait_until='domcontentloaded')
        page.evaluate((ROOT / 'tests/fixtures/scheduling-transport-probe.js').read_text())
        free = page.locator('.mh-hero a[data-mft-ten-minute-consultation="true"]')
        free.click()
        assert not requests and not google
        page.locator('dialog.mft-consultation-gate[open]').get_by_role('button', name='Cancel', exact=True).click()
        free.click()
        go = acknowledge_scheduling_dialog(page)
        assert go is not None and not requests
        begin = time.monotonic()
        go.click()
        page.wait_for_url(REQUEST)
        assert time.monotonic() - begin < 1.5, 'Measurement delayed native scheduling'
        deadline = time.monotonic() + 5
        while not requests and time.monotonic() < deadline:
            page.wait_for_timeout(50)
            interceptor.assert_ok()
        assert len(requests) == 1 and destinations == [REQUEST]
        sends = [entry for entry in trace if entry['kind'] == 'fetch']
        assert len(sends) == 1 and sends[0]['data']['event'] == 'simplepractice_exit'
        assert sends[0]['data']['keepalive'] is True
        assert sends[0]['data']['credentials'] == 'omit' and sends[0]['data']['referrerPolicy'] == 'no-referrer'
        assert not google and not errors, {'googleRequests': google, 'pageErrors': errors}
        result['checks'] = ['No receipt on opening, cancellation or acknowledgment', 'One minimized keepalive handoff',
                            'Native scheduling proceeds without awaiting receipt', 'Zero Google requests']
        context.close()
        interceptor.assert_ok()
        browser.close()
    result['passed'] = True
except Exception as error:
    result['error'] = str(error)
    raise
finally:
    if interceptor:
        result['interceptorErrors'] = interceptor.errors
        result['interceptedRequests'] = interceptor.request_count
    (OUT / 'transport-probe.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
