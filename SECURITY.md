# Security policy

## Reporting a vulnerability

Email **security@aplexica.com** with details. We aim to acknowledge within 48 hours and triage within 5 business days. PGP key: published at https://aplexica.com/.well-known/pgp.asc.

Do not file public GitHub issues for security reports.

## Threat model (local mode)

The portal runs in the user's browser against a loopback HTTP listener on the user's own machine. Trust boundaries:

- **Inside the user's trust zone:** the browser, the daemon process, the `~/.aplexica/` directory, the system tray.
- **Out of trust scope (V1):** browser extensions running in the same browser; local-user-level malware; other users on a multi-user system.

V1 mitigates:
- DNS rebinding (Host-header allowlist; bind to 127.0.0.1 + ::1 only)
- CSRF (SameSite=Strict + double-submit token)
- XSS via cross-origin script injection (strict CSP)
- Port hijacking (random ephemeral port; portinfo.json mode-0600)
- Bootstrap token replay (single-use, 60s TTL, argon2id at rest)
- Session fixation (regenerated on every bootstrap)

V1 does NOT mitigate:
- LAN access (deferred to V2 with mDNS + passkey + cert provisioning)
- Browser-extension exfiltration (run a hardened browser profile if paranoid)
- Local-user-level malware (same trust zone as the daemon itself)

The daemon repository documents the server-side controls that complement this
browser application's defenses.
