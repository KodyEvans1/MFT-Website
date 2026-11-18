"""Real vendor-library rehearsal with a DNS backstop against detached-frame egress."""
import base64
import hashlib
import os
import shutil
from urllib.request import Request, urlopen

TAG_URL = 'https://www.googletagmanager.com/gtag/js?id=G-BTK39BBNRE'


class BrowserRequest:
    """The exact request-stage CDP payload, independent of a live renderer Frame."""
    def __init__(self, event):
        request = event['request']
        self.url = request['url']
        self.method = request['method']
        self.headers = {name.lower(): value for name, value in request.get('headers', {}).items()}
        self.resource_type = event['resourceType'].lower()
        self.post_data = request.get('postData')
        if self.post_data is None and request.get('postDataEntries'):
            entries = request['postDataEntries']
            assert all('bytes' in entry for entry in entries), 'CDP omitted part of the request body'
            self.post_data = b''.join(base64.b64decode(entry['bytes'], validate=True) for entry in entries).decode('utf-8')
        # Never infer a batch from the URL if the browser omitted its POST body.
        if request.get('hasPostData') or int(self.headers.get('content-length', '0')) > 0:
            assert self.post_data is not None, 'CDP omitted a request body required for payload verification'

    def is_navigation_request(self):
        return self.resource_type == 'document'


class BrowserRoute:
    def __init__(self, session, event):
        self.session = session
        self.request_id = event['requestId']
        self.handled = False
        self.request = BrowserRequest(event)

    def fulfill(self, *, status=200, body='', headers=None, content_type=None):
        assert not self.handled, 'A CDP request must be fulfilled or aborted exactly once'
        response_headers = dict(headers or {})
        if content_type:
            response_headers['Content-Type'] = content_type
        payload = body.encode('utf-8') if isinstance(body, str) else body
        self.session.send('Fetch.fulfillRequest', {
            'requestId': self.request_id, 'responseCode': status,
            'responseHeaders': [{'name': name, 'value': value} for name, value in response_headers.items()],
            'body': base64.b64encode(payload).decode('ascii'),
        })
        self.handled = True

    def abort(self):
        assert not self.handled, 'A CDP request must be fulfilled or aborted exactly once'
        self.session.send('Fetch.failRequest', {'requestId': self.request_id, 'errorReason': 'BlockedByClient'})
        self.handled = True


class BrowserInterceptor:
    """One browser-target interceptor; no Playwright or page-target Fetch routes."""
    def __init__(self, browser, guard):
        self.session = browser.new_browser_cdp_session()
        self.guard = guard
        self.errors = []
        self.request_count = 0
        self.session.on('Fetch.requestPaused', self._paused)
        self.session.send('Fetch.enable', {'patterns': [{'urlPattern': '*', 'requestStage': 'Request'}]})

    def _paused(self, event):
        self.request_count += 1
        route = None
        try:
            route = BrowserRoute(self.session, event)
            self.guard(route)
            assert route.handled, 'Guard left a request paused without a decision'
        except Exception as error:
            self.errors.append(str(error))
            if route is None or not route.handled:
                try:
                    self.session.send('Fetch.failRequest', {'requestId': event['requestId'], 'errorReason': 'BlockedByClient'})
                except Exception:
                    pass  # DNS denial still prevents egress if the request already disappeared.

    def assert_ok(self):
        assert not self.errors, {'browserInterceptorErrors': self.errors}


def install_browser_interceptor(browser, guard):
    return BrowserInterceptor(browser, guard)


def fetch_real_tag():
    # This static script fetch has no browser cookies, page URL, or event data.
    with urlopen(Request(TAG_URL, headers={'User-Agent': 'MFT-Candidate-Verification/1.0'}), timeout=30) as response:
        source = response.read()
        assert response.status == 200 and source, 'Google tag source was unavailable'
        assert response.url.startswith('https://www.googletagmanager.com/gtag/js?'), 'Unexpected tag source redirect'
    return source, {'source': TAG_URL, 'sha256': hashlib.sha256(source).hexdigest(), 'bytes': len(source),
                    'mode': 'Fresh vendor bytes served to the browser; every browser DNS lookup denied'}


def launch_isolated_chromium(playwright):
    chrome = os.getenv('CHROME_PATH') or os.getenv('MFT_CHROMIUM') or shutil.which('google-chrome') or shutil.which('chromium')
    browser = playwright.chromium.launch(headless=True, args=['--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND'],
                                         **({'executable_path': chrome} if chrome else {}))
    # Prove the backstop against a real collector hostname before any page routes
    # or event scripts exist. A synthetic .invalid host would not verify the rule.
    context = browser.new_context()
    page = context.new_page()
    try:
        page.goto('https://www.google-analytics.com/', wait_until='domcontentloaded', timeout=10000)
    except Exception as error:
        if 'ERR_NAME_NOT_RESOLVED' not in str(error):
            browser.close()
            raise AssertionError('Collector DNS isolation did not produce the required failure') from error
    else:
        browser.close()
        raise AssertionError('Collector DNS isolation failed; refusing to load event scripts')
    context.close()
    return browser
