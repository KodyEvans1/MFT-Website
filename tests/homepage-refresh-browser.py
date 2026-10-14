"""Built-output browser QA. Never submit appointments or send tracking data."""
import functools
import hashlib
import json
import os
from pathlib import Path
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUT = ROOT / 'tmp/homepage-refresh-browser'
OUT.mkdir(parents=True, exist_ok=True)
ASSETS = OUT / 'visual-assets'
ASSETS.mkdir(exist_ok=True)
REQUIRE_IMAGES = os.environ.get('MFT_REQUIRE_IMAGES') == 'true'

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def end_headers(self):
        self.send_header('X-Robots-Tag', 'noindex,nofollow')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(DIST)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
results = {'pass': False, 'cases': [], 'images': [], 'blockedRequests': [], 'imageCache': {},
           'scope': 'Built review output. External booking SDK and appointment requests are blocked. No live booking submission, analytics, email, authentication, or hosted Netlify policy verification.'}

def allow_request(route):
    req = route.request
    u = urlsplit(req.url)
    if req.method == 'GET' and (u.hostname == '127.0.0.1' or (REQUIRE_IMAGES and u.hostname == 'images.squarespace-cdn.com' and req.resource_type == 'image')):
        route.continue_()
    else:
        results['blockedRequests'].append({'host': u.hostname, 'type': req.resource_type})
        route.abort()

def capture_image(response):
    if urlsplit(response.url).hostname != 'images.squarespace-cdn.com' or response.status != 200:
        return
    try:
        content_type = response.headers.get('content-type', '')
        if not content_type.startswith('image/'):
            return
        body = response.body()
        filename = hashlib.sha256(response.url.encode()).hexdigest()[:16] + '.img'
        (ASSETS / filename).write_bytes(body)
        results['imageCache'][response.url] = {'file': filename, 'contentType': content_type}
    except Exception:
        pass

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(reduced_motion='reduce')
        context.route('**/*', allow_request)
        page = context.new_page()
        page.on('response', capture_image)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        for width, height in [(1440,1000),(1024,1000),(768,1000),(390,844),(320,800)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.goto(base+'/', wait_until='domcontentloaded')
            page.evaluate("""async () => {
                for(const i of document.images) i.loading='eager';
                await Promise.all([...document.images].map(i => i.decode().catch(()=>{})));
            }""")
            state = page.evaluate("""() => ({
              width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
              h1: document.querySelectorAll('h1').length,
              cards: document.querySelectorAll('.mh-path').length,
              clinicians: document.querySelectorAll('[data-home-clinician]').length,
              ids: [...document.querySelectorAll('[id]')].map(e=>e.id),
              robots: document.querySelector('meta[name=robots]').content,
              measurement: window.MFT_BOOKING_CONFIG?.measurementEnabled,
              reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
              images: [...document.querySelectorAll('main img')].map(i => ({alt:i.alt,loaded:i.naturalWidth>0,src:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight})),
              ctas: [...document.querySelectorAll('main a[data-mft-booking]')].map(a=>a.href)
            })""")
            assert state['scrollWidth'] <= width+1, ('overflow',state)
            assert state['h1'] == 1 and state['cards'] == 4
            expected = len([c for c in json.loads((ROOT/'content/clinician-registry.json').read_text())['clinicians'] if c['status']=='current'])
            assert state['clinicians'] == expected
            assert len(state['ids']) == len(set(state['ids'])), 'Duplicate IDs'
            assert 'noindex' in state['robots'] and state['measurement'] is False
            assert state['reducedMotion'] is True
            assert state['ctas'] and all(u.startswith('https://clientsecure.me/widget-redirect?') for u in state['ctas'])
            if REQUIRE_IMAGES:
                assert all(i['loaded'] for i in state['images']), ('Image failure',state['images'])
            page.screenshot(path=str(OUT/f'homepage-{width}.png'), full_page=True)
            page.screenshot(path=str(OUT/f'homepage-opening-{width}.png'))
            results['cases'].append({'width':width,'height':height,'pass':True,'imagesVerified':REQUIRE_IMAGES})
            results['images'] = state['images']
            if width in (1440,390):
                summary = page.locator('.home-faq summary').first
                summary.click()
                assert page.locator('.home-faq details').first.get_attribute('open') is not None
                summary.press('Enter')
                assert page.locator('.home-faq details').first.get_attribute('open') is None
                page.locator('.mh-hero a[data-mft-ten-minute-consultation]').click()
                gate = page.locator('.mft-consultation-gate')
                assert gate.is_visible()
                assert gate.locator('[data-consultation-continue]').is_disabled()
                gate.locator('input[type=checkbox]').check()
                assert gate.locator('[data-consultation-continue]').is_enabled()
                page.keyboard.press('Escape')
                assert not gate.is_visible()
                if width == 390:
                    page.locator('.menu-button').click()
                    assert page.locator('.menu-button').get_attribute('aria-expanded') == 'true'
                    page.keyboard.press('Escape')
                    assert page.locator('.menu-button').get_attribute('aria-expanded') == 'false'
        page.set_viewport_size({'width':1440,'height':1000})
        page.goto(base+'/',wait_until='domcontentloaded')
        for href in ['/new-page/','/marriage-and-couples-therapy-counseling/','/childrentherapy/','/teen-counseling/']:
            page.locator('.mh-path[href="'+href+'"]').click()
            page.wait_for_url(base+href)
            assert page.locator('h1').count() == 1
            page.goto(base+'/',wait_until='domcontentloaded')
        assert not errors, errors
        nojs = browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
        nojs.route('**/*',allow_request)
        n = nojs.new_page();n.goto(base+'/',wait_until='domcontentloaded')
        assert n.locator('h1').is_visible()
        assert n.locator('.mh-path').count()==4
        assert n.locator('.mh-hero a').first.get_attribute('href').startswith('https://clientsecure.me/widget-redirect?')
        n.screenshot(path=str(OUT/'homepage-no-javascript.png'),full_page=True)
        results['noJavaScript'] = True
        normal=browser.new_context(reduced_motion='no-preference')
        normal.route('**/*',allow_request)
        m=normal.new_page();m.goto(base+'/',wait_until='domcontentloaded')
        m.locator('.mh-team').scroll_into_view_if_needed();m.wait_for_timeout(700)
        assert m.locator('.mh-person').first.is_visible()
        assert m.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0
        results['normalMotion'] = True
        results['interactions'] = ['service pathway navigation','FAQ mouse and keyboard','mobile menu and Escape','consultation consent enable/disable; no external submission']
        results['pass'] = True
        browser.close()
except Exception as e:
    results['error'] = str(e)
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(results,indent=2))
    server.shutdown()
