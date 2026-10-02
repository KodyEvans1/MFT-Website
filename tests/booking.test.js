'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const core = require('../src/booking-core');
const {decorateHtml,config} = require('../src/booking-build');
for (const [key,id] of [['gary','2154633'],['kody','1701440'],['emily','2027366'],['taylor','2031820'],['sonia','2065412']]) {
  test('owner supplied SimplePractice mapping: '+key, () => {
    const c = config.clinicians.find(x=>x.key===key);
    assert.equal(c.id,id); assert.equal(core.clinicianForPath(config,'/'+c.slug).id,id);
    const u = new URL(core.destination(config,c)); assert.equal(u.searchParams.get('clinicianId'),id);
    assert.equal(u.searchParams.get('scopeId'),config.scopeId);
    assert.equal(u.searchParams.get('appearance'),'{"fullScreen":true}');
    assert.equal(core.attributes(config,c)['data-spwidget-clinician-id'],id);
    assert.equal(core.attributes(config,c)['data-spwidget-scope-global'],undefined);
  });
}
test('general scheduling has the exact practice fallback and scope-global', () => {
  assert.equal(core.destination(config,null),'https://marriagefamilytherapy.clientsecure.me');
  assert.ok('data-spwidget-scope-global' in core.attributes(config,null));
  assert.equal(core.attributes(config,null)['data-spwidget-clinician-id'],undefined);
  assert.throws(()=>core.destination(config,{id:'unknown'}));
});
for (const label of ['Existing client portal','Verify insurance','Staff operations','Marriage.Reset assessment']) test('does not hijack '+label,()=>{
  assert.equal(core.isAppointment(config.generalUrl,label),false);
});
for (const [query,referrer,source,medium] of [
  ['?gclid=Valid_Click-1','','google','cpc'],
  ['?gbraid=Valid1','','google','cpc'],
  ['?wbraid=Valid2','','google','cpc'],
  ['?utm_source=google&utm_medium=cpc','','google','cpc'],
  ['?utm_source=google&utm_medium=organic','','google','organic'],
  ['?utm_source=google','','google','unknown'],
  ['','https://www.google.com/search?q=private','google','organic'],
  ['','https://www.google.com.evil.example/search','referral','referral'],
  ['','https://www.mft.care/team','direct','none'],
  ['','','direct','none'],
]) test('source distinction '+query+' '+referrer,()=>{
  const a=core.acquisition(query,referrer,'https://www.mft.care');
  assert.equal(a.source,source); assert.equal(a.medium,medium);
});
test('campaign IDs survive; sensitive/free-text parameters never leave the classifier',()=>{
  const a=core.acquisition('?utm_source=google&utm_medium=cpc&utm_campaign_id=123&utm_adgroup_id=456&utm_creative_id=789&utm_network=g&utm_device=m&utm_term=private-health&utm_campaign=secret&email=name%40example.com&gclid=abc','','https://www.mft.care');
  assert.equal(a.campaignId,'123'); assert.equal(a.adGroupId,'456'); assert.equal(a.creativeId,'789');
  assert.equal(a.network,'g'); assert.equal(a.device,'m');
  assert.doesNotMatch(JSON.stringify(a),/private-health|secret|example|gclid/);
  assert.equal(core.acquisition('?utm_source=google&utm_medium=cpc&utm_campaign_id=my-diagnosis','','').campaignId,null);
});
test('no measurement on previews, local pages, assessments, GPC or DNT',()=>{
  const c={measurementEnabled:true}, l={origin:'https://www.mft.care',pathname:'/'};
  assert.equal(core.shouldMeasure(c,l,{}),true);
  assert.equal(core.shouldMeasure({},l,{}),false);
  for (const origin of ['http://localhost:3000','https://deploy-preview-1--marriagefamilytherapy.netlify.app']) assert.equal(core.shouldMeasure(c,{...l,origin},{}),false);
  assert.equal(core.shouldMeasure(c,{...l,pathname:'/marriage-reset-assessment/'},{}),false);
  assert.equal(core.shouldMeasure(c,l,{globalPrivacyControl:true}),false);
  assert.equal(core.shouldMeasure(c,l,{doNotTrack:'1'}),false);
});
const anchor='<a class="button primary" href="https://marriagefamilytherapy.clientsecure.me/">Schedule a free consultation</a>';
const documentHtml = '<html><head></head><body><header>'+anchor+'</header><main>'+anchor+'<a href="https://marriagefamilytherapy.clientsecure.me/">Existing client portal</a></main><footer>'+anchor+'</footer></body></html>';
test('profile content selects clinician; navigation/footer stay general; design classes preserved',()=>{
  const r=decorateHtml(documentHtml,'/gary-ashley/');
  assert.equal((r.html.match(/data-spwidget-clinician-id="2154633"/g)||[]).length,1);
  assert.equal((r.html.match(/data-spwidget-scope-global=/g)||[]).length,2);
  assert.equal((r.html.match(/class="button primary"/g)||[]).length,3);
  assert.match(r.html,/<a href="https:\/\/marriagefamilytherapy.clientsecure.me\/">Existing client portal<\/a>/);
  assert.equal(r.html.split('src="'+config.loaderUrl+'"').length-1,1);
  assert.equal(decorateHtml(r.html,'/gary-ashley/').html,r.html);
});
test('sensitive forms retain usable fallback but no widget/measurement loader',()=>{
  const r=decorateHtml(documentHtml,'/marriage-reset-assessment/');
  assert.equal(r.widget,false); assert.doesNotMatch(r.html,/src=".*mft-booking|integration-1.0.js/);
});
test('public insurance does not route into staff dashboard',()=>{
  const r=decorateHtml(documentHtml.replace('</main>','<a href="https://ops.mft.care/">Verify insurance</a></main>'),'/');
  assert.match(r.html,/mailto:support@mft.care\?subject=Benefits%20verification/);
  assert.match(r.html,/https:\/\/ops.mft.care\/" rel="nofollow">Staff operations/);
});
test('measurement page codes ignore query and normalize trailing slash',()=>{
  assert.equal(core.pageCode('/team/?email=anything'),core.pageCode('/team'));
  assert.equal(core.normalizePath('/'),'/');
});
