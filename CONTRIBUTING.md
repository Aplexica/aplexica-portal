# Contributing to Aplexica Portal

Thank you for your interest. Aplexica Portal is the AGPL-licensed local web
interface for the [Aplexica daemon](https://github.com/Aplexica/Aplexica).

## TL;DR

1. Open or claim an issue describing what you intend to do (for non-trivial changes).
2. Fork the repository, create a topic branch, write your change with tests.
3. Push and open a pull request against `main`.
4. Complete the current Contributor License Agreement (CLA) when a maintainer provides it.
5. CI must be green; at least one maintainer must approve.

## Contributor License Agreement (CLA)

Before Aplexica can merge a contribution, the contributor must accept the
current CLA and its signing instructions. Corporate contributors should have an authorized
representative contact the maintainers about the corporate agreement.

### What the CLA actually says (plain language)

The portal and daemon remain available under AGPL-3.0-or-later. The CLA also
grants Aplexica permission to distribute accepted contributions under other
licenses.

Practically, this means:

- You retain copyright in your contribution. The CLA is a **license** from you to Aplexica, not an assignment.
- Your name remains in `git log` and any credits we maintain.
- The public AGPL-3.0 portal is not going anywhere; the open-source license to the public Work is irrevocable.
- Aplexica can include your contribution in separately licensed products.
- If you don't want your contribution dual-licensable under these terms, please don't submit it. Forks and AGPL-3.0-only derivative projects are entirely free to use the public Work without signing the CLA — the CLA only applies to contributions back to the canonical repos.

## Commit conventions

- Format: `type(scope): short description` (Conventional Commits)
- `type`: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`
- `scope`: `local`, `shared`, `ci`, or omitted for repository-wide changes
- Use the body for context — what changed, why; not how (the diff shows how)

## Development setup

See [README.md](README.md).

## Code style

- TypeScript strict mode; no `any`
- All user-facing strings flow through `src/shared/i18n/en.json`
- TypeScript and ESLint checks run in CI; the pre-commit hook checks source-license headers
- New routes require Vitest + Playwright coverage

## Reporting bugs

See [SECURITY.md](SECURITY.md) for security issues. Other bugs: open a GitHub issue with reproducer steps + your daemon version (`aplexica --version`) + your browser version.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). By participating you agree to abide by it.
