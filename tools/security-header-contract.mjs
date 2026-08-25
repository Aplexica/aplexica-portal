#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractFile = path.join(root, 'public', 'daemon-http-headers.json');
const htmlFile = path.join(root, 'index-local.html');
const fixtureFile = path.join(root, 'e2e', 'local', 'fixtures', 'daemon-fixture.mjs');

function validate(contractText, html, fixture) {
  const contract = JSON.parse(contractText);
  const failures = [];
  const expectedHeaders = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  if (contract.formatVersion !== 1) failures.push('formatVersion must be 1');
  if (JSON.stringify(contract.headers) !== JSON.stringify(expectedHeaders)) failures.push('required response headers changed');
  if (!contract.scope?.includes('Every portal')) failures.push('response scope is incomplete');
  const meta = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/>/)?.[1];
  if (!meta) failures.push('HTML CSP meta is missing');
  if (meta?.includes('frame-ancestors')) failures.push('frame-ancestors must not appear in CSP meta');
  if (meta !== contract.htmlMetaPolicy) failures.push('HTML CSP meta does not match the contract fallback');
  if (!contract.headers?.['Content-Security-Policy']?.includes("frame-ancestors 'none'")) failures.push('response CSP lacks frame denial');
  if (!fixture.includes("daemon-http-headers.json") || !fixture.includes('SECURITY_HEADERS')) {
    failures.push('fixture does not load the machine-readable contract');
  }
  if (!fixture.includes("res.setHeader(name, value)")) failures.push('fixture does not apply every contract header');
  if (failures.length > 0) throw new Error(failures.join('; '));
  return contract;
}

function expectFailure(operation, label) {
  try {
    operation();
  } catch (error) {
    return { control: label, rejected: true, reason: error instanceof Error ? error.message : String(error) };
  }
  throw new Error(`negative control unexpectedly passed: ${label}`);
}

function check() {
  const contractText = fs.readFileSync(contractFile, 'utf8');
  const html = fs.readFileSync(htmlFile, 'utf8');
  const fixture = fs.readFileSync(fixtureFile, 'utf8');
  const contract = validate(contractText, html, fixture);
  const builtContract = path.join(root, 'dist-local', 'daemon-http-headers.json');
  if (fs.existsSync(path.join(root, 'dist-local')) &&
      (!fs.existsSync(builtContract) || !fs.readFileSync(builtContract).equals(fs.readFileSync(contractFile)))) {
    throw new Error('dist-local is missing the exact daemon header contract');
  }
  return contract;
}

function selfTest() {
  const contractText = fs.readFileSync(contractFile, 'utf8');
  const html = fs.readFileSync(htmlFile, 'utf8');
  const fixture = fs.readFileSync(fixtureFile, 'utf8');
  validate(contractText, html, fixture);
  const contract = JSON.parse(contractText);
  const noFrame = JSON.parse(JSON.stringify(contract));
  noFrame.headers['Content-Security-Policy'] = noFrame.headers['Content-Security-Policy'].replace("; frame-ancestors 'none'", '');
  return [
    expectFailure(() => validate(JSON.stringify(noFrame), html, fixture), 'response frame denial removed'),
    expectFailure(() => validate(contractText, html.replace('object-src \'none\';', "object-src 'none'; frame-ancestors 'none';"), fixture), 'HTTP-only directive inserted into meta'),
    expectFailure(() => validate(contractText, html, fixture.replace('res.setHeader(name, value)', 'void name; void value')), 'fixture header application removed'),
  ];
}

const command = process.argv[2];
if (command === 'check') {
  const contract = check();
  console.log(JSON.stringify({ result: 'PASS', contract: 'public/daemon-http-headers.json', headers: contract.headers }, null, 2));
} else if (command === 'self-test') {
  console.log(JSON.stringify({ result: 'PASS', negativeControls: selfTest() }, null, 2));
} else {
  console.error('usage: node tools/security-header-contract.mjs <check|self-test>');
  process.exit(2);
}
