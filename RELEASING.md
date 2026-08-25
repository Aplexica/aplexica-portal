# Releasing the local portal

Releases are built only from a protected, annotated `vMAJOR.MINOR.PATCH` tag on
`main`. For a tag push, GitHub's event SHA is the commit at the updated tag ref.
The workflow therefore requires the event SHA, the locally peeled annotated tag,
and the remotely peeled tag to name the same source commit; it separately records
and verifies the annotated tag-object SHA. It then extracts that exact commit,
installs the frozen dependency graph, reruns every source, browser, legal, bundle,
and security gate, and publishes deterministic artifacts.

The release payload is:

- `aplexica-portal-${TAG}-local.tar.gz` — `dist-local/`, including its complete
  `legal/` directory, ready for daemon embedding;
- `aplexica-portal-${TAG}-source.tar.gz` — the exact history-free tagged source;
- `aplexica-portal-${TAG}.spdx.json` — SPDX 2.3 production-dependency SBOM;
- `aplexica-portal-${TAG}.intoto.jsonl` — in-toto/SLSA provenance statement;
- `SHA256SUMS` and `SHA256SUMS.sigstore.json` — digests for every payload and a
  keyless signature bound to this repository, workflow, and tag.

`${TAG}` is substituted verbatim, including its leading `v`; for example,
`v1.2.3` publishes `aplexica-portal-v1.2.3-local.tar.gz`.

The release workflow rejects lightweight, moved, or event-mismatched tags; tags
outside `main`; symlinks or special source entries; mutable actions; incomplete
legal output; non-reproducible archives; and failing tests. Both archives have
sorted members, one commit-derived mtime, safe normalized modes, numeric uid/gid
zero, empty owner/group names, a metadata-free gzip header, and no xattrs, ACLs,
SELinux labels, or PAX headers. Repository rules must separately restrict tag
creation, updates, and deletion to the release identity and block force updates.

To prepare a release after the intended commit is green on `main`:

```sh
TAG=v1.2.3
git tag -a "$TAG" -m "Aplexica Portal $TAG"
git push origin "$TAG"
```

After the workflow finishes, verify anonymously in a clean directory:

```sh
TAG=v1.2.3
gh release download "$TAG" --repo Aplexica/aplexica-portal
cosign verify-blob \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity "https://github.com/Aplexica/aplexica-portal/.github/workflows/release.yml@refs/tags/$TAG" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  SHA256SUMS
sha256sum --check SHA256SUMS
```

The daemon handoff uses the public repository, the immutable tag, the
`aplexica-portal-${TAG}-local.tar.gz` asset name, and its exact SHA-256 line
from `SHA256SUMS`. It must also prove that the real daemon applies the bundled
`daemon-http-headers.json` contract to all portal responses before consuming the
release. Daemon download, embedding, and HTTP-handler changes belong in the
daemon repository, not here.
