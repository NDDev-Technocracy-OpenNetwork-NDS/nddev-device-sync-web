set shell := ["bash", "-euo", "pipefail", "-c"]

setup:
    bun install --frozen-lockfile --ignore-scripts
    bun run prepare:source

check:
    bun run lint
    bun run typecheck:source
    bun run scripts/generate-presentation.ts --check

test:
    bun run check:worker
    bun run scripts/qualify-source-inputs.ts
    bun run test:ci
    bun run build --development-http

build:
    bun run build
    python3 scripts/check-artifact.py build/react

verify: check test build

worker-check:
    bun run check:worker
    bun run test:worker

# Requires the explicitly owned loopback PG/SMTP fixture and served app bundle.
organizations-browser:
    bun run test:organizations-browser
