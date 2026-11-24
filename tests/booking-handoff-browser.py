"""Verify candidate full-page scheduling with every destination intercepted.

The fixture validates the repository's practice/clinician routing contract. It
does not assert live SimplePractice service menus, dates or appointment capacity.
"""
import json
import mimetypes
import os
from html import escape
from pathlib import Path
import re
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright, expect
from scheduling_confirmation_fixture import acknowledge_scheduling_dialog
from measurement_privacy_fixture import is_google_url, request_summary

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/booking-handoff';OUT.mkdir(parents=True,exist_ok=True)
CONFIG=json.loads((ROOT/'content/simplepractice-booking.json').read_text())
PORTAL='marriagefamilytherapy.clientsecure.me'
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
BASE='https://www.mft.care'
if os.environ.get('MFT_BASE_URL'):
    raise ValueError('This handoff verifier is candidate-only. Use analytics-browser.py for nonconverting live checks.')
report={'pass':False,'checks':[],'states':[],'blockedWrites':[], 'forbiddenRequests':[], 'interceptedDestinations':[],
        'scope':'Built candidate at the production origin. Every scheduler destination is an isolated response fixture. No Google, Ops or SimplePractice request is sent. Practice/clinician configuration and native navigation are checked; provider service availability is not tested.'}
requested_engine=os.environ.get('MFT_BROWSER','all')
if requested_engine not in ('all','chromium','webkit'):
    raise ValueError('MFT_BROWSER must be all, chromium, or webkit')
report['requestedEngines']=['chromium','webkit'] if requested_engine=='all' else [requested_engine]
report['baseUrl']=BASE
report['candidateOrigin']=True

def guard(route):
    r=route.request;u=urlsplit(r.url);host=u.hostname or ''
    if is_google_url(r.url) or host=='ops.mft.care' or r.url==CONFIG['loaderUrl']:
        report['forbiddenRequests'].append(request_summary(r))
        route.abort();return
    if host=='www.mft.care' and r.method in ['GET','HEAD']:
        file=ROOT/'dist'/u.path.lstrip('/')
        if u.path.endswith('/') or not file.suffix:file=file/'index.html'
        if not file.is_file():route.fulfill(status=404,body='Not found');return
        route.fulfill(status=200,body=file.read_bytes(),headers={
            'Content-Type':mimetypes.guess_type(str(file))[0] or 'application/octet-stream',
            'Content-Security-Policy':CSP,'Referrer-Policy':'no-referrer'})
        return
    if host in [PORTAL,'clientsecure.me'] and r.method=='GET' and r.is_navigation_request():
        selected=None
        if host==PORTAL:
            assert u.path=='/request' and not u.query, 'Unexpected general scheduling destination'
        else:
            assert u.path=='/widget-redirect', 'Unexpected clinician scheduling path'
            params=parse_qs(u.query)
            assert set(params)=={'scopeId','applicationId','channel','appearance','clinicianId'}
            selected=next((clinician for clinician in CONFIG['clinicians'] if params['clinicianId']==[clinician['id']]),None)
            assert selected, 'Scheduling used an unconfigured clinician'
            assert params['scopeId']==[CONFIG['scopeId']] and params['applicationId']==[CONFIG['applicationId']]
            assert params['channel']==[selected.get('channel','professional_website')]
            assert json.loads(params['appearance'][0])=={'fullScreen':True}
        report['interceptedDestinations'].append({'host':host,'path':u.path,'clinician':selected['key'] if selected else None})
        label=selected['name'] if selected else 'Practice-wide scheduling'
        route.fulfill(status=200,content_type='text/html',body='<!doctype html><title>Intercepted scheduling destination</title><link rel="icon" href="data:,"><h1>Scheduling destination intercepted</h1><p>'+escape(label)+'</p><p>No request reached SimplePractice. This fixture makes no claim about available services or appointments.</p>')
        return
    if r.method not in ['GET','HEAD']:
        report['blockedWrites'].append({'method':r.method,'host':host,'path':u.path})
    route.abort()

def state(page,label):
    item={'label':label,'host':urlsplit(page.url).hostname,'path':urlsplit(page.url).path,'text':page.locator('body').inner_text()[:9000]}
    report['states'].append(item)
    page.screenshot(path=str(OUT/(label+'.png')))
    return item['text']

