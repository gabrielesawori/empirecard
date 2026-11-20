/* Syntax check every source file, reporting all failures instead of stopping
   at the first one.

   `node --check` is the authoritative parser, so we delegate to it rather than
   hand-rolling a tokeniser (regex literals like `/[&<>"']/g` and division like
   `bestOf / 2` are indistinguishable to a naive brace counter, which produced
   false positives). Running it once per file means a single broken file no
   longer hides problems in the others. */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const FILES = [
  'server.mjs', 'lib/game.mjs', 'lib/accounts.mjs', 'lib/store.mjs',
  'public/app.js', 'public/motion.js', 'public/heroes.js', 'public/spells.js',
  'public/interface.js', 'public/bgm.js', 'public/audio.js', 'public/account-ui.js', 'public/ranks.js',
];

let failed = 0;
for (const file of FILES) {
  try { readFileSync(file); }
  catch { console.error(`SKIP ${file}: not found`); continue; }
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status === 0) continue;
  failed++;
  /* Keep only the useful parser lines, dropping the Node stack trace. */
  const detail = (result.stderr || '').split('\n')
    .filter(line => line && !line.startsWith('    at ') && !line.startsWith('Node.js v'))
    .join('\n');
  console.error(`FAIL ${file}\n${detail}\n`);
}

if (failed) {
  console.error(`validate-syntax: ${failed} of ${FILES.length} files failed to parse.`);
  process.exit(1);
}
console.log(`validate-syntax: ${FILES.length} files parsed successfully.`);

