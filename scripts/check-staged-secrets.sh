#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "pre-commit secret scan skipped: 'rg' (ripgrep) is required."
  exit 0
fi

DIFF_CONTENT="$(git diff --cached --no-color --unified=0 --diff-filter=AM)"

if [ -z "${DIFF_CONTENT}" ]; then
  exit 0
fi

# Scan only added lines in staged changes to reduce false positives.
PATTERN='
^\+(?!\+\+\+ ).*(
  -----BEGIN[[:space:]].*PRIVATE[[:space:]]KEY-----|
  AKIA[0-9A-Z]{16}|
  ASIA[0-9A-Z]{16}|
  ghp_[A-Za-z0-9]{36}|
  github_pat_[A-Za-z0-9_]{70,}|
  sk-[A-Za-z0-9]{20,}|
  xox[baprs]-[A-Za-z0-9-]{10,}|
  (?i)\b(api[_-]?key|token|secret|password|passwd|private[_-]?key|client[_-]?secret|access[_-]?key)\b
  [[:space:]]*[:=][[:space:]]*["\x27]?
  (?!your_|example|dummy|test|sample|changeme|replace_me|<|\\$\\{)
  [A-Za-z0-9_./+=-]{12,}
)'

MATCHES="$(printf '%s\n' "${DIFF_CONTENT}" | rg -n --multiline --pcre2 "${PATTERN}" || true)"

if [ -n "${MATCHES}" ]; then
  echo
  echo "Commit blocked: possible secret(s) detected in staged changes."
  echo "Review and remove these values before committing:"
  echo
  printf '%s\n' "${MATCHES}"
  echo
  echo "If this is a false positive, adjust the scanner in scripts/check-staged-secrets.sh"
  echo "or bypass once with: git commit --no-verify"
  exit 1
fi

exit 0
