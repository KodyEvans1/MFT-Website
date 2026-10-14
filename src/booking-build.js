'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const core = require('./booking-core');
const config = require('../content/simplepractice-booking.json');
// /assets/* is cached as immutable for a year. Change all three browser URLs
// together whenever booking logic or configuration changes, so an old core
// cannot overwrite the corrected calendar links with the client portal URL.
const assetVersion = createHash('sha256')
  .update(fs.readFileSync(path.join(__dirname,'booking-core.js')))
  .update(fs.readFileSync(path.join(__dirname,'assets/mft-booking.js')))
  .update(JSON.stringify(config))
  .digest('hex').slice(0,16);
const scriptSources = Object.freeze(
  ['/assets/mft-booking-core.js','/assets/mft-booking-config.js','/assets/mft-booking.js']
    .map(src => `${src}?v=${assetVersion}`)
);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const text = s => s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function decorateHtml(html, route) {
  const routeClinician = core.clinicianForPath(config, route);
  const inSection = (tag, pos) => html.lastIndexOf('<' + tag, pos) > html.lastIndexOf('</' + tag + '>', pos);
  let count = 0;
  let out = html.replace(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi, (whole, attrs, body, pos) => {
    const m = attrs.match(/\bhref="([^"]*)"/i); if (!m) return whole;
    const href = m[1].replace(/&amp;/g,'&'), label = text(body);
    if (href === 'https://ops.mft.care/' && /verify insurance|verify benefits/i.test(label)) {
      return whole.replace(m[0], 'href="mailto:support@mft.care?subject=Benefits%20verification"');
    }
    if (!core.isAppointment(href,label)) return whole;
    const clinician = inSection('header',pos) || inSection('footer',pos) ? null : routeClinician;
    attrs = attrs.replace(/\sdata-(?:spwidget-[a-z-]+|mft-booking(?:-mode)?)(?:="[^"]*")?/gi,'');
    attrs = attrs.replace(/\shref="[^"]*"/i,'').replace(/\srel="[^"]*"/i,'').replace(/\starget="[^"]*"/i,'').replace(/\sdata-mft-booking-mode="[^"]*"/i,'');
    const widgetAttrs = Object.entries(core.attributes(config, clinician)).map(([k,v]) => `${k}="${esc(v)}"`).join(' ');
    count++;
    return `<a${attrs} href="${esc(core.destination(config,clinician))}" rel="noopener noreferrer" ${widgetAttrs}>${body}</a>`;
  });
  // Retire embedded widget loading even when decorating older generated HTML.
  out = out.replace(/<script\b[^>]*src="https:\/\/widget-cdn\.simplepractice\.com\/assets\/integration-1\.0\.js[^"]*"[^>]*>[\s\S]*?<\/script>/gi,'');
  out = out.replace(/<div class="ad-note">[\s\S]*?<\/div>/g,'');
  if (!/Staff operations<\/a>/i.test(out)) out = out.replace('</footer>', '<p><a href="https://ops.mft.care/" rel="nofollow">Staff operations</a></p></footer>');
  if (!/<meta name="referrer"/.test(out)) out = out.replace('</head>', '<meta name="referrer" content="no-referrer"></head>');
  const sensitive = /^\/marriage-reset-assessment(?:\/|$)/.test(route);
  if (count && !sensitive && !out.includes('/assets/mft-booking.js')) {
    const scripts = scriptSources
      .map(src => `<script src="${src}" defer referrerpolicy="no-referrer"></script>`).join('');
    out = out.replace('</body>',scripts + '</body>');
  }
  return {html:out, buttons:count, widget:false, mode:'direct'};
}
module.exports = {decorateHtml, config, scriptSources};
