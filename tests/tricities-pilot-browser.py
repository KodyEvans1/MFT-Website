"""Candidate-only QA. Optional public reads never sign in or select a time slot."""
import json, mimetypes, os, re
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/tricities-pilot';OUT.mkdir(parents=True,exist_ok=True)
BASE='https://www.mft.care';PATH='/online-therapy-tri-cities-wa/'
VERIFY=os.getenv('MFT_VERIFY_PUBLIC')=='true'
CSP=re.search(r'Content-Security-Policy: ([^\n]+)',(ROOT/'dist/_headers').read_text())[1]
report={'candidatePass':False,'environment':'local built candidate, not deployed','checks':[], 'publicAudit':[], 'scheduler':[],
        'blockedWrites':[], 'scope':'No sign-in, appointment submission, time-slot selection, contact details or Google Analytics collection.'}

def guard(route):
    r=route.request;u=urlsplit(r.url);h=u.hostname or ''
    if r.method=='GET' and h=='www.mft.care':
        f=ROOT/'dist'/u.path.lstrip('/')
        if u.path.endswith('/') or not f.suffix:f=f/'index.html'
        if not f.is_file():route.fulfill(status=404,body='Missing');return
        route.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':mimetypes.guess_type(str(f))[0] or 'application/octet-stream','Content-Security-Policy':CSP,'Referrer-Policy':'no-referrer'})
    elif VERIFY and not any(x in h for x in ['google','sentry','segment','bugsnag','facebook','doubleclick']):
        public_host=h.endswith('.clientsecure.me') or h=='clientsecure.me' or h.endswith('.simplepractice.com')
        read_post=r.method=='POST' and h=='marriagefamilytherapy.clientsecure.me' and u.path=='/client-portal-api/clinician-search/next-slots'
        if public_host and (r.method in ['GET','HEAD'] or read_post):route.continue_()
        else:route.abort()
    else:
        if r.method not in ['GET','HEAD']:report['blockedWrites'].append({'method':r.method,'host':h,'path':u.path})
        route.abort()

def choose(page,label):
    text=page.get_by_text(label,exact=True).first
    text.wait_for(state='visible',timeout=15000)
    control=text.locator('xpath=ancestor-or-self::*[self::a or self::button][1]')
    if control.count():control.click();return
    group=text.locator('xpath=ancestor::*[.//button or .//a][1]')
    controls=group.get_by_role('button',name=re.compile('^select$',re.I))
    if not controls.count():controls=group.get_by_role('link',name=re.compile('^select$',re.I))
    if controls.count():controls.first.click()
    else:text.click()

