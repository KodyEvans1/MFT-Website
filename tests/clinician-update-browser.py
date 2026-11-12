"""Read-only clinician profile checks; never submit an appointment or email."""
import argparse
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import threading
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--public-inspection', action='store_true')
args = parser.parse_args()
OUT = ROOT / 'tmp' / 'clinician-update'
OUT.mkdir(parents=True, exist_ok=True)
profile = json.loads((ROOT / 'content/autumn-profile.json').read_text())
from urllib.parse import urlsplit, parse_qs
def autumn_calendar(href):
    u=urlsplit(href); q=parse_qs(u.query)
    return u.scheme=='https' and u.netloc=='clientsecure.me' and u.path=='/widget-redirect' and q.get('clinicianId')==['2183370'] and q.get('channel')==['client_portal']
results = []
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def end_headers(self):
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' https://images.squarespace-cdn.com data:; script-src 'self' https://widget-cdn.simplepractice.com; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://clientsecure.me https://marriagefamilytherapy.clientsecure.me; frame-src https://clientsecure.me https://marriagefamilytherapy.clientsecure.me https://spwidget-marriagefamilytherapy.clientsecure.me; base-uri 'self'")
        super().end_headers()

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
executable = os.environ.get('CHROME_PATH') or shutil.which('google-chrome') or shutil.which('chromium')
if not executable:
    raise RuntimeError('A browser executable is required; no browser pass is assumed')
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
        for width in [1440, 1024, 768, 390, 320]:
            context = browser.new_context(viewport={'width': width, 'height': 960}, reduced_motion='reduce')
            # Exact website code, external network suppressed. This proves local UI,
            # not external clinician photos, hosted deployment, or email delivery.
            context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            for slug in ['autumn-alexander', 'dr-nolan', 'team', '']:
                response = page.goto(base + '/' + (slug + '/' if slug else ''), wait_until='networkidle')
                assert response.status == 200
                assert page.locator('h1').count() == 1, (slug, 'H1')
                assert page.locator('main').count() == 1, (slug, 'main')
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), (slug,width,'overflow')
                if slug == 'autumn-alexander':
                    image = page.locator('img.hero-media')
                    assert image.evaluate('''async (img) => { await img.decode(); const original = new Image(); original.src = img.src; await original.decode(); return img.complete && img.naturalWidth > 0 && original.naturalWidth === 576 && original.naturalHeight === 1023; }''')
                    assert image.get_attribute('src') == profile['portrait']['path']
                    primary = page.locator('.mft-clinician-hero a').first
                    assert autumn_calendar(primary.get_attribute('href'))
                    primary.focus()
                    assert primary.evaluate('(el) => el === document.activeElement')
                    assert '6+' in page.locator('main').inner_text()
                    if width in [1440,390]:
                        page.screenshot(path=str(OUT / f'autumn-{width}-top.png'))
                        page.screenshot(path=str(OUT / f'autumn-{width}-full.png'), full_page=True)
                elif slug == 'dr-nolan':
                    assert 'Taylor works with adult individuals, couples, and partners.' in page.locator('main').inner_text()
                    assert page.locator('main a[href="/childrentherapy/"], main a[href="/teen-counseling/"], main a[href*="play-therapy"]').count() == 0
                    primary = page.locator('.mft-clinician-hero a').first
                    assert 'clinicianId=2031820' in primary.get_attribute('href')
                else:
                    assert page.locator('a[href="/autumn-alexander/"]').count() > 0
                if width in [1440,390] and slug == 'team':
                    page.screenshot(path=str(OUT / f'team-{width}-full.png'), full_page=True)
                results.append({'environment':'local HTTP with external network blocked','width':width,'route':'/'+slug+'/' if slug else '/','result':'PASS'})
            assert not errors, errors
            if width == 390:
                menu = page.locator('.menu-button')
                menu.focus();page.keyboard.press('Enter')
                assert menu.get_attribute('aria-expanded') == 'true'
                page.keyboard.press('Enter')
                assert menu.get_attribute('aria-expanded') == 'false'
                results.append({'environment':'local HTTP','check':'keyboard mobile menu','result':'PASS'})
            context.close()
        # JavaScript-independent actions are native links, not analytics callbacks.
        context=browser.new_context(java_script_enabled=False)
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort())
        page=context.new_page();page.goto(base+'/autumn-alexander/')
        assert autumn_calendar(page.locator('.mft-clinician-hero a').first.get_attribute('href'))
        page.goto(base+'/dr-nolan/')
        assert 'clinicianId=2031820' in page.locator('.mft-clinician-hero a').first.get_attribute('href')
        results.append({'environment':'local HTTP, JavaScript disabled','check':'native Autumn and Taylor calendar links','result':'PASS'})
        context.close();browser.close()
finally:
    server.shutdown()

if args.public_inspection:
    public = []
    for slug in ['dr-nolan/', 'play-therapy/', 'childrentherapy/', 'team/', 'autumn-alexander/']:
        url = 'https://www.mft.care/' + slug
        try:
            request=urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'MFT-website-profile-verification'})
            with urllib.request.urlopen(request,timeout=25) as response:
                body=response.read();text=body.decode('utf-8')
                public.append({'url':url,'status':response.status,'sha256':hashlib.sha256(body).hexdigest(),'hasAutumn': 'autumn-alexander' in text, 'adultScope': 'Taylor works with adult individuals' in text, 'containsPlayLink': '/play-therapy/' in text})
        except Exception as error:
            public.append({'url':url,'error':str(error)})
    (OUT/'public-inspection.json').write_text(json.dumps(public,indent=2))
(OUT/'result-local.json').write_text(json.dumps({'checks':results,'passed':len(results),'limits':['No hosted preview claim','No appointments or email submitted','No external portrait-load or analytics receipt claim']},indent=2))
print(json.dumps({'local_browser_checks':len(results),'result':'PASS'}))
