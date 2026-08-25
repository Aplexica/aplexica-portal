# Local daemon HTTP response contract

The portal is embedded and served by `aplexicad`; it does not own the production
HTTP server. The daemon must attach every header in
[`public/daemon-http-headers.json`](public/daemon-http-headers.json) to every
portal HTML, static asset, API, health, error, and event-stream response.

In particular, `frame-ancestors 'none'` is intentionally present only in the
HTTP `Content-Security-Policy` response header. Browsers ignore that directive
inside an HTML CSP meta element. `X-Frame-Options: DENY` remains a compatible
defense in depth, and `X-Content-Type-Options: nosniff` prevents MIME sniffing.

The self-contained fixture loads and applies the machine-readable contract, and
the browser suite asserts the exact framing and MIME headers plus a clean browser
console. `pnpm headers:check` verifies that the HTML fallback contains no
HTTP-only directive and that a build includes the byte-identical contract.
`pnpm headers:self-test` proves that missing frame denial, meta misuse, and a
fixture that stops applying the headers are all rejected.

Production adoption is an external release gate: before consuming a portal tag,
the daemon repository must bind the same contract in its real HTTP handler and
pass an integration test against an embedded release archive. Portal CI proves
the contract, fixture, and handoff artifact; it cannot claim enforcement by a
daemon implementation outside this repository.
