#!/bin/zsh
set -e

if command -v bun >/dev/null 2>&1; then
  bun run test
else
  /Users/mazenhassan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/pto.test.mjs
fi
