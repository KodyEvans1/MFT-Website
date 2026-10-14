"""Read-only verification after an explicitly authorized production release.

No credentials, appointment submissions, analytics events, or service writes.
"""
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/homepage-live'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.mft.care'
CSS_PATH = ROOT / 'src/assets/homepage-refresh.css'
EXPECTED_CSS = CSS_PATH.read_bytes()
VERSION = hashlib.sha256(EXPECTED_CSS).hexdigest()[:12]
report = {'pass': False, 'url': BASE + '/', 'cssVersion': VERSION, 'checks': [],
          'scope': 'Read-only public homepage verification. Booking SDK and tracking blocked; no appointments submitted.'}

def fetch(url):
    request = Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'MFT-Homepage-Release-Verification/1.0'})
    with urlopen(request, timeout=20) as response:
        return response.read(), response.status, response.geturl(), dict(response.headers)

def route_request(route):
    request = route.request
    host = urlsplit(request.url).hostname
    allowed = request.method == 'GET' and (host in ('www.mft.care', 'mft.care') or
              (host == 'images.squarespace-cdn.com' and request.resource_type == 'image'))
    route.continue_() if allowed else route.abort()

try:
    deadline = time.monotonic() + 240
    while True:
        try:
            body, status, final_url, headers = fetch(BASE + '/?homepage-release=' + VERSION)
            html = body.decode('utf-8')
            assert status == 200 and 'data-home-refresh="20261013"' in html, 'Waiting for redesigned homepage'
            css_path = '/assets/homepage-refresh.css?v=' + VERSION
            assert css_path in html, 'Waiting for corrected-photo stylesheet version'
            css, css_status, _, _ = fetch(BASE + css_path)
            assert css_status == 200 and css == EXPECTED_CSS, 'Waiting for matching stylesheet bytes'
            break
        except Exception as error:
            report['lastWaitReason'] = str(error)
            if time.monotonic() >= deadline:
                raise
            time.sleep(8)
    report['response'] = {'status': status, 'finalUrl': final_url,
                          'xRobotsTag': headers.get('x-robots-tag', headers.get('X-Robots-Tag'))}
    (OUT/'homepage.html').write_bytes(body)
    (OUT/'homepage-refresh.css').write_bytes(css)
    apex, apex_status, apex_url, _ = fetch('https://mft.care/?homepage-release=' + VERSION)
    assert apex_status == 200 and b'data-home-refresh="20261013"' in apex
    report['apex'] = {'status': apex_status, 'finalUrl': apex_url}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(reduced_motion='reduce')
        context.route('**/*', route_request)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        for width, height in [(1440, 1000), (390, 844), (320, 800)]:
            page.set_viewport_size({'width': width, 'height': height})
            response = page.goto(BASE + '/?homepage-release=' + VERSION, wait_until='domcontentloaded')
            assert response.status == 200
            page.evaluate('''async () => {
                for (const image of document.images) image.loading = 'eager';
                await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
            }''')
            state = page.evaluate('''() => ({
                marker: document.body.dataset.homeRefresh,
                width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
                h1: document.querySelectorAll('h1').length,
                paths: document.querySelectorAll('.mh-path').length,
                photoPosition: getComputedStyle(document.querySelector('.mh-lobby')).objectPosition,
                images: [...document.querySelectorAll('main img')].map(i => ({alt: i.alt, loaded: i.naturalWidth > 0})),
                bookingLinks: [...document.querySelectorAll('main a[data-mft-booking]')].map(a => a.href),
                portal: [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Existing client portal')?.href,
                robots: document.querySelector('meta[name=robots]')?.content,
                canonical: document.querySelector('link[rel=canonical]')?.href,
                measurementEnabled: window.MFT_BOOKING_CONFIG?.measurementEnabled
            })''')
            assert state['marker'] == '20261013'
            assert state['scrollWidth'] <= width + 1
            assert state['h1'] == 1 and state['paths'] == 4
            assert state['photoPosition'] == '100% 50%'
            assert all(i['loaded'] for i in state['images'])
            assert state['canonical'] == BASE + '/'
            assert state['bookingLinks'] and all(u.startswith('https://clientsecure.me/widget-redirect?') for u in state['bookingLinks'])
            assert state['portal'].rstrip('/') == 'https://marriagefamilytherapy.clientsecure.me'
            page.screenshot(path=str(OUT/f'homepage-opening-{width}.png'))
            page.screenshot(path=str(OUT/f'homepage-full-{width}.png'), full_page=True)
            page.locator('.mh-hero-visual').screenshot(path=str(OUT/f'homepage-photo-{width}.png'))
            page.locator('.mh-hero a[data-mft-ten-minute-consultation]').click()
            gate = page.locator('.mft-consultation-gate')
            assert gate.is_visible()
            assert gate.locator('[data-consultation-continue]').is_disabled()
            gate.locator('input[type=checkbox]').check()
            assert gate.locator('[data-consultation-continue]').is_enabled()
            page.keyboard.press('Escape')
            assert not gate.is_visible()
            report['checks'].append({'width': width, 'pass': True, 'state': state, 'consultationAcknowledgment': True})
        assert not errors, errors
        browser.close()
    report['pass'] = True
except Exception as error:
    report['error'] = str(error)
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
