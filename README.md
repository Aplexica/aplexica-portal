# Aplexica Portal

Aplexica Portal is the local web interface embedded in `aplexicad`. The daemon
serves the React application over loopback HTTP, and the system tray opens it
in the user's browser.

This repository is self-contained: it includes the local application source,
tests, assets, and build configuration needed to produce `dist-local/`.

## Requirements

- Node.js 22.22 or newer
- pnpm 11.11 or newer

## Build

```bash
pnpm install --frozen-lockfile
pnpm build:local
pnpm legal:check
pnpm legal:self-test
pnpm bundle-check
```

The production files are written to `dist-local/` for embedding in the daemon.
Every build also creates `dist-local/legal/` with the project license and
notice plus the full license/copyright texts for the exact locked production
dependency graph. The legal checks reject stale, missing, or incomplete output.

## Develop

With a development daemon listening on `127.0.0.1:7600`:

```bash
FIXTURE_PORT=7600 pnpm dev:local --host 127.0.0.1
```

## Test

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
CI=1 pnpm test:e2e:local
```

The end-to-end command starts both its fixture daemon and the local development
server. No separate service is required.

The production daemon must apply the versioned HTTP response-header contract
shipped in every bundle. See [DAEMON_SECURITY.md](DAEMON_SECURITY.md) for the
contract, checks, and external daemon-adoption gate.

## Release

Protected version tags publish a reproducible local bundle, exact source
archive, SPDX SBOM, provenance statement, checksums, and a keyless signature.
See [RELEASING.md](RELEASING.md) for the asset contract and verification steps.

## License and contributions

Aplexica Portal is licensed under [AGPL-3.0-or-later](LICENSE). See
[CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

Report vulnerabilities according to [SECURITY.md](SECURITY.md).