try:
    if VERIFY:
        for suffix in ['', '/']:
            item={'url':BASE+PATH.rstrip('/')+suffix}
            try:
                with urlopen(Request(item['url'],headers={'Cache-Control':'no-cache'}),timeout=20) as r:
                    html=r.read().decode();item.update(status=r.status,finalUrl=r.geturl())
                item['newSchedulingButtons']='data-scheduling-actions="20261029"' in html
                item['pilotAlreadyLive']='data-tricities-pilot="20261105"' in html
                item['obsoletePhrases']=[x for x in ['Once you have the code','fee automatically','free virtual free virtual'] if x in html]
                (OUT/('live-before'+('-slash' if suffix else '')+'.html')).write_text(html)
            except Exception as e:item['error']=str(e)
            report['publicAudit'].append(item)
    with sync_playwright() as p:
        options={'headless':True}
        if os.getenv('MFT_CHROMIUM'):options['executable_path']=os.environ['MFT_CHROMIUM']
        browser=p.chromium.launch(**options)
        for width in [1440,768,390,320]:
            for privacy in ['declined','blocked']:
                c=browser.new_context(viewport={'width':width,'height':1000 if width>=768 else 844},reduced_motion='reduce')
                c.route('**/*',guard)
                if privacy=='declined':c.add_init_script("localStorage.setItem('mft.analytics.consent.v2','denied')")
                else:c.add_init_script("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true})")
                page=c.new_page();page.set_default_timeout(15000)
                page.goto(BASE+PATH,wait_until='domcontentloaded')
                assert page.locator('h1').count()==1
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                assert page.locator('iframe[title="Optional website traffic measurement"]').count()==0
                assert page.locator('.tc-hero [data-pilot-appointment]').get_attribute('href')=='https://marriagefamilytherapy.clientsecure.me/request'
                assert page.locator('.tc-returning [data-mft-existing-client]').get_attribute('href').endswith('/sign-in')
                assert page.locator('.tc-hero [data-mft-couples-consultation]').count()==0
                page.locator('.tc-secondary').click()
                assert page.url.endswith('#optional-consultations')
                page.get_by_role('link',name='Schedule a free 10-minute phone consultation',exact=True).click()
                gate=page.locator('.mft-consultation-gate');assert gate.is_visible()
                gate.locator('input[type=checkbox]').check()
                assert gate.locator('[data-consultation-continue]').get_attribute('href').endswith('/request')
                page.keyboard.press('Escape');assert not gate.is_visible()
                page.evaluate('window.scrollTo(0,0)')
                if privacy=='declined' and width in [1440,390]:
                    page.screenshot(path=str(OUT/f'tricities-{width}.png'),full_page=True)
                    page.screenshot(path=str(OUT/f'tricities-opening-{width}.png'))
                report['checks'].append({'width':width,'privacy':privacy,'pass':True})
                if VERIFY and width in [1440,390]:
                    page.locator('.tc-hero [data-pilot-appointment]').click()
                    page.wait_for_url(re.compile(r'^https://marriagefamilytherapy\.clientsecure\.me/request'))
                    page.get_by_text('Kody Evans',exact=True).first.wait_for(state='visible')
                    report['checks'].append({'width':width,'privacy':privacy,'publicSchedulerEntry':True})
                    assert len(c.pages)==1
                c.close()
        c=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});c.route('**/*',guard)
        page=c.new_page();page.goto(BASE+PATH,wait_until='domcontentloaded')
        assert page.locator('.tc-hero [data-pilot-appointment]').get_attribute('href').endswith('/request')
        assert page.locator('#optional-consultations').count()==1
        report['checks'].append({'noJavaScript':True,'pass':True});c.close()
        report['candidatePass']=True
        if VERIFY:
            for width in [1440,390]:
                for label,selector,signin in [
                    ('free consultation','#optional-consultations a:has-text("Schedule a free 10-minute")',False),
                    ('paid individual consultation','#optional-consultations a:has-text("Request a paid 30-minute")',False),
                    ('existing client','.tc-returning [data-mft-existing-client]',True)]:
                    c=browser.new_context(viewport={'width':width,'height':900});c.route('**/*',guard)
                    c.add_init_script("localStorage.setItem('mft.analytics.consent.v2','denied')")
                    page=c.new_page();page.goto(BASE+PATH,wait_until='domcontentloaded');page.locator(selector).click()
                    gate=page.locator('.mft-consultation-gate')
                    if gate.is_visible():
                        assert label=='free consultation'
                        gate.locator('input[type=checkbox]').check();gate.locator('[data-consultation-continue]').click()
                    expected='sign-in' if signin else 'request'
                    page.wait_for_url(re.compile('^https://marriagefamilytherapy\\.clientsecure\\.me/'+expected))
                    if not signin:page.get_by_text('Kody Evans',exact=True).first.wait_for(state='visible')
                    assert len(c.pages)==1
                    report['checks'].append({'width':width,'action':label,'publicDestination':expected,'pass':True})
                    c.close()
            # Public calendar observations do not substitute for Charlene's roster approval.
            for name in ['Kody Evans','Gary Ashley','Sonia Hassan']:
                c=browser.new_context();c.route('**/*',guard);page=c.new_page();page.set_default_timeout(15000)
                item={'clinician':name,'calendarReached':False,'staffApprovalVerified':False}
                try:
                    page.goto(BASE+PATH,wait_until='domcontentloaded')
                    if page.locator('[data-choice="deny"]').count():page.locator('[data-choice="deny"]').click()
                    page.locator('.tc-hero [data-pilot-appointment]').click()
                    choose(page,name);page.wait_for_timeout(750)
                    text=page.locator('body').inner_text()
                    item['serviceScreen']=text[:6000]
                    matches=page.get_by_text(re.compile(r'90791|diagnostic evaluation',re.I))
                    labels=[x.strip() for x in matches.all_text_contents() if len(x.strip())<180]
                    if not labels:raise ValueError('No unambiguous diagnostic evaluation option found; no substitute service selected')
                    choose(page,labels[0]);page.wait_for_timeout(700)
                    choose(page,'Telehealth');page.wait_for_timeout(1000)
                    item['calendarPath']=urlsplit(page.url).path
                    item['calendarReached']=bool(re.search(r'/date(?:/|$)',urlsplit(page.url).path))
                    item['calendarScreen']=page.locator('body').inner_text()[:6000]
                    page.screenshot(path=str(OUT/('calendar-'+name.lower().replace(' ','-')+'.png')))
                except Exception as e:item['blocker']=str(e)
                report['scheduler'].append(item);c.close()
        browser.close()
except Exception as e:
    report['error']=str(e)
    try:page.screenshot(path=str(OUT/'failure.png'))
    except Exception:pass
    raise
finally:
    (OUT/'result.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='scheduler'},indent=2))
