---
status: accepted
date: '2026-10-22'
adaptation:
  standard:
    id: std-0001
  rules:
  - R-0018
  paths:
  - assembly.lock.json
  - index.html
  - licenses
  - module.yaml
  - rust-toolchain.toml
  - standarts.lock
  reason: NDS system ADR 0013 (accepted owner direction) keeps NDS-owned material at fixed top-level locations
    in member repositories.
  result: '`assembly.lock.json`: NDS contract locks pinning the shared native composition and the standards
    corpus. `index.html`: Vite entry document for the immutable app shell. `licenses`: Third-party license
    attribution texts shipped with the app shell. `module.yaml`: NDS module descriptor, scoped TypeScript
    project references and the shadcn/Vite project configuration owned by the product standards corpus.
    `rust-toolchain.toml`: Pinned Rust toolchain for the wasm assembly build owned by the repository.
    `standarts.lock`: NDS contract locks pinning the shared native composition and the standards corpus.'
  verification: Review against the NDS root ADR 0013; the root catalog check validates NDS descriptors
    and locks, and the repository's own checks exercise the remaining paths.
---
# NDS contract locations

The owner accepted NDS system [ADR 0013](https://github.com/NDDev-Technocracy-OpenNetwork-NDS/nddev-device-sync/blob/main/standarts/decisions/0013-estate-hygiene-and-standards-adoption.md). It keeps NDS-owned material at
deliberate top-level locations in member repositories. This record scopes
that decision to this repository under std-0001 R-0037 and replaces the
earlier manifest variations without changing them.

- `assembly.lock.json` (lock): NDS contract locks pinning the shared native composition and the standards corpus.
- `index.html` (asset): Vite entry document for the immutable app shell.
- `licenses` (legal): Third-party license attribution texts shipped with the app shell.
- `module.yaml` (manifest): NDS module descriptor, scoped TypeScript project references and the shadcn/Vite project configuration owned by the product standards corpus.
- `rust-toolchain.toml` (tool-config): Pinned Rust toolchain for the wasm assembly build owned by the repository.
- `standarts.lock` (lock): NDS contract locks pinning the shared native composition and the standards corpus.
