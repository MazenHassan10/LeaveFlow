#!/bin/zsh
set -e

if command -v bun >/dev/null 2>&1; then
  bun run dev
else
  PATH=/Users/mazenhassan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
    /Users/mazenhassan/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm dev
fi
