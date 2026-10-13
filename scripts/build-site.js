'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { indexingEnabled } = require('../src/seo-safety');
const root = path.resolve(__dirname, '..');
const env = { ...process.env, SITE_INDEXING_ENABLED: String(indexingEnabled()) };
// Booking decoration precedes SEO's protected-core fingerprints. Expansion clones the
// prepared templates; its new CTAs are bound by the same browser initializer.
for (const script of ['src/build.js', 'src/enhance.js', 'src/redesign.js', 'scripts/prepare-booking.js', 'src/seo-expansion.js', 'src/validate.js', 'scripts/validate-booking.js']) {
  const result = spawnSync(process.execPath, [path.join(root, script)], { cwd: root, env, stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
