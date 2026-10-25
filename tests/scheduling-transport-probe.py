"""Synthetic-only diagnostics for message, gtag callback and navigation ordering."""
from pathlib import Path
import json
source=Path(__file__).with_name('scheduling-measurement-browser.py')
ns={'__file__':str(source),'__name__':'measurement_helpers'}
exec(compile(source.read_text().split('try:\n with sync_playwright()')[0],str(source),'exec'),ns)
trace=[]
with ns['sync_playwright']() as p:
 browser=p.chromium.launch(headless=True)
 c,page=ns['start'](browser,'/?utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053',consent='granted')
 page.on('console',lambda msg:trace.append(msg.text) if msg.text.startswith('MFTPROBE ') else None)
 ns['wait_event'](page,'page_view')
 for frame in page.frames:
  frame.evaluate('''()=>{
   const log=(kind,data)=>console.log('MFTPROBE '+JSON.stringify({t:performance.now(),kind,data}));
   window.addEventListener('message',e=>{if(e.data&&String(e.data.type).startsWith('mft:'))log('message',{type:e.data.type,id:e.data.id,names:e.data.names})});
   if(window.gtag){const old=window.gtag;window.gtag=function(){const a=Array.from(arguments);log('gtag',{command:a[0],name:a[1]});if(a[0]==='event'&&a[2]?.event_callback){const cb=a[2].event_callback;a[2]={...a[2],event_callback:()=>{log('callback',a[1]);cb()}};return old.apply(this,a)}}
   if(window.MFTSchedulingMeasurement){const old=window.MFTSchedulingMeasurement.track;window.MFTSchedulingMeasurement.track=function(names,placement,done){log('track',{names,placement,consent:window.MFTAnalyticsConsent.status()});return old.call(this,names,placement,done?()=>{log('navigation-done',names);done()}:undefined)}}
  }''')
 page.locator('.mh-hero a[data-mft-booking]').click();ns['wait_event'](page,'consultation_click')
 page.locator('.mft-consultation-gate button[value="cancel"]').last.click();page.wait_for_timeout(100)
 page.locator('.mh-hero a[data-mft-booking]').click();page.locator('.mft-consultation-gate input[type="checkbox"]').check()
 page.locator('[data-consultation-continue]').click();page.wait_for_url('https://marriagefamilytherapy.clientsecure.me/request');page.wait_for_timeout(500)
 result={'trace':trace,'network':ns['diagnostic']()}
 print(json.dumps(result,indent=2));(ns['OUT']/'transport-probe.json').write_text(json.dumps(result,indent=2))
 c.close();browser.close()