try:
    with sync_playwright() as p:
        cases=[('hero-desktop','/','.mh-hero a[data-mft-booking]',1440,None),
               ('header-desktop','/','header a[data-mft-booking]',1440,None),
               ('closing-desktop','/','.mh-closing a[data-mft-booking]',1440,None),
               ('hero-mobile','/','.mh-hero a[data-mft-booking]',390,None),
               ('header-mobile','/','header a[data-mft-booking]',390,None),
               ('footer-mobile','/','footer a[data-mft-booking]',390,None),
               ('starting-care','/how-to-start-therapy/','main a[data-mft-booking]',1440,None),
               ('individual-care','/new-page/','main a[data-mft-booking]',390,None)]
        for c in CONFIG['clinicians']:
            cases.append((c['key']+'-profile','/'+c['slug']+'/','main a[data-spwidget-clinician-id="'+c['id']+'"]',1440,c))
        for engine,engine_cases in [('chromium',cases),('webkit',[cases[0],cases[3]])]:
            if engine not in report['requestedEngines']:continue
            options={'headless':True}
            if engine=='chromium':options['args']=['--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND']
            if engine=='chromium' and (os.getenv('CHROME_PATH') or os.getenv('MFT_CHROMIUM')):
                options['executable_path']=os.getenv('CHROME_PATH') or os.getenv('MFT_CHROMIUM')
            browser=getattr(p,engine).launch(**options)
            for label,path,selector,width,clinician in engine_cases:
                label=engine+'-'+label
                context=browser.new_context(viewport={'width':width,'height':950},reduced_motion='reduce',service_workers='block')
                context.route('**/*',guard)
                page=context.new_page();page.set_default_timeout(25000)
                response=page.goto(BASE+path,wait_until='domcontentloaded');assert response.status==200
                assert page.locator('script[src*="integration-1.0"]').count()==0
                assert page.locator('[data-spwidget-autobind]').count()==0
                configured=page.evaluate('window.MFT_BOOKING_CONFIG')
                for key in ['scopeId','applicationId','scopeUri','clinicians']:
                    assert configured[key]==CONFIG[key], 'Published candidate scheduling configuration drift: '+key
                if page.locator('script[data-mft-measurement-controller="first-party"]').count():
                    notice=page.get_by_role('dialog',name='Analytics privacy choice')
                    expect(notice).to_be_visible()
                    for name in ['Close analytics notice','Decline','Allow analytics']:
                        expect(notice.get_by_role('button',name=name,exact=True)).to_be_in_viewport(ratio=1)
                    assert page.evaluate('window.MFTAnalyticsConsent.status()')=='unset'
                    # Deliberately leave the notice open. A normal pointer click
                    # on scheduling must work without deciding about analytics.
                button=page.locator(selector).first
                if not button.is_visible() and 'header-mobile' in label:page.locator('.menu-button').click()
                href=button.get_attribute('href');assert button.get_attribute('target') in [None,'','_self']
                if clinician:assert parse_qs(urlsplit(href).query)['clinicianId']==[clinician['id']]
                else:assert href=='https://'+PORTAL+'/request'
                before=len(report['interceptedDestinations'])
                button.click()
                gate=page.locator('.mft-consultation-gate')
                if gate.count() and gate.is_visible():
                    go=gate.locator('[data-consultation-continue]')
                    expect(go).to_be_disabled();assert go.get_attribute('href') is None
                    if button.get_attribute('data-mft-ten-minute-consultation')=='true':
                        expect(gate.locator('[data-mft-consultation-ack]')).to_be_visible()
                        assert '10-minute phone consultation' in gate.inner_text() and '30-minute couples consultation' in gate.inner_text()
                go=acknowledge_scheduling_dialog(page)
                if go is not None:
                    expect(go).to_be_enabled()
                    assert go.get_attribute('href')==href
                    go.click()
                page.wait_for_url(href)
                host=urlsplit(page.url).hostname
                page.get_by_role('heading',name='Scheduling destination intercepted',exact=True).wait_for(state='visible')
                if clinician:
                    page.get_by_text(clinician['name'],exact=True).wait_for(state='visible')
                    assert parse_qs(urlsplit(page.url).query).get('clinicianId')==[clinician['id']]
                else:page.get_by_text('Practice-wide scheduling',exact=True).wait_for(state='visible')
                assert len(context.pages)==1,'Booking unexpectedly opened a popup'
                assert len(report['interceptedDestinations'])==before+1, 'A native activation must reach exactly one intercepted destination'
                state(page,label)
                assert not report['forbiddenRequests'] and not report['blockedWrites']
                report['checks'].append({'label':label,'pass':True,'sameTab':True,'destinationHost':host,'configurationVerified':True,'schedulerIntercepted':True})
                context.close()
            if engine=='chromium':
                context=browser.new_context(java_script_enabled=False,service_workers='block')
                context.route('**/*',guard);page=context.new_page()
                page.goto(BASE+'/',wait_until='domcontentloaded')
                a=page.locator('.mh-hero a[data-mft-booking]').first
                assert a.get_attribute('href')=='https://'+PORTAL+'/request'
                with page.expect_navigation(wait_until='domcontentloaded') as nav:a.click()
                assert nav.value.status==200 and urlsplit(page.url).hostname==PORTAL
                report['staticLinkNavigatesWithoutJavaScript']=True
                assert not report['forbiddenRequests'] and not report['blockedWrites']
                context.close()
            browser.close()
    report['pass']=True
except Exception as e:
    report['error']=str(e)
    try:
        page.screenshot(path=str(OUT/'failure.png'))
        report['failureUrl']=urlsplit(page.url).hostname+urlsplit(page.url).path
    except Exception:pass
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k not in ['states','blockedWrites']},indent=2))
