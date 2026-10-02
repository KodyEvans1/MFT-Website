'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { indexingEnabled } = require('../src/seo-safety');
const root = path.resolve(__dirname, '..');
const env = { ...process.env, SITE_INDEXING_ENABLED: String(indexingEnabled()) };
// Every stage receives the same effective policy, including the original core builder.
for (const script of ['src/build.js', 'src/enhance.js', 'src/redesign.js', 'src/seo-expansion.js', 'src/validate.js']) {
  const result = spawnSync(process.execPath, [path.join(root, script)], { cwd: root, env, stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
