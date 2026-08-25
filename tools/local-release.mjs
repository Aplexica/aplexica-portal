#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowFile = path.join(root, '.github', 'workflows', 'release.yml');
const tagPattern = /^v[0-9]+\.[0-9]+\.[0-9]+$/;
const commitPattern = /^[0-9a-f]{40}$/;
const publicRepository = 'Aplexica/aplexica-portal';

function tarText(header, offset, length) {
  return header.subarray(offset, offset + length).toString('utf8').replace(/\0.*$/s, '').trim();
}

function tarOctal(header, offset, length, label) {
  const field = header.subarray(offset, offset + length);
  if ((field[0] ?? 0) & 0x80) throw new Error(`${label} uses a non-portable binary number`);
  const text = field.toString('ascii').replace(/\0.*$/s, '').trim();
  if (text !== '' && !/^[0-7]+$/.test(text)) throw new Error(`${label} is not octal`);
  return text === '' ? 0 : Number.parseInt(text, 8);
}

function normalizedArchiveName(name) {
  return name.replace(/^\.\//, '').replace(/\/$/, '');
}

function inspectArchive(file, expectedRoot, expectedEpoch) {
  regularFile(file, 'archive');
  const compressed = fs.readFileSync(file);
  if (compressed.length < 10 || compressed[0] !== 0x1f || compressed[1] !== 0x8b || compressed[2] !== 8) {
    throw new Error('archive is not gzip');
  }
  if (compressed[3] !== 0 || compressed.readUInt32LE(4) !== 0) {
    throw new Error('gzip header contains optional metadata or a nonzero timestamp');
  }
  const tar = zlib.gunzipSync(compressed);
  const entries = [];
  let offset = 0;
  let longName = null;
  let normalizedEpoch = expectedEpoch === undefined ? null : Number(expectedEpoch);
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      if (offset + 1024 > tar.length || !tar.subarray(offset + 512, offset + 1024).every((byte) => byte === 0)) {
        throw new Error('tar does not end with two zero blocks');
      }
      if (!tar.subarray(offset + 1024).every((byte) => byte === 0)) throw new Error('tar has data after its end marker');
      break;
    }
    const recordedChecksum = tarOctal(header, 148, 8, 'tar checksum');
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const calculatedChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (recordedChecksum !== calculatedChecksum) throw new Error('tar checksum mismatch');
    const size = tarOctal(header, 124, 12, 'tar size');
    const uid = tarOctal(header, 108, 8, 'tar uid');
    const gid = tarOctal(header, 116, 8, 'tar gid');
    const mode = tarOctal(header, 100, 8, 'tar mode') & 0o7777;
    const mtime = tarOctal(header, 136, 12, 'tar mtime');
    const uname = tarText(header, 265, 32);
    const gname = tarText(header, 297, 32);
    const type = String.fromCharCode(header[156] || 0);
    const rawName = tarText(header, 0, 100);
    const prefix = tarText(header, 345, 155);
    const storedName = prefix ? `${prefix}/${rawName}` : rawName;
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > tar.length) throw new Error('tar member exceeds archive length');
    if (uid !== 0 || gid !== 0 || uname !== '' || gname !== '') {
      throw new Error(`archive identity metadata is not normalized: uid=${uid} gid=${gid} uname=${uname || '<empty>'} gname=${gname || '<empty>'}`);
    }
    if (normalizedEpoch === null) normalizedEpoch = mtime;
    if (!Number.isSafeInteger(normalizedEpoch) || normalizedEpoch < 0 || mtime !== normalizedEpoch) {
      throw new Error(`archive mtime is not normalized: expected ${normalizedEpoch}, got ${mtime}`);
    }
    if (type === 'x' || type === 'g') throw new Error('archive contains PAX metadata');
    if (type === 'L') {
      if (mode !== 0) throw new Error(`GNU long-name metadata has unsafe mode ${mode.toString(8)}`);
      longName = tar.subarray(contentStart, contentEnd).toString('utf8').replace(/\0.*$/s, '');
    } else {
      const name = normalizedArchiveName(longName ?? storedName);
      longName = null;
      if (type !== '\0' && type !== '0' && type !== '5') throw new Error(`archive contains symlink or special member: ${name} type=${type}`);
      const directory = type === '5';
      const allowedMode = directory ? mode === 0o755 : mode === 0o644 || mode === 0o755;
      if (!allowedMode) throw new Error(`archive member has unsafe mode ${mode.toString(8)}: ${name}`);
      const parts = name.split('/').filter(Boolean);
      if (name.startsWith('/') || parts.includes('..') || name === '') throw new Error(`archive member has unsafe name: ${name}`);
      if (expectedRoot && name !== expectedRoot && !name.startsWith(`${expectedRoot}/`)) {
        throw new Error(`archive member escapes expected root ${expectedRoot}: ${name}`);
      }
      entries.push({ name, type: directory ? 'directory' : 'file', mode, size, mtime });
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  if (longName !== null) throw new Error('dangling GNU long-name metadata');
  if (entries.length === 0) throw new Error('archive has no members');
  return {
    members: entries.length,
    regularFiles: entries.filter((entry) => entry.type === 'file').length,
    directories: entries.filter((entry) => entry.type === 'directory').length,
    normalizedUid: 0,
    normalizedGid: 0,
    normalizedOwnerNames: '',
    normalizedMtime: normalizedEpoch,
    paxHeaders: 0,
    gzipHeaderMtime: 0,
  };
}

