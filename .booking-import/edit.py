from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
BASE_HASHES={'content/autumn-profile.json':'04ad4ccb38b565fa86f8a785948e79fbaa6dee751144ee753d3a21045d10454b','content/clinician-registry.json':'7fd2331b6249c203b09bbcc90663811e5cc507df4b6974e03c1fecab34627e73','content/simplepractice-booking.json':'d9f528394fa42cf891c7f16c9afe9c25cb7e6bef034b955a69a06807b775e789','scripts/validate-booking.js':'8b3cc4e9de818e9960b56b878accd2d56fc0438a92236403b5c30dccddacff65','src/assets/portraits.css':'bd2b89eee79a242484614170b5bdfa88f6355b19e59546227f25b083f918f1a8','src/autumn-profile.js':'b3fa22f5594ee06ed91f1525285e29aad154dd4f1217189cfa8892f3cf9bc3af','src/booking-build.js':'5a35e0a5fa2d1b939bd9395c8630ac0572638d6867fa662bafeff8a73722df04','src/booking-core.js':'c3a00030687aaa8aea1ab887dd4495483583b7c618dce6b2cff3e193e393eb5d','src/build.js':'26d9a717974d10ca3d15f4bafc35ecf244743278ae1716b8e5218853f78ff8c5','src/homepage-refresh.js':'c29addfdbbf210bd2e3db962af45aba2cf5fc82796521e303dc0a234630a0fd5','src/reference-pages.js':'f8bef659b1a44290ee7c5f9d76d9ec2e0c751ec87186c733004c286ca4da3ca8','tests/autumn-taylor.test.js':'77d354db5902e06c2df366e2b687cb46afe3a4628321e36e0ddb2749e85bb3ae','tests/clinician-presentation.test.js':'0ffc648f53552e216cb3c46ee7791a48ee1d3ebfb30b30495fb0c91e2a358ee5','tests/clinician-update-browser.py':'fc928a2b542f127d51b6bdfb05168bbf4b9bd3e141a099316aafa99f9909219e','tests/scheduling-actions.test.js':'976b040044959ee03bc0450388fd6e3fc9b08d60cf52407fd72383c24b2667c6'}
for file,digest in BASE_HASHES.items():
 assert hashlib.sha256((root/file).read_bytes()).hexdigest()==digest,(file,'Source changed; inspect before editing')
def change(file,old,new,count=1):
 p=root/file;s=p.read_text();assert s.count(old)==count,(file,s.count(old),old[:100]);p.write_text(s.replace(old,new))
