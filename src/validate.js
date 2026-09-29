const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file = path.join(dir,entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.html')) htmlFiles.push(file);
  }
}
walk(DIST);

const errors=[];
const titles=new Map();
const descriptions=new Map();
const canonicals=new Map();
const count=(h,re)=>(h.match(re)||[]).length;
for (const file of htmlFiles) {
  const h=fs.readFileSync(file,'utf8');
  const is404=path.basename(file)==='404.html';
  const normalized=file.split(path.sep).join('/');
  const isAssessmentForm=normalized.endsWith('/marriage-reset-assessment/index.html');
  const isAssessmentThanks=normalized.endsWith('/marriage-reset-assessment/thanks/index.html');
  if (count(h,/<h1[ >]/g)!==1) errors.push(`${file}: expected one H1`);
  if (count(h,/<title>/g)!==1) errors.push(`${file}: expected one title`);
  if (!is404 && count(h,/name="description"/g)!==1) errors.push(`${file}: expected one description`);
  if (!is404 && count(h,/rel="canonical"/g)!==1) errors.push(`${file}: expected one canonical`);
  if (!is404 && count(h,/type="application\/ld\+json"/g)!==1) errors.push(`${file}: expected one JSON-LD block`);
  if (is404 && !/noindex/.test(h)) errors.push(`${file}: 404 must be noindex`);
  if (isAssessmentThanks && !/noindex/.test(h)) errors.push(`${file}: assessment confirmation must be noindex`);
  const title=(h.match(/<title>(.*?)<\/title>/)||[])[1];
  const desc=(h.match(/name="description" content="(.*?)"/)||[])[1];
  const canonical=(h.match(/rel="canonical" href="(.*?)"/)||[])[1];
  if (!is404) {
    if (titles.has(title)) errors.push(`${file}: duplicate title with ${titles.get(title)}`); else titles.set(title,file);
    if (descriptions.has(desc)) errors.push(`${file}: duplicate description with ${descriptions.get(desc)}`); else descriptions.set(desc,file);
    if (canonicals.has(canonical)) errors.push(`${file}: duplicate canonical with ${canonicals.get(canonical)}`); else canonicals.set(canonical,file);
    const plainTitle=title.replace(/&amp;/g,'&');
    const plainDesc=desc.replace(/&amp;/g,'&');
    if (plainTitle.length>70) errors.push(`${file}: title too long (${plainTitle.length})`);
    if (plainDesc.length>180) errors.push(`${file}: description too long (${plainDesc.length})`);
  }
  for (const match of h.matchAll(/<img\b[^>]*>/g)) if (!/\balt="[^"]*"/.test(match[0])) errors.push(`${file}: image missing alt`);
  for (const match of h.matchAll(/href="(\/[^"]*)"/g)) {
    const href=match[1].split(/[?#]/)[0];
    if (!href || href.startsWith('/assets/')) continue;
    let target;
    if (href==='/') target=path.join(DIST,'index.html');
    else target=path.join(DIST,href,'index.html');
    if (!fs.existsSync(target)) errors.push(`${file}: broken internal link ${href}`);
  }
  const json=(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/)||[])[1];
  if (json) try { JSON.parse(json); } catch (e) { errors.push(`${file}: invalid JSON-LD ${e.message}`); }
  if (/Maritain|free virtual free virtual|2024 retreat|kody-evans\.clientsecure/.test(h)) errors.push(`${file}: known stale or incorrect text`);
  const forms=count(h,/<form\b/gi);
  if (forms && !isAssessmentForm) errors.push(`${file}: unexpected public form found`);
  if (isAssessmentForm) {
    if (forms!==1) errors.push(`${file}: expected one access-request form`);
    if (!/name="marriage-reset-access"/.test(h) || !/data-netlify="true"/.test(h)) errors.push(`${file}: Netlify form configuration missing`);
    if (count(h,/type="email"/g)!==2) errors.push(`${file}: expected exactly two email fields`);
    if (!/name="partner-permission"[^>]*required/.test(h)) errors.push(`${file}: partner permission confirmation missing`);
    if (!/name="program-understanding"[^>]*required/.test(h)) errors.push(`${file}: program understanding confirmation missing`);
    if (!/data-netlify-honeypot="bot-field"/.test(h)) errors.push(`${file}: honeypot missing`);
    if (/<textarea\b|type="file"|type="tel"/i.test(h)) errors.push(`${file}: prohibited sensitive-data field found`);
  }
}

const sitemap=fs.readFileSync(path.join(DIST,'sitemap.xml'),'utf8');
const sitemapUrls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]);
if (sitemapUrls.length!==62) errors.push(`sitemap: expected 62 URLs, found ${sitemapUrls.length}`);
if (new Set(sitemapUrls).size!==sitemapUrls.length) errors.push('sitemap: duplicate URLs');
const inventory=fs.readFileSync(path.join(DIST,'page-inventory.csv'),'utf8').trim().split('\n');
if (inventory.length!==66) errors.push(`inventory: expected header plus 65 rows, found ${inventory.length}`);
for (const required of ['robots.txt','_headers','_redirects','llms.txt','404.html','page-inventory.csv']) if (!fs.existsSync(path.join(DIST,required))) errors.push(`missing ${required}`);

const result={htmlFiles:htmlFiles.length,contentPages:htmlFiles.length-1,uniqueTitles:titles.size,uniqueDescriptions:descriptions.size,uniqueCanonicals:canonicals.size,sitemapUrls:sitemapUrls.length,errors};
console.log(JSON.stringify(result,null,2));
if(errors.length) process.exit(1);