function validateReleaseIdentity(options) {
  const tag = requireOption(options, '--tag');
  const eventSha = requireOption(options, '--event-sha');
  const tagObject = requireOption(options, '--tag-object');
  const peeledCommit = requireOption(options, '--peeled-commit');
  const remoteTagObject = requireOption(options, '--remote-tag-object');
  const remotePeeledCommit = requireOption(options, '--remote-peeled-commit');
  if (!tagPattern.test(tag)) throw new Error('tag must be vMAJOR.MINOR.PATCH');
  for (const [label, value] of Object.entries({ eventSha, tagObject, peeledCommit, remoteTagObject, remotePeeledCommit })) {
    if (!commitPattern.test(value)) throw new Error(`${label} must be 40 lowercase hexadecimal characters`);
  }
  if (tagObject === peeledCommit) throw new Error('annotated tag object must be distinct from its peeled commit');
  if (eventSha !== peeledCommit) throw new Error('push event SHA does not equal the tagged source commit');
  if (remoteTagObject !== tagObject) throw new Error('remote tag object does not equal the checked annotated tag object');
  if (remotePeeledCommit !== peeledCommit) throw new Error('remote peeled commit does not equal the checked tagged source commit');
  return { tag, eventSha, tagObject, sourceCommit: peeledCommit, remoteTagObject, remotePeeledCommit };
}

function writeTarOctal(header, offset, length, value) {
  const text = value.toString(8).padStart(length - 1, '0');
  header.write(`${text}\0`, offset, length, 'ascii');
}