p=root/'content/simplepractice-booking.json';j=json.loads(p.read_text());j['clinicians'].append({'key':'autumn','name':'Autumn Alexander','slug':'autumn-alexander','id':'2183370','channel':'client_portal'});p.write_text(json.dumps(j,indent=2)+'\n')
change('src/booking-core.js',"channel: 'professional_website', appearance:","channel: clinician.channel === 'client_portal' ? 'client_portal' : 'professional_website', appearance:")
p=root/'content/autumn-profile.json';j=json.loads(p.read_text());j['booking'].update(status='configured',label='Request an appointment with Autumn',note="Open Autumn's SimplePractice calendar to choose the appropriate appointment type and view the options shown there. Confirm appointment format and age eligibility before requesting. A request is not a confirmed booking until accepted by the practice.");p.write_text(json.dumps(j,indent=2,ensure_ascii=False)+'\n')
change('content/clinician-registry.json','"bookingStatus": "contact-practice"','"bookingStatus": "configured"')
(root/'src/autumn-booking.js').write_text('''"use strict";
// The owner supplied this clinician mapping on 2026-11-12. No service or slot is preselected.
const core = require('./booking-core');
const config = require('../content/simplepractice-booking.json');
const profile = require('../content/autumn-profile.json');
const {esc} = require('./ui/home-components');
const clinician = core.clinicianForPath(config, '/' + profile.slug + '/');
if (!clinician || clinician.key !== 'autumn') throw new Error('Autumn scheduling configuration is required');
const calendar = core.destination(config, clinician);
function button(className = 'experience-inline mft-autumn-card-action') {
  return `<a class="${esc(className)}" data-mft-clinician="autumn" href="${esc(calendar)}" rel="noopener noreferrer">${esc(profile.booking.label)}</a>`;
}
module.exports = {calendar, button};
''')
change('src/booking-build.js',"const clinician = inSection('header',pos) || inSection('footer',pos) ? null : routeClinician;","// Match browser behavior: an explicit clinician card stays specific without JavaScript.\n    const explicitKey = attrs.match(/\\bdata-mft-clinician=\"([^\"]+)\"/i)?.[1];\n    const explicit = config.clinicians.find(c => c.key === explicitKey);\n    const clinician = explicit || (inSection('header',pos) || inSection('footer',pos) ? null : routeClinician);")
change('src/build.js',"const autumnProfile = require('../content/autumn-profile.json');","const autumnProfile = require('../content/autumn-profile.json');\nconst autumnBooking = require('./autumn-booking');")
change('src/build.js','Contact the practice about appointments.','Request an appointment through SimplePractice.')
change('src/build.js','<a class="button primary" href="${esc(autumnProfile.booking.contactUrl)}">${esc(autumnProfile.booking.label)}</a>','${autumnBooking.button("button primary")}')
old='${clinicians.map(c=>`<a class="person" href="${localFor(c)}">${presentation.portrait(c.image,c.name,\'directory\')}${presentation.identity(c.slug,\'b\')}</a>`).join(\'\')}'
new='${clinicians.map(c=>c.slug===autumnProfile.slug?`<article class="person mft-autumn-team-card"><a href="${localFor(c)}">${presentation.portrait(c.image,c.name,\'directory\')}${presentation.identity(c.slug,\'b\')}</a>${autumnBooking.button()}</article>`:`<a class="person" href="${localFor(c)}">${presentation.portrait(c.image,c.name,\'directory\')}${presentation.identity(c.slug,\'b\')}</a>`).join(\'\')}'
change('src/build.js',old,new)
change('src/autumn-profile.js',"const scheduling = require('./scheduling-actions');","const scheduling = require('./scheduling-actions');\nconst booking = require('./autumn-booking');")
change('src/autumn-profile.js','<h2>Ask about working with Autumn</h2>','<h2>Request an appointment with Autumn</h2>',2)
change('src/autumn-profile.js','<a class="experience-inline" href="${esc(profile.booking.contactUrl)}">${esc(profile.booking.label)}</a>','${booking.button("experience-inline")}')
change('src/autumn-profile.js','<a class="mft-schedule-button" href="${esc(profile.booking.contactUrl)}">${esc(profile.booking.label)}</a>','${booking.button("mft-schedule-button")}')
change('src/autumn-profile.js','<p>Confirm the appropriate appointment with the practice before requesting a time.</p>','<p>Choose the appropriate service in SimplePractice. Requests are not confirmed appointments until accepted by the practice.</p>')
change('src/homepage-refresh.js','</div></a></article>`;','</div></a>${p.slug===\'autumn-alexander\'?`<div class="mh-person-copy">${require(\'./autumn-booking\').button(\'mh-text-link mft-autumn-card-action\')}</div>`:\'\'}</article>`;')
change('src/reference-pages.js','</span></a></div></article>`;','</span></a>${person.slug===\'autumn-alexander\'?require(\'./autumn-booking\').button():\'\'}</div></article>`;')
p=root/'src/assets/portraits.css';p.write_text(p.read_text()+'''\n/* Native Autumn calendar actions stay separate from profile links. */
.mft-autumn-card-action{display:flex;align-items:center;min-height:44px;margin-top:.5rem;line-height:1.6;text-underline-offset:.2em;overflow-wrap:anywhere}
.mft-autumn-team-card>a:first-child{display:block;text-decoration:none}
.mh-person[data-home-clinician="autumn-alexander"] .mh-person-link{height:auto}
.mft-autumn-card-action:focus-visible{outline:3px solid var(--gold,#b88b32);outline-offset:4px}
''')
change('tests/autumn-taylor.test.js',"test('Autumn has an honest practice-contact action and no invented clinician booking identity',()=>{\n const h=read(profile.slug),hero=h.match(/<section class=\"hero mft-clinician-hero\"[\\s\\S]*?<\\/section>/)[0];\n assert.ok(hero.includes(profile.booking.contactUrl));assert.ok(hero.includes(profile.booking.label));\n assert.equal(booking.clinicians.some(p=>p.slug===profile.slug),false);\n assert.doesNotMatch(hero,/clinicianId=|data-mft-clinician=|https:\\/\\/ops\\./);\n assert.match(h,/Our team can help arrange the right starting appointment/);\n});","test('Autumn uses the owner-supplied calendar and retains secondary practice contact',()=>{\n const h=read(profile.slug),hero=h.match(/<section class=\"hero mft-clinician-hero\"[\\s\\S]*?<\\/section>/)[0];\n assert.match(hero,/clinicianId=2183370/);assert.ok(hero.includes(profile.booking.label));\n assert.equal(booking.clinicians.find(p=>p.slug===profile.slug).id,'2183370');\n assert.doesNotMatch(hero,/mailto:|https:\\/\\/ops\\./);\n assert.ok(h.includes(profile.booking.contactUrl));assert.match(h,/A request is not a confirmed booking/);\n});")
change('tests/autumn-taylor.test.js','assert.equal(booking.clinicians.length,5);','assert.equal(booking.clinicians.length,6);')
change('tests/clinician-presentation.test.js',"assert.equal(people.find(p=>p.slug==='autumn-alexander').bookingStatus,'contact-practice');","assert.equal(people.find(p=>p.slug==='autumn-alexander').bookingStatus,'configured');")
change('tests/clinician-presentation.test.js',"assert.equal(booking.clinicians.some(p=>p.slug==='autumn-alexander'),false);","assert.equal(booking.clinicians.find(p=>p.slug==='autumn-alexander').id,'2183370');")
change('tests/scheduling-actions.test.js','/Ask about appointments with Autumn/','/Request an appointment with Autumn/')
change('tests/clinician-update-browser.py',"profile = json.loads((ROOT / 'content/autumn-profile.json').read_text())","profile = json.loads((ROOT / 'content/autumn-profile.json').read_text())\nfrom urllib.parse import urlsplit, parse_qs\ndef autumn_calendar(href):\n    u=urlsplit(href); q=parse_qs(u.query)\n    return u.scheme=='https' and u.netloc=='clientsecure.me' and u.path=='/widget-redirect' and q.get('clinicianId')==['2183370'] and q.get('channel')==['client_portal']")
change('tests/clinician-update-browser.py',"assert primary.get_attribute('href') == profile['booking']['contactUrl']","assert autumn_calendar(primary.get_attribute('href'))")
change('tests/clinician-update-browser.py',"assert page.locator('.mft-clinician-hero a').first.get_attribute('href')==profile['booking']['contactUrl']","assert autumn_calendar(page.locator('.mft-clinician-hero a').first.get_attribute('href'))")
change('tests/clinician-update-browser.py','native contact and Taylor calendar links','native Autumn and Taylor calendar links')
change('scripts/validate-booking.js',"const targetClinician = clinician && !inTag('header') && !inTag('footer') ? clinician : null;","const explicitKey = m[1].match(/\\bdata-mft-clinician=\"([^\"]+)\"/i)?.[1];\n    const explicit = config.clinicians.find(c => c.key === explicitKey);\n    if (explicitKey && !explicit) errors.push(`Unknown explicit clinician: ${route}`);\n    const targetClinician = explicit || (clinician && !inTag('header') && !inTag('footer') ? clinician : null);")
