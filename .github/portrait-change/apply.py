from pathlib import Path
import json, subprocess
root=Path.cwd()
staged=root/'.github/portrait-change'
assert subprocess.check_output(['git','rev-parse','HEAD^'],text=True).strip()=='2ef11c38c1db1dc0b25c3e6b03738ea5a69cd14d', 'Unexpected parent: do not apply to changed source'
p=root/'content/clinician-registry.json'
d=json.loads(p.read_text()); licenses={'kody-evans-bio':'LMFT','dr-nolan':'Ph.D.; LMHC (WA); LCPC (MT)','emily-johnsrud-bio':'LMFTA','gary-ashley':'LMHCA','new-page-47':'LSWAIC'}
for c in d['clinicians']:
 if c['slug']=='kody-evans-bio': c['name']='Kody Evans'
 c['license']=licenses[c['slug']]
p.write_text(json.dumps(d,indent=2)+'\n')
for source,target in [('clinician-presentation.js','src/ui/clinician-presentation.js'),('portraits.css','src/assets/portraits.css'),('clinician-presentation.test.js','tests/clinician-presentation.test.js'),('clinician-portraits-browser.cjs','tests/clinician-portraits-browser.cjs'),('clinician-portraits.yml','.github/workflows/clinician-portraits.yml')]:
 p=root/target;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((staged/source).read_bytes())
p=root/'src/build.js';s=p.read_text();s=s.replace("const path = require('path');","const path = require('path');\nconst presentation = require('./ui/clinician-presentation');")
s=s.replace("['Kody Evans, LMFT','kody-evans-bio'","['Kody Evans','kody-evans-bio'")
s=s.replace("type:'clinician', name, slug, credential, clients, specialties, eyebrow:credential, h1:name, summary, image,", "type:'clinician', name:presentation.person(slug).name, slug, credential, clients, specialties, eyebrow:credential, h1:presentation.person(slug).name, summary, image,")
old='<img src="${c.image}" alt="${esc(c.name)}, clinician at Marriage.Family.Therapy" loading="lazy" referrerpolicy="no-referrer"><span><b>${esc(c.name)}</b><small>${esc(c.credential)}</small></span>'
new="${presentation.portrait(c.image,c.name,'directory')}${presentation.identity(c.slug,'b')}"
assert old in s;s=s.replace(old,new)
start=s.index('<section class="hero"><img class="hero-media" src="${p.image}"',s.index('function pageHtml'))
end=s.index('</section>',start)+len('</section>');old=s[start:end]
s=s[:start]+"${p.type==='clinician'?presentation.hero(p,heroActions):`"+old+"`}"+s[end:];p.write_text(s)
p=root/'src/reference-pages.js';s=p.read_text();s=s.replace("const ui=require('./ui/home-components');", "const ui=require('./ui/home-components');\nconst presentation=require('./ui/clinician-presentation');")
old='<div class="mft-portrait-frame" data-portrait-frame><img src="${ui.esc(profileImage(person.slug))}" alt="${ui.esc(person.name)}" data-portrait-fit="contain" loading="lazy" referrerpolicy="no-referrer"></div><div><h3>${ui.esc(person.name)}</h3><p>${ui.esc(person.credential)}</p></div>'
assert old in s;s=s.replace(old,"${presentation.portrait(profileImage(person.slug),person.name)}${presentation.identity(person.slug)}");p.write_text(s)
p=root/'src/seo-expansion-engine.js';s=p.read_text();s=s.replace("const path=require('path');","const path=require('path');\nconst presentation=require('./ui/clinician-presentation');")
old='<b>${esc(cl.name)}</b><span>${esc(cl.credential)}</span>'
assert old in s;s=s.replace(old,"${presentation.identity(cl.slug,'b')}");p.write_text(s)
p=root/'src/site-experience.js';s=p.read_text();s=s.replace("const booking = require('./booking-build');","const booking = require('./booking-build');\nconst presentation = require('./ui/clinician-presentation');")
old='<span class="experience-topic-title">${esc(p.name)}</span><span class="experience-topic-description">${esc(p.credential)}</span>'
assert old in s;s=s.replace(old,"${presentation.identity(p.slug,'b')}");p.write_text(s)
p=root/'src/editorial-library.js';s=p.read_text();s=s.replace("const crypto = require('node:crypto');","const crypto = require('node:crypto');\nconst presentation = require('./ui/clinician-presentation');")
old='<h3><a href="/${c.slug}/">${esc(person.name)}</a></h3><p>${esc(label)}</p>'
assert old in s;s=s.replace(old,'<a class="mft-clinician-profile-link" href="/${c.slug}/">${presentation.identity(c.slug)}</a><p>${esc(label)}</p>');p.write_text(s)
p=root/'src/redesign.js';s=p.read_text();s=s.replace("const path=require('path');","const path=require('path');\nconst presentation=require('./ui/clinician-presentation');")
old='<img src="${CHARLENE}" alt="Charlene Brister, Clinical Manager at Marriage.Family.Therapy" loading="lazy">'
assert old in s;s=s.replace(old,"${presentation.portrait(CHARLENE,'Charlene Brister, Clinical Manager','staff')}");p.write_text(s)
p=root/'src/editorial-check.js';s=p.read_text();old='const cards = main.match(/<div class="ed-clinician-grid">[\\s\\S]*?<\\/div>/)';new='const cards = main.match(/<section class="ed-clinicians">[\\s\\S]*?<\\/section>/)';assert old in s;s=s.replace(old,new);p.write_text(s)