function fixtureTarHeader(entry) {
  const header = Buffer.alloc(512);
  header.write(entry.name, 0, 100, 'utf8');
  writeTarOctal(header, 100, 8, entry.mode ?? (entry.type === '5' ? 0o755 : 0o644));
  writeTarOctal(header, 108, 8, entry.uid ?? 0);
  writeTarOctal(header, 116, 8, entry.gid ?? 0);
  writeTarOctal(header, 124, 12, entry.data?.length ?? 0);
  writeTarOctal(header, 136, 12, entry.mtime ?? 1700000000);
  header.fill(0x20, 148, 156);
  header.write(entry.type ?? '0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  header.write(entry.uname ?? '', 265, 32, 'utf8');
  header.write(entry.gname ?? '', 297, 32, 'utf8');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return header;
}

function writeFixtureArchive(file, entries) {
  const blocks = [];
  for (const entry of entries) {
    const data = entry.data ?? Buffer.alloc(0);
    blocks.push(fixtureTarHeader({ ...entry, data }), data, Buffer.alloc((512 - data.length % 512) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  fs.writeFileSync(file, zlib.gzipSync(Buffer.concat(blocks), { level: 9, mtime: 0 }));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseOptions(args) {
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid option sequence at ${key ?? '<end>'}`);
    if (options.has(key)) throw new Error(`duplicate option ${key}`);
    options.set(key, value);
  }
  return options;
}

function requireOption(options, name) {
  const value = options.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function regularFile(file, label) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
}

function spdxId(name, version) {
  const stable = `${name}-${version}`.replace(/[^A-Za-z0-9.-]+/g, '-');
  return `SPDXRef-Package-${stable}-${sha256(`${name}@${version}`).slice(0, 12)}`;
}

function generateMetadata(options) {
  const tag = requireOption(options, '--tag');
  const commit = requireOption(options, '--commit');
  const repository = requireOption(options, '--repository');
  const serverUrl = requireOption(options, '--server-url');
  const workflowRef = requireOption(options, '--workflow-ref');
  const eventSha = requireOption(options, '--event-sha');
  const tagObject = requireOption(options, '--tag-object');
  const runId = requireOption(options, '--run-id');
  const runAttempt = requireOption(options, '--run-attempt');
  const epochText = requireOption(options, '--epoch');
  const bundleFile = path.resolve(requireOption(options, '--bundle'));
  const sourceFile = path.resolve(requireOption(options, '--source'));
  const outputDir = path.resolve(requireOption(options, '--out-dir'));
  const legalFile = path.resolve(options.get('--legal-manifest') ?? path.join(root, 'dist-local/legal/manifest.json'));

  if (!tagPattern.test(tag)) throw new Error('tag must be vMAJOR.MINOR.PATCH');
  if (!commitPattern.test(commit)) throw new Error('commit must be 40 lowercase hexadecimal characters');
  if (!commitPattern.test(eventSha)) throw new Error('event SHA must be 40 lowercase hexadecimal characters');
  if (!commitPattern.test(tagObject)) throw new Error('tag object must be 40 lowercase hexadecimal characters');
  if (tagObject === commit) throw new Error('annotated tag object must be distinct from its peeled commit');
  if (eventSha !== commit) throw new Error('push event SHA does not equal the tagged source commit');
  if (repository !== publicRepository) throw new Error(`repository must be ${publicRepository}`);
  if (serverUrl !== 'https://github.com') throw new Error('server URL must be https://github.com');
  const expectedWorkflowRef = `${repository}/.github/workflows/release.yml@refs/tags/${tag}`;
  if (workflowRef !== expectedWorkflowRef) throw new Error(`workflow ref must be ${expectedWorkflowRef}`);
  if (!/^[1-9][0-9]*$/.test(runId)) throw new Error('run ID must be a positive integer');
  if (!/^[1-9][0-9]*$/.test(runAttempt)) throw new Error('run attempt must be a positive integer');
  if (!/^[0-9]+$/.test(epochText)) throw new Error('epoch must be an integer Unix timestamp');
  const epoch = Number(epochText);
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error('epoch is outside the safe Unix timestamp range');

  const expectedBundle = `aplexica-portal-${tag}-local.tar.gz`;
  const expectedSource = `aplexica-portal-${tag}-source.tar.gz`;
  if (path.basename(bundleFile) !== expectedBundle) throw new Error(`bundle filename must be ${expectedBundle}`);
  if (path.basename(sourceFile) !== expectedSource) throw new Error(`source filename must be ${expectedSource}`);
  regularFile(bundleFile, 'bundle');
  regularFile(sourceFile, 'source archive');
  regularFile(legalFile, 'legal manifest');

  const legal = JSON.parse(fs.readFileSync(legalFile, 'utf8'));
  if (legal.productionPackageCount !== 21 || legal.packages?.length !== 21) {
    throw new Error('legal manifest must cover exactly the locked 21-package production graph');
  }
  const packages = [...legal.packages].sort((left, right) =>
    left.name.localeCompare(right.name) || left.version.localeCompare(right.version),
  );
  const created = new Date(epoch * 1000).toISOString().replace('.000Z', 'Z');
  const bundleDigest = sha256(fs.readFileSync(bundleFile));
  const sourceDigest = sha256(fs.readFileSync(sourceFile));
  const workflowIdentity = `${serverUrl}/${workflowRef}`;
  const invocationId = `${serverUrl}/${repository}/actions/runs/${runId}/attempts/${runAttempt}`;
  const documentNamespace = `https://github.com/${repository}/releases/tag/${tag}#spdx-${bundleDigest}`;
  const projectId = 'SPDXRef-Package-aplexica-portal';
  const dependencyPackages = packages.map((entry) => ({
    SPDXID: spdxId(entry.name, entry.version),
    name: entry.name,
    versionInfo: entry.version,
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: entry.license,
    licenseDeclared: entry.license,
    copyrightText: 'NOASSERTION',
  }));
  const sbom = {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `aplexica-portal-${tag}`,
    documentNamespace,
    creationInfo: {
      created,
      creators: ['Tool: tools/local-release.mjs'],
      licenseListVersion: '3.25',
    },
    documentDescribes: [projectId],
    packages: [
      {
        SPDXID: projectId,
        name: '@aplexica/portal',
        versionInfo: tag.slice(1),
        downloadLocation: `git+https://github.com/${repository}.git@${commit}`,
        filesAnalyzed: false,
        checksums: [{ algorithm: 'SHA256', checksumValue: sourceDigest }],
        licenseConcluded: 'AGPL-3.0-or-later',
        licenseDeclared: 'AGPL-3.0-or-later',
        copyrightText: 'NOASSERTION',
      },
      ...dependencyPackages,
    ],
    relationships: [
      { spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: projectId },
      ...dependencyPackages.map((entry) => ({
        spdxElementId: projectId,
        relationshipType: 'DEPENDS_ON',
        relatedSpdxElement: entry.SPDXID,
      })),
    ],
    annotations: [{
      annotationDate: created,
      annotationType: 'OTHER',
      annotator: 'Tool: tools/local-release.mjs',
      comment: `dist-local archive SHA-256: ${bundleDigest}`,
    }],
  };
  const provenance = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [
      { name: expectedBundle, digest: { sha256: bundleDigest } },
      { name: expectedSource, digest: { sha256: sourceDigest } },
    ],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        buildType: workflowIdentity,
        externalParameters: { repository, tag, tagObject, sourceCommit: commit },
        internalParameters: { sourceDateEpoch: epoch, eventSha, runId, runAttempt },
        resolvedDependencies: [{
          uri: `git+https://github.com/${repository}.git@refs/tags/${tag}`,
          digest: { gitTagObject: tagObject, gitCommit: commit },
        }],
      },
      runDetails: {
        builder: { id: workflowIdentity },
        metadata: { invocationId },
      },
    },
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const sbomName = `aplexica-portal-${tag}.spdx.json`;
  const provenanceName = `aplexica-portal-${tag}.intoto.jsonl`;
  fs.writeFileSync(path.join(outputDir, sbomName), `${JSON.stringify(sbom, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, provenanceName), `${JSON.stringify(provenance)}\n`);
  return { tag, tagObject, commit, bundleDigest, sourceDigest, sbomName, provenanceName, productionPackages: packages.length };
}

function validateWorkflow(source) {
  const failures = [];
  const requireMatch = (label, expression) => {
    if (!expression.test(source)) failures.push(`missing ${label}`);
  };
  const disallowedProductTerm = ['cl', 'oud'].join('');
  if (new RegExp(disallowedProductTerm, 'i').test(source)) failures.push('non-local product marker');
  for (const match of source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+).*$/gm)) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+@[0-9a-f]{40}$/.test(match[1])) {
      failures.push(`mutable action ${match[1]}`);
    }
  }
  requireMatch('tag trigger', /^\s{4}tags:\s*\['v\*\.\*\.\*'\]\s*$/m);
  requireMatch('root read-only permissions', /^permissions:\s*\n\s{2}contents:\s*read\s*$/m);
  requireMatch('release contents write permission', /^\s{6}contents:\s*write\s*$/m);
  requireMatch('release identity-token permission', /^\s{6}id-token:\s*write\s*$/m);
  requireMatch('checkout credentials disabled', /^\s{10}persist-credentials:\s*false\s*$/m);
  requireMatch('checkout submodules disabled', /^\s{10}submodules:\s*false\s*$/m);
  requireMatch('checkout exact event commit', /^\s{10}ref:\s*\$\{\{ github\.sha \}\}\s*$/m);
  requireMatch('remote identity api base', /"https:\/\/api\.github\.com\/repos\/\$GITHUB_REPOSITORY\/\$1"/);
  requireMatch('remote tag identity lookup', /api "git\/ref\/tags\/\$TAG"/);
  requireMatch('remote tag object peel', /api "git\/tags\//);
  requireMatch('push event identity validation', /node tools\/local-release\.mjs identity[\s\S]*--event-sha "\$GITHUB_SHA"/);
  requireMatch('annotated tag object metadata', /--tag-object "\$TAG_OBJECT"/);
  requireMatch('archive owner normalization', /--owner=0 --group=0 --numeric-owner/);
  requireMatch('archive mode normalization', /--mode='u\+rwX,go\+rX,go-w'/);
  requireMatch('archive metadata stripping', /--no-acls --no-xattrs --no-selinux/);
  requireMatch('release archive policy checker', /node "\$RELEASE_SOURCE\/tools\/local-release\.mjs" archive-check/);
  requireMatch('envsubst bootstrap before cosign installer', /sudo apt-get update[\s\S]*sudo apt-get install -y gettext-base[\s\S]*uses: sigstore\/cosign-installer@/);
  for (const command of [
    'git archive', 'pnpm install --frozen-lockfile', 'pnpm typecheck', 'pnpm lint',
    'pnpm test', 'pnpm test:e2e:local', 'pnpm build:local', 'pnpm legal:check',
    'pnpm legal:self-test', 'pnpm headers:check', 'pnpm headers:self-test',
    'pnpm bundle-check', 'node tools/actionpin.mjs',
    'pnpm audit --prod --audit-level high', 'node tools/local-release.mjs metadata',
    "gzip -9 -n", 'SHA256SUMS', 'sudo apt-get install -y gettext-base',
    'envsubst --version', 'cosign sign-blob', 'cosign verify-blob',
    'gh release create',
  ]) {
    if (!source.includes(command)) failures.push(`missing command ${command}`);
  }
  requireMatch('local archive asset', /aplexica-portal-\$\{TAG\}-local\.tar\.gz/);
  requireMatch('source archive asset', /aplexica-portal-\$\{TAG\}-source\.tar\.gz/);
  if (failures.length > 0) throw new Error(failures.join('; '));
}

function expectFailure(operation, label) {
  try {
    operation();
  } catch (error) {
    return { control: label, rejected: true, reason: error instanceof Error ? error.message : String(error) };
  }
  throw new Error(`negative control unexpectedly passed: ${label}`);
}

function selfTest() {
  const workflow = fs.readFileSync(workflowFile, 'utf8');
  validateWorkflow(workflow);
  const controls = [
    expectFailure(() => validateWorkflow(workflow.replace(/actions\/checkout@[0-9a-f]{40}/, 'actions/checkout@v4')), 'mutable action'),
    expectFailure(() => validateWorkflow(`${workflow}\n# forbidden product marker: hosted-${['cl', 'oud'].join('')}\n`), 'non-local product marker'),
    expectFailure(() => validateWorkflow(workflow.replace('persist-credentials: false', 'persist-credentials: true')), 'checkout credentials'),
    expectFailure(() => validateWorkflow(workflow.replace('ref: ${{ github.sha }}', 'ref: refs/tags/v1.2.3')), 'checkout event identity'),
  ];

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aplexica-local-release-'));
  try {
    const tag = 'v1.2.3';
    const bundle = path.join(tempRoot, `aplexica-portal-${tag}-local.tar.gz`);
    const source = path.join(tempRoot, `aplexica-portal-${tag}-source.tar.gz`);
    const legal = path.join(tempRoot, 'manifest.json');
    fs.writeFileSync(bundle, 'deterministic local bundle fixture\n');
    fs.writeFileSync(source, 'deterministic source fixture\n');
    fs.writeFileSync(legal, `${JSON.stringify({
      productionPackageCount: 21,
      packages: Array.from({ length: 21 }, (_, index) => ({
        name: `fixture-package-${index + 1}`,
        version: '1.0.0',
        license: 'MIT',
      })),
    })}\n`);
    const commit = 'a'.repeat(40);
    const tagObject = 'b'.repeat(40);
    const common = new Map([
      ['--tag', tag], ['--commit', commit], ['--repository', publicRepository],
      ['--server-url', 'https://github.com'],
      ['--workflow-ref', `${publicRepository}/.github/workflows/release.yml@refs/tags/${tag}`],
      ['--event-sha', commit], ['--tag-object', tagObject], ['--run-id', '123456789'], ['--run-attempt', '2'],
      ['--epoch', '1700000000'], ['--bundle', bundle], ['--source', source],
      ['--legal-manifest', legal],
    ]);
    const first = new Map(common);
    first.set('--out-dir', path.join(tempRoot, 'first'));
    const second = new Map(common);
    second.set('--out-dir', path.join(tempRoot, 'second'));
    const firstResult = generateMetadata(first);
    generateMetadata(second);
    for (const name of [firstResult.sbomName, firstResult.provenanceName]) {
      const left = fs.readFileSync(path.join(tempRoot, 'first', name));
      const right = fs.readFileSync(path.join(tempRoot, 'second', name));
      if (!left.equals(right)) throw new Error(`${name} is not deterministic`);
    }
    const invalidTag = new Map(common);
    invalidTag.set('--tag', 'latest');
    invalidTag.set('--out-dir', path.join(tempRoot, 'bad-tag'));
    controls.push(expectFailure(() => generateMetadata(invalidTag), 'invalid tag'));
    const wrongWorkflow = new Map(common);
    wrongWorkflow.set('--workflow-ref', `${publicRepository}/.github/workflows/release.yml@refs/heads/main`);
    wrongWorkflow.set('--out-dir', path.join(tempRoot, 'wrong-workflow'));
    controls.push(expectFailure(() => generateMetadata(wrongWorkflow), 'workflow ref mismatch'));
    const placeholderRun = new Map(common);
    placeholderRun.set('--run-id', tag);
    placeholderRun.set('--out-dir', path.join(tempRoot, 'placeholder-run'));
    controls.push(expectFailure(() => generateMetadata(placeholderRun), 'placeholder run identity'));
    const wrongName = new Map(common);
    wrongName.set('--bundle', source);
    wrongName.set('--out-dir', path.join(tempRoot, 'wrong-name'));
    controls.push(expectFailure(() => generateMetadata(wrongName), 'wrong asset name'));
    const mismatchedEvent = new Map(common);
    mismatchedEvent.set('--event-sha', 'c'.repeat(40));
    mismatchedEvent.set('--out-dir', path.join(tempRoot, 'mismatched-event'));
    controls.push(expectFailure(() => generateMetadata(mismatchedEvent), 'event/source commit mismatch'));

    const identity = new Map([
      ['--tag', tag], ['--event-sha', commit], ['--tag-object', tagObject],
      ['--peeled-commit', commit], ['--remote-tag-object', tagObject], ['--remote-peeled-commit', commit],
    ]);
    const movedTag = new Map(identity);
    movedTag.set('--remote-tag-object', 'c'.repeat(40));
    controls.push(expectFailure(() => validateReleaseIdentity(movedTag), 'moved remote tag object'));
    const movedPeeledCommit = new Map(identity);
    movedPeeledCommit.set('--remote-peeled-commit', 'c'.repeat(40));
    controls.push(expectFailure(() => validateReleaseIdentity(movedPeeledCommit), 'remote peeled commit mismatch'));
    const lightweightIdentity = new Map(identity);
    lightweightIdentity.set('--tag-object', commit);
    lightweightIdentity.set('--remote-tag-object', commit);
    controls.push(expectFailure(() => validateReleaseIdentity(lightweightIdentity), 'tag object equals peeled commit'));

    const archiveEpoch = 1700000000;
    const validArchive = path.join(tempRoot, 'valid.tar.gz');
    writeFixtureArchive(validArchive, [{ name: 'dist-local/', type: '5', mtime: archiveEpoch }, { name: 'dist-local/index-local.html', data: Buffer.from('fixture\n'), mtime: archiveEpoch }]);
    inspectArchive(validArchive, 'dist-local', archiveEpoch);
    const archiveFixtures = [
      ['nonzero archive IDs', { name: 'dist-local/index-local.html', data: Buffer.from('fixture\n'), uid: 501, gid: 20, mtime: archiveEpoch }],
      ['archive owner names', { name: 'dist-local/index-local.html', data: Buffer.from('fixture\n'), uname: 'developer', gname: 'staff', mtime: archiveEpoch }],
      ['archive xattr PAX metadata', { name: 'PaxHeader', type: 'x', data: Buffer.from('xattr fixture\n'), mtime: archiveEpoch }],
      ['archive ACL PAX metadata', { name: 'PaxHeader', type: 'x', data: Buffer.from('acl fixture\n'), mtime: archiveEpoch }],
      ['archive unsafe mode', { name: 'dist-local/index-local.html', data: Buffer.from('fixture\n'), mode: 0o6755, mtime: archiveEpoch }],
    ];
    for (const [label, entry] of archiveFixtures) {
      const archive = path.join(tempRoot, `${label.replace(/[^a-z]+/gi, '-')}.tar.gz`);
      writeFixtureArchive(archive, [entry]);
      controls.push(expectFailure(() => inspectArchive(archive, 'dist-local', archiveEpoch), label));
    }
    const mixedMtime = path.join(tempRoot, 'mixed-mtime.tar.gz');
    writeFixtureArchive(mixedMtime, [
      { name: 'dist-local/', type: '5', mtime: archiveEpoch },
      { name: 'dist-local/index-local.html', data: Buffer.from('fixture\n'), mtime: archiveEpoch + 1 },
    ]);
    controls.push(expectFailure(() => inspectArchive(mixedMtime, 'dist-local', archiveEpoch), 'archive mixed mtimes'));
    return { workflow: '.github/workflows/release.yml', deterministicFiles: [firstResult.sbomName, firstResult.provenanceName], negativeControls: controls };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const command = process.argv[2];
if (command === 'metadata') {
  console.log(JSON.stringify({ result: 'PASS', ...generateMetadata(parseOptions(process.argv.slice(3))) }, null, 2));
} else if (command === 'identity') {
  console.log(JSON.stringify({ result: 'PASS', ...validateReleaseIdentity(parseOptions(process.argv.slice(3))) }, null, 2));
} else if (command === 'archive-check') {
  const options = parseOptions(process.argv.slice(3));
  const archive = path.resolve(requireOption(options, '--archive'));
  const expectedRoot = options.get('--expected-root');
  const expectedEpoch = requireOption(options, '--expected-epoch');
  if (!/^[0-9]+$/.test(expectedEpoch)) throw new Error('expected epoch must be an integer');
  console.log(JSON.stringify({ result: 'PASS', archive, ...inspectArchive(archive, expectedRoot, Number(expectedEpoch)) }, null, 2));
} else if (command === 'self-test') {
  console.log(JSON.stringify({ result: 'PASS', ...selfTest() }, null, 2));
} else {
  console.error('usage: node tools/local-release.mjs <metadata|identity|archive-check|self-test> [options]');
  process.exit(2);
}
