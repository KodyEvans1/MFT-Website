"""Real vendor-library rehearsal with a DNS backstop against detached-frame egress."""
import hashlib
import os
import shutil
from urllib.request import Request, urlopen

TAG_URL = 'https://www.googletagmanager.com/gtag/js?id=G-BTK39BBNRE'


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
