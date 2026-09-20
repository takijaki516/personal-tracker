#!/bin/bash

# Hooks inherit the app's PATH, which may not contain the project's Node version.
cd "$(dirname "$0")/.." || exit 2
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major === 24 && minor >= 3 ? 0 : 1)' >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh" --no-use >/dev/null 2>&1
    nvm use --silent >/dev/null 2>&1
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '{"systemMessage":"Codex 종료 검사를 실행하지 못했습니다. Node 24.3 이상, 25 미만을 설치하고 npm run format:check 및 npm run lint를 직접 실행하세요. 검사 통과로 보고하지 마세요."}'
  exit 0
fi

exec node scripts/codex-stop-check.mjs
