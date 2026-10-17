set shell := ["bash", "-euo", "pipefail", "-c"]

check:
    bun install --frozen-lockfile --ignore-scripts
    bun run lint
    bun run typecheck
    bun run check:worker
    bun run scripts/generate-presentation.ts --check

baseline-check:
    flutter pub get --enforce-lockfile
    dart format --output=none --set-exit-if-changed lib
    flutter analyze --no-pub

build:
    bun run build
    python3 scripts/check-artifact.py build/react

baseline-build:
    python3 scripts/build.py
    python3 scripts/check-artifact.py build/web

worker-check:
    bun run check:worker
    bun run test:worker
