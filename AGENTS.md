# NDS web working contract

This repository owns the browser assembly and immutable app-shell artifact.
React, strict TypeScript, TanStack and shadcn own browser presentation under
ADR 0010. Reuse the shared Rust composition pinned in assembly.lock.json;
domain, identity, vault and sync rules remain in their Rust owners. Generate
metadata bindings and en/ru messages from their canonical sources. Secrets and
immutable commands stay in Rust; do not add a JavaScript mutation queue.
The Flutter browser remains the migration baseline until parity is qualified.

Read standarts.lock, module.yaml and the locked engineering/workflow contracts.
Use rust-toolchain.toml, the package.json tool pins and the single bun.lock.
Flutter/Dart pins apply to the retained baseline. Author browser code and workers
in TypeScript; emitted JavaScript is generated. Keep all assets same-origin and
CSP-compatible. Cache only manifest-verified static assets, never API responses.
Browser secrets stay in the protected accounts adapter, never presentation DTOs,
React/Query state or logs. A failed read must not mark a revision as loaded.

Public code is AGPL-3.0-only. No credentials, private topology or runtime evidence.
Run actual browser offline acceptance as well as build/analysis; report exact
platform coverage. Signed work -> dev -> main PRs. No implicit release/deploy.
