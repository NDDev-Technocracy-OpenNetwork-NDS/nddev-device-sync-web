# NDS web working contract

This repository owns the browser assembly and immutable app-shell artifact. React,
strict TypeScript, TanStack and shadcn own browser presentation under ADR 0010. Reuse
the shared Rust composition pinned in assembly.lock.json; domain, identity, vault and
sync rules remain in their Rust owners. Generate metadata bindings and en/ru messages
from their canonical sources. Secrets and immutable commands stay in Rust; do not add a
JavaScript mutation queue.

Read README.md, module.yaml and contracts.lock. Use rust-toolchain.toml, the
package.json tool pins and the single bun.lock. Author browser code and workers in
TypeScript; emitted JavaScript is generated. Desktop and mobile retain their separate
Flutter assemblies. Keep all assets same-origin and CSP-compatible. Cache only
manifest-verified static assets, never API responses. Browser secrets stay in the
protected accounts adapter, never presentation DTOs, React/Query state or logs. A failed
read must not mark a revision as loaded.

`just setup` prepares source inputs without compilation. `just check` validates
both compiler-produced declaration profiles, TypeScript and canonical presentation
bytes; it runs no tests, Rust/WASM/worker compilation or application build. Source
checks use prepared immutable checkouts and must not invoke prepare_native.py or
Cargo. `just test`, `just build` and `just verify` run on execution hosts or runners.
Keep generated binding provenance and the actual compiler drift gate together.
The explicit CI `bindings` mode produces source inputs; it does not qualify an app.

Public code is AGPL-3.0-only. No credentials, private topology or runtime evidence. Run
actual browser offline acceptance as well as build/analysis; report exact platform
coverage. Merge task PRs into dev; main advances to its verified commit. No implicit release/deploy.
