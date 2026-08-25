#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGETS = {
  initial: 220 * 1024,   // 220 KB gzipped initial-load bundle per mode
  perRoute: 60 * 1024,   //  60 KB gzipped per async route chunk
};

const PER_ROUTE_EXCEPTIONS = {};

// FORBIDDEN patterns intentionally target code-level identifiers
// (npm package paths, library namespaces, exported APIs) — NOT
// arbitrary substrings so legitimate hosted-service interoperability text
// in the local UI does not become a false positive.
const FORBIDDEN = {
  // Commercial-service SDKs must never leak into the local daemon bundle.
  'dist-local':  [/@stripe\//, /stripe-js/, /CognitoIdentityProvider/, /@aws-sdk\//],
};

const LEGAL_ARTIFACTS = ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt', 'manifest.json'];

let failed = false;
const modes = ['dist-local'].filter((mode) => fs.existsSync(path.resolve(mode)));

if (modes.length === 0) {
  console.error('MISSING dist-local');
  process.exit(1);
}

for (const mode of modes) {
  const dir = path.resolve(mode);
  if (!fs.existsSync(dir)) {
    console.error(`MISSING ${dir}`);
    failed = true;
    continue;
  }
  for (const name of LEGAL_ARTIFACTS) {
    const legalFile = path.join(dir, 'legal', name);
    if (!fs.existsSync(legalFile) || fs.statSync(legalFile).size === 0) {
      console.error(`MISSING ${mode}/legal/${name}`);
      failed = true;
    }
  }
  const assetsDir = path.join(dir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.error(`MISSING ${assetsDir}`);
    failed = true;
    continue;
  }
  // Source maps and HTML aren't shipped to the user's browser at
  // page-load time, so they shouldn't count against the budget.
  // Only .css and .js bundles do.
  const files = fs.readdirSync(assetsDir).filter((f) => /\.(css|js)$/.test(f));
  let initialSize = 0;
  for (const f of files) {
    const full = path.join(assetsDir, f);
    const gz = gzipSync(fs.readFileSync(full)).length;
    if (f.startsWith('index-')) initialSize += gz;
    const exception = Object.entries(PER_ROUTE_EXCEPTIONS).find(
      ([prefix]) => f.startsWith(prefix),
    );
    const budget = exception ? exception[1] : BUDGETS.perRoute;
    if (gz > budget && !f.startsWith('index-')) {
      console.error(`OVER  ${mode}/${f}: ${(gz / 1024).toFixed(1)} KB gz (budget ${budget / 1024} KB)`);
      failed = true;
    }
    for (const pat of FORBIDDEN[mode] || []) {
      const text = fs.readFileSync(full, 'utf8');
      if (pat.test(text)) {
        console.error(`FORBIDDEN ${mode}/${f}: contains ${pat}`);
        failed = true;
      }
    }
  }
  if (initialSize > BUDGETS.initial) {
    console.error(`OVER initial ${mode}: ${(initialSize / 1024).toFixed(1)} KB gz (budget ${BUDGETS.initial / 1024} KB)`);
    failed = true;
  }
  console.log(`OK ${mode} initial: ${(initialSize / 1024).toFixed(1)} KB gz`);
}

process.exit(failed ? 1 : 0);
