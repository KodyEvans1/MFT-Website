"""Shared assertions for the disabled Google path; no vendor scripts are fetched."""
import re
from urllib.parse import urlsplit

CONSENT = 'mft.analytics.consent.v5'
ADVERTISING_CONSENT = 'mft.advertising.consent.v1'
CONTROLLER = 'script[data-mft-measurement-controller="first-party"]'
GOOGLE_DOMAINS = (
    'google-analytics.com', 'googletagmanager.com', 'googleadservices.com',
    'googlesyndication.com', 'doubleclick.net', 'google.com', 'googleapis.com',
    'gstatic.com', 'googleusercontent.com', 'googletagservices.com',
)


def is_google_url(url):
    host = (urlsplit(url).hostname or '').lower()
    return any(host == domain or host.endswith('.' + domain) for domain in GOOGLE_DOMAINS) or bool(
        re.search(r'(^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$', host))


def request_summary(request):
    """Deliberately omit query strings, cookies and payload values from artifacts."""
    url = urlsplit(request.url)
    return {'method': request.method, 'host': url.hostname, 'path': url.path,
            'resourceType': request.resource_type}


def assert_no_google_dom(page):
    resources = page.evaluate("""() => [...document.querySelectorAll('script[src], iframe[src], link[href]')]
      .map(el => el.src || el.href).filter(Boolean)""")
    assert not any(is_google_url(url) for url in resources), 'Google resource present in the document'
    assert page.locator('script[data-mft-measurement-id]').count() == 0
    assert page.locator('iframe[title="Optional website traffic measurement"]').count() == 0


def assert_advertising_unavailable(page):
    assert page.evaluate('window.MFTAnalyticsConsent.advertisingStatus()') == 'unavailable'
    assert page.evaluate('window.MFTAdvertisingConsent.status()') == 'unavailable'
    assert page.evaluate('key => localStorage.getItem(key)', ADVERTISING_CONSENT) == 'denied'
    assert page.evaluate('typeof window.MFTAdvertisingConsent.grant') == 'undefined'


def assert_no_raw_identifier_storage(page):
    stored = page.evaluate("""() => [localStorage, sessionStorage].flatMap(storage =>
      Object.keys(storage).map(key => key + '=' + storage.getItem(key))).concat(document.cookie).join('\\n')""")
    for forbidden in ['secret-click', 'private-canary', 'gclid', 'gbraid', 'wbraid', '202031516078', '701234567890']:
        assert forbidden not in stored.lower(), 'Raw identifier or unapproved detail retained: ' + forbidden


def assert_no_google_cookies(context):
    names = [cookie['name'] for cookie in context.cookies()
             if re.match(r'^(?:mftga|_ga(?:$|_)|_gid$|_gat(?:$|_)|_gcl_)', cookie['name'])]
    assert not names, {'unexpectedMeasurementCookieNames': names}
