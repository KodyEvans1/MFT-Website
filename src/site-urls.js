'use strict';

const SITE = 'https://www.mft.care';
const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

// Netlify serves directory index pages at their trailing-slash URL. The same
// spelling must identify the page in navigation, metadata and the sitemap.
function pagePath(slug = '') {
  if (typeof slug !== 'string' || (slug && !PAGE_SLUG.test(slug)))
    throw new Error(`Invalid page route: ${slug}`);
  return slug ? `/${slug}/` : '/';
}
function pageUrl(slug = '') { return SITE + pagePath(slug); }

// Historical first-party source references retain their evidence record while
// their rendered link goes directly to the current page. Assets and external
// references are not directory pages and must keep their original URL.
function pageLink(href) {
  if (typeof href !== 'string' || !/^(?:\/(?!\/)|https:\/\/www\.mft\.care(?:\/|$))/.test(href)) return href;
  const url = new URL(href, SITE);
  if (url.origin !== SITE || url.username || url.password) return href;
  const slug = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (slug && !PAGE_SLUG.test(slug)) return href;
  return (href.startsWith('/') ? '' : SITE) + pagePath(slug) + url.search + url.hash;
}

module.exports = { SITE, pagePath, pageUrl, pageLink };
