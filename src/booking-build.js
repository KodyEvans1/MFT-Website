'use strict';
const core = require('./booking-core');
const config = require('../content/simplepractice-booking.json');
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
    attrs = attrs.replace(/\sdata-(?:spwidget-[a-z-]+|mft-booking)(?:="[^"]*")?/gi,'');
    attrs = attrs.replace(/\shref="[^"]*"/i,'').replace(/\srel="[^"]*"/i,'');
    const widgetAttrs = Object.entries(core.attributes(config, clinician)).map(([k,v]) => `${k}="${esc(v)}"`).join(' ');
    count++;
    return `<a${attrs} href="${esc(core.destination(config,clinician))}" rel="noopener noreferrer" ${widgetAttrs}>${body}</a>`;
  });
  out = out.replace(/<div class="ad-note">[\s\S]*?<\/div>/g,'');
  if (!/Staff operations<\/a>/i.test(out)) out = out.replace('</footer>', '<p><a href="https://ops.mft.care/" rel="nofollow">Staff operations</a></p></footer>');
  if (!/<meta name="referrer"/.test(out)) out = out.replace('</head>', '<meta name="referrer" content="no-referrer"></head>');
  const sensitive = /^\/marriage-reset-assessment(?:\/|$)/.test(route);
  if (count && !sensitive && !out.includes('/assets/mft-booking.js')) {
    const scripts = ['/assets/mft-booking-core.js','/assets/mft-booking-config.js','/assets/mft-booking.js',config.loaderUrl]
      .map(src => `<script src="${src}" defer referrerpolicy="no-referrer"></script>`).join('');
    out = out.replace('</body>',scripts + '</body>');
  }
  return {html:out, buttons:count, widget:count > 0 && !sensitive};
}
module.exports = {decorateHtml, config};
