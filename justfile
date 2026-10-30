set shell := ["bash", "-euo", "pipefail", "-c"]

check:
    bun install --frozen-lockfile --ignore-scripts
    bun run lint
    bun run test:organizations
    bun run check:worker
    bun run build --development-http
    bun run scripts/generate-presentation.ts --check

build:
    bun run build
    python3 scripts/check-artifact.py build/react

worker-check:
    bun run check:worker
    bun run test:worker

# Requires the explicitly owned loopback PG/SMTP fixture and served app bundle.
organizations-browser:
    bun run test:organizations-browser
