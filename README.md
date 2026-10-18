# NDS web

The React browser client reuses the shared Rust composition pinned in
`assembly.lock.json`. React/strict TypeScript, TanStack and shadcn own presentation;
Rust owns identity, company permissions, encryption, replica and immutable commands.
WASM metadata bindings come from Rust and en/ru messages come from Shared ARB.
OpenNetwork tokens, bundled fonts and the mark retain their canonical design input.

Account/device, passkey, company/invitation, Vault, shared clipboard, diagnostics,
incident and repository catalog workflows are implemented. Git materialization
and restart-safe automatic catalog traversal are still pending. React replaces
the previous Flutter browser assembly under ADR 0010; desktop and mobile retain
Flutter. This source is part of the first alpha, not a completed release.

## Build

Use Bun/Node from `package.json` and `rust-toolchain.toml` with the
`wasm32-unknown-unknown` target, and the `wasm-bindgen` CLI version recorded in the
shared Rust lockfile. Run `bun install --frozen-lockfile --ignore-scripts`,
`just check` and `just build`. Builds require committed source and reject generated
drift. Sources are fetched by immutable SHA into `.nds-cache`; optional
`NDS_SHARED_SOURCE`/`NDS_DESIGN_SOURCE` paths must be clean at those exact commits.
WASM declarations are generated per compiled binary before TypeScript checks;
profile-specific runtime exports are build artifacts. `just check` prepares a
development artifact, while `just build` validates the production artifact.

The worker acceptance uses the Node and Playwright versions pinned in `package.json`. Run
`bunx playwright install chromium` and
`just worker-check`.
An existing Chromium executable can be selected with `NDS_TEST_CHROMIUM`. The
test owns an isolated browser context and loopback server; it exercises actual
updates, offline navigation, cache integrity, repair limits and timeouts.

The browser artifact is `build/react`. The NDS server verifies every file in
`nds-assets.json` before serving it from `NDS_WEB_ROOT`. Serve the application
and API at one HTTPS origin; no endpoint, bearer token or deployment secret is
embedded in the bundle. A `--development-http` build uses Rust's debug profile
and the existing loopback-only development feature for isolated acceptance.

The app shell caches only manifest-verified assets. Updates wait for old app
windows to close; an active client is never forcibly reloaded. Failed updates
preserve the previous waiting build too. Retention is bounded to three static
caches; each installation prunes older unreferenced builds. Activation preserves
a concurrent installation. Presentation assets, fonts and Rust/WASM are self-hosted
under the server's CSP.

The app-shell worker is authored in `scripts/offline-worker.ts`. Its checked-in
JavaScript projection is generated with `bun run generate:worker` and verified
with `bun run check:worker`. The browser test exercises
the real worker, including credential-free static reads, normal uncached API
requests, corruption, concurrent installation, repair bounds and preserved data.

## Offline boundary

A signed server verification of the active device authorizes local encrypted
records for at most seven days. Existing shorter grants retain their original
expiry until reverified; account metadata alone cannot extend them. Reconnection
verifies the device before uploading retained work. Changes remain in the durable
encrypted outbox until the server acknowledges them. Server sequence
and explicit conflict resolution determine convergence. Browser site-data
removal or storage eviction can remove unsynchronized data; persistent-storage
status and qualification are part of browser acceptance.

Session cookies are Secure/HttpOnly. The accounts adapter encrypts local key
material with a non-extractable browser wrapping key. Secrets are never returned
through the presentation bridge for clipboard copying. Native system tools
remain native capabilities.

Production browser qualification and release provenance must identify the exact
shared source, browser, storage, offline/reconnect and observability evidence.
A compile gate alone does not establish support for a browser.

AGPL-3.0-only · [NDDev OpenNetwork](https://nddev.ai)

Company administration and invitation verification reuse the selected Shared
Organizations/Accounts Rust client. Administrative changes are
online; an uncertain command can be retried without replacing its identity.
Invitation fragments are captured and cleared in Rust before routing;
there is no token in a presentation DTO or persistent invitation cache.
