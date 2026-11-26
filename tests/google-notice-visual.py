"""Synthetic reviewed-config notice visual check. No external event delivery."""
import importlib.util
import json
import mimetypes
import re
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/google-notice-visual'
OUT.mkdir(parents=True,exist_ok=True)
BASE='https://www.mft.care'
spec=importlib.util.spec_from_file_location('harness',ROOT/'tests/scheduling-browser-harness.py')
harness=importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
report={'pass':False,'scope':'Synthetic reviewed-config fixture only, no production approval or external delivery. Every request intercepted, DNS denied.','checks':[],'networkAttempts':[]}

def guard(route):
    request=route.request
    url=urlsplit(request.url)
    if url.hostname=='www.mft.care' and request.method=='GET':
        if url.path=='/assets/mft-google-measurement.js':
            file=ROOT/'src/assets/mft-google-measurement.js'
        else:
            file=ROOT/'dist'/url.path.lstrip('/')
            if url.path.endswith('/') or not file.suffix:
                file=file/'index.html'
        if not file.is_file():
            route.fulfill(status=404,body='Not found')
            return
        body=file.read_bytes()
        if url.path=='/':
            body=body.decode().replace('<script src="/assets/mft-analytics.js', '<script src="/assets/mft-google-measurement.js" defer data-mft-google-mode="approved-main-page" data-mft-google-measurement-id="G-BTK39BBNRE" data-mft-google-route="/" data-mft-google-event="simplepractice_exit" data-mft-google-approved-review="'+'a'*64+'"></script><script src="/assets/mft-analytics.js',1).encode()
        route.fulfill(status=200,body=body,headers={'Content-Type':mimetypes.guess_type(str(file))[0] or 'application/octet-stream','Content-Security-Policy':CSP,'Referrer-Policy':'no-referrer'})
        return
    if any(host in (url.hostname or '') for host in ['google','doubleclick','ops.mft.care','clientsecure.me']):
        report['networkAttempts'].append({'host':url.hostname,'path':url.path,'method':request.method})
    route.abort()

try:
    with sync_playwright() as p:
        browser=harness.launch_isolated_chromium(p)
        interceptor=harness.install_browser_interceptor(browser,guard)
        for width,height in [(1440,1000),(360,800),(320,568)]:
            context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
            page=context.new_page()
            errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(BASE+'/',wait_until='networkidle')
            banner=page.locator('#mft-analytics-consent')
            expect(banner).to_be_visible()
            expect(banner.locator('[data-choice="grant-ad"]')).to_have_text('Allow Google')
            expect(banner.locator('[data-choice="deny-ad"]')).to_have_text('Decline Google')
            metrics=banner.evaluate('(el)=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,right:el.getBoundingClientRect().right,bottom:el.getBoundingClientRect().bottom,innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth})')
            assert metrics['right']<=width+1 and metrics['bottom']<=height+1 and metrics['scrollWidth']<=width,metrics
            assert page.evaluate('MFTAnalyticsConsent.status()')=='unset'
            assert page.evaluate('MFTGoogleMeasurement.status()')=='unset'
            banner.screenshot(path=str(OUT/f'notice-{width}.png'))
            google_choice=banner.locator('[data-choice="grant-ad"]')
            google_choice.scroll_into_view_if_needed()
            expect(google_choice).to_be_visible()
            choice_box=google_choice.bounding_box()
            assert choice_box and choice_box['x']>=0 and choice_box['y']>=0 and choice_box['x']+choice_box['width']<=width+1 and choice_box['y']+choice_box['height']<=height+1,choice_box
            banner.screenshot(path=str(OUT/f'notice-google-choice-{width}.png'))
            banner.locator('[data-choice="dismiss"]').click()
            page.locator('main a[data-mft-ten-minute-consultation="true"]').first.click()
            expect(page.locator('dialog.mft-consultation-gate')).to_be_visible()
            page.evaluate('MFTAnalyticsConsent.show()')
            expect(page.locator('#mft-analytics-consent')).to_be_hidden()
            page.locator('dialog [data-mft-account-ack]').check()
            page.locator('dialog [data-mft-consultation-ack]').check()
            assert page.evaluate('MFTGoogleMeasurement.status()')=='unset'
            page.locator('dialog button[value="cancel"]').last.click()
            expect(page.locator('#mft-analytics-consent')).to_be_visible()
            assert page.evaluate('MFTGoogleMeasurement.status()')=='unset'
            # This production-denied fixture rejects the explicitly requested
            # loader at CSP, exercising the real stopped-runtime notice without
            # downloading a tag or sending an event. A later choice must explain
            # its reload and fit the same narrow screens.
            banner.locator('[data-choice="grant-ad"]').click()
            page.wait_for_function('()=>window.MFTGoogleMeasurement.requiresReload()===true')
            page.evaluate('()=>MFTAnalyticsConsent.show()')
            reload_choice=banner.locator('[data-choice="grant-ad"]')
            expect(reload_choice).to_have_text('Allow Google and reload')
            expect(banner).to_contain_text('Allowing Google again reloads this page')
            reload_choice.scroll_into_view_if_needed()
            reload_box=reload_choice.bounding_box()
            assert reload_box and reload_box['x']>=0 and reload_box['y']>=0 and reload_box['x']+reload_box['width']<=width+1 and reload_box['y']+reload_box['height']<=height+1,reload_box
            reload_choice.focus()
            expect(reload_choice).to_be_focused()
            banner.screenshot(path=str(OUT/f'notice-regrant-{width}.png'))
            banner.locator('[data-choice="deny-ad"]').click()
            assert page.evaluate('MFTGoogleMeasurement.status()')=='denied'
            interceptor.assert_ok()
            assert not errors,errors
            assert not report['networkAttempts'],report['networkAttempts']
            report['checks'].append({'viewport':[width,height],'noticeBounds':metrics,'distinctChoices':True,'dialogSuppressionAndRestore':True,'noImplicitConsent':True,'explicitRegrantReloadLabel':True,'regrantButtonBounds':reload_box,'regrantKeyboardFocus':True})
            context.close()
        browser.close()
        report['pass']=True
finally:
    (OUT/'report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
