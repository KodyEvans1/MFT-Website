"""Synthetic transport diagnostics; every collector and scheduler is intercepted."""
import importlib.util, json, mimetypes, re, time
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('mft_scheduling_browser_harness',ROOT/'tests/scheduling-browser-harness.py')
harness=importlib.util.module_from_spec(spec);spec.loader.exec_module(harness)
OUT=ROOT/'tmp/scheduling-measurement';OUT.mkdir(parents=True,exist_ok=True)
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
GOOGLE={'www.google-analytics.com','region1.google-analytics.com'}
EVENTS={'page_view','first_visit','session_start','user_engagement','appointment_request_click','clinician_schedule_click','consultation_click','simplepractice_exit'}
trace=[];network=[];requests=[];cdp_network=[];cdp_ids={};console_errors=[]
result={'scope':'Local production-origin candidate; browser DNS denied independently of collector/scheduler interception. Transport attempts and callbacks are not GA4 receipt.','trace':trace,'network':network,'requests':requests,'cdpNetwork':cdp_network,'consoleErrors':console_errors}

def now():return time.time()*1000

def collect(url):
    u=urlsplit(url)
    return u.hostname in GOOGLE and u.path.endswith('/collect')

def describe(url,body=None):
    u=urlsplit(url);query=parse_qs(u.query,keep_blank_values=True);records=[]
    for line in (body or '').splitlines() or ['']:
        fields={**query,**parse_qs(line,keep_blank_values=True)}
        event=fields.get('en',[''])[0]
        records.append({'event':event if event in EVENTS else 'UNAPPROVED_EVENT',
                        'measurementId':fields.get('tid'),
                        'codedPage':bool(re.fullmatch(r'https://www\.mft\.care/p/[a-f0-9]{16}/',fields.get('dl',[''])[0])),
                        'parameterNames':sorted(fields)})
    return {'host':u.hostname,'path':u.path,'records':records}

def guard(route):
    req=route.request;u=urlsplit(req.url)
    if u.hostname=='www.mft.care':
        f=ROOT/'dist'/u.path.lstrip('/')
        if u.path.endswith('/') or not f.suffix:f=f/'index.html'
        if not f.is_file():route.fulfill(status=404,body='Not found');return
        route.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':mimetypes.guess_type(str(f))[0] or 'application/octet-stream','Content-Security-Policy':CSP,'Referrer-Policy':'no-referrer'})
    elif u.hostname=='www.googletagmanager.com' and u.path=='/gtag/js':route.fulfill(status=200,content_type='text/javascript',body=tag_source)
    elif collect(req.url):
        network.append({'t':now(),'kind':'intercepted-collector','resourceType':req.resource_type,**describe(req.url,req.post_data)})
        route.fulfill(status=204,body='')
    elif u.hostname in ['clientsecure.me','marriagefamilytherapy.clientsecure.me']:
        if req.is_navigation_request():network.append({'t':now(),'destination':'intercepted-scheduler'})
        route.fulfill(status=200,content_type='text/html',body='<h1>Intercepted scheduling. No real request.</h1>')
    else:
        network.append({'t':now(),'kind':'blocked-endpoint','host':u.hostname,'path':u.path,'resourceType':req.resource_type})
        route.abort()

def observe(req,kind):
    if collect(req.url):
        entry={'t':now(),'kind':kind,'resourceType':req.resource_type,**describe(req.url,req.post_data)}
        if kind=='requestfailed':entry['failure']=req.failure
        requests.append(entry)

def cdp_request(event):
    req=event['request']
    if collect(req['url']):
        details={'method':req.get('method'),'resourceType':event.get('type'),**describe(req['url'],req.get('postData'))}
        cdp_ids[event['requestId']]=details
        cdp_network.append({'t':event.get('wallTime',time.time())*1000,'kind':'requestWillBeSent',**details})

def cdp_end(event,kind):
    details=cdp_ids.get(event['requestId'])
    if details:
        entry={'t':now(),'kind':kind,**details}
        if kind=='loadingFailed':entry.update({'errorText':event.get('errorText'),'canceled':event.get('canceled')})
        cdp_network.append(entry)

def console_message(message):
    if message.text.startswith(('MFTPROBE ','MFTNET ')):trace.append(message.text)
    elif message.type=='error':
        codes=re.findall(r'net::ERR_[A-Z_]+',message.text)
        console_errors.append({'t':now(),'kind':'console-error','networkCodes':codes})

try:
    tag_source,provenance=harness.fetch_real_tag();result['googleLibrary']=provenance
    with sync_playwright() as p:
        browser=harness.launch_isolated_chromium(p);result['collectorDNSPreflight']='ERR_NAME_NOT_RESOLVED before routing or event scripts'
        interceptor=harness.install_browser_interceptor(browser,guard)
        result['collectorObserver']='Single browser-target CDP Fetch request-stage interceptor; complete bodies required'
        context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
        context.add_init_script("if(location.origin==='https://www.mft.care')localStorage.setItem('mft.analytics.consent.v3','granted')")
        context.add_init_script(path=ROOT/'tests/fixtures/scheduling-network-probe.js')
        context.on('request',lambda req:observe(req,'request'))
        context.on('requestfailed',lambda req:observe(req,'requestfailed'))
        context.on('requestfinished',lambda req:observe(req,'requestfinished'))
        page=context.new_page()
        page.on('console',console_message)
        session=context.new_cdp_session(page);session.send('Network.enable')
        session.on('Network.requestWillBeSent',cdp_request)
        session.on('Network.loadingFailed',lambda event:cdp_end(event,'loadingFailed'))
        session.on('Network.loadingFinished',lambda event:cdp_end(event,'loadingFinished'))
        page.goto('https://www.mft.care/?utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053',wait_until='domcontentloaded');page.wait_for_timeout(3000)
        for frame in page.frames:
            frame.evaluate((ROOT/'tests/fixtures/scheduling-transport-probe.js').read_text())
        free=page.locator('.mh-hero a[data-mft-ten-minute-consultation="true"]')
        free.click();page.wait_for_timeout(3000)
        page.locator('.mft-consultation-gate button[value="cancel"]').last.click();page.wait_for_timeout(100)
        free.click();page.locator('.mft-consultation-gate input[type="checkbox"]').check()
        page.locator('[data-consultation-continue]').click();page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request');page.wait_for_timeout(1000)
        context.close();interceptor.assert_ok();result['interceptedRequests']=interceptor.request_count;browser.close()
except Exception as error:
    result['error']=str(error)
    raise
finally:
    if 'interceptor' in globals():
        result['interceptorErrors']=interceptor.errors
        result['cancelledResources']=interceptor.cancelled_resources
        result['interceptedRequests']=interceptor.request_count
    (OUT/'transport-probe.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
