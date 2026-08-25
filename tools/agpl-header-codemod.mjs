#!/usr/bin/env node
/* SPDX-License-Identifier: AGPL-3.0-or-later */

import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

const HEADER_JS = `// SPDX-License-Identifier: AGPL-3.0-or-later\n`;
const HEADER_CSS = `/* SPDX-License-Identifier: AGPL-3.0-or-later */\n`;

const codeFiles = [
  ...globSync('src/**/*.{ts,tsx,js,mjs}',   { cwd: process.cwd() }),
  ...globSync('tools/**/*.{ts,tsx,js,mjs}', { cwd: process.cwd() }),
];
const cssFiles  = globSync('src/**/*.css',           { cwd: process.cwd() });

let added = 0;
let skipped = 0;

for (const f of codeFiles) {
  const p = path.resolve(f);
  const body = fs.readFileSync(p, 'utf8');
  const lines = body.split('\n');

  // Check if SPDX header already exists (line 0 or 1 if line 0 is shebang)
  let hasSpdx = false;
  if (lines[0].startsWith('// SPDX-License-Identifier') || lines[0].startsWith('/* SPDX-License-Identifier')) {
    hasSpdx = true;
  } else if (lines[0].startsWith('#!') && lines[1] && (lines[1].startsWith('// SPDX-License-Identifier') || lines[1].startsWith('/* SPDX-License-Identifier'))) {
    hasSpdx = true;
  }

  if (hasSpdx) {
    skipped++;
    continue;
  }

  // Handle shebang case: insert header after shebang
  if (lines[0].startsWith('#!')) {
    const shebang = lines[0];
    const rest = lines.slice(1).join('\n');
    fs.writeFileSync(p, shebang + '\n' + HEADER_JS + rest);
  } else {
    fs.writeFileSync(p, HEADER_JS + body);
  }
  console.log('header', f);
  added++;
}
for (const f of cssFiles) {
  const p = path.resolve(f);
  const body = fs.readFileSync(p, 'utf8');
  if (body.startsWith('/* SPDX-License-Identifier')) {
    skipped++;
    continue;
  }
  fs.writeFileSync(p, HEADER_CSS + body);
  console.log('header', f);
  added++;
}

console.log(`\nDone. ${added} added, ${skipped} already had headers.`);
