#!/usr/bin/env bash
#
# Rotate the proxy URL-signing secret for the Cloudflare Worker with a graceful
# overlap, so in-flight signed /v1/proxy URLs keep verifying during the swap.
#
# How it works:
#   - Signing always uses PROXY_SIGNING_SECRET (the current secret).
#   - Verification accepts PROXY_SIGNING_SECRET *and* any value in
#     PROXY_SIGNING_SECRET_PREVIOUS (see packages/core/src/services/proxy.ts).
#   So we set the OLD secret as PREVIOUS, promote a NEW secret to current, wait
#   out the token TTL, then drop PREVIOUS.
#
# Cloudflare secrets are WRITE-ONLY — you cannot read the current value back —
# so you must supply the currently-deployed secret as CURRENT_SECRET.
#
# Usage:
#   CURRENT_SECRET='<currently-deployed-value>' scripts/rotate-proxy-secret.sh rotate
#   scripts/rotate-proxy-secret.sh cleanup     # run AFTER the TTL window
#
# After `rotate`, WAIT at least PROXY_TOKEN_TTL_SECONDS (default 14400s / 4h,
# plus a safety margin) before `cleanup`, so every URL signed with the old
# secret has expired.
#
set -euo pipefail

CORE_DIR="$(cd "$(dirname "$0")/../packages/core" && pwd)"
cmd="${1:-rotate}"

wrangler_cmd() {
  if command -v wrangler >/dev/null 2>&1; then wrangler "$@"; else npx --yes wrangler "$@"; fi
}

case "$cmd" in
  rotate)
    : "${CURRENT_SECRET:?Set CURRENT_SECRET to the currently-deployed PROXY_SIGNING_SECRET value}"
    NEW_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")"
    cd "$CORE_DIR"
    printf '%s' "$CURRENT_SECRET" | wrangler_cmd secret put PROXY_SIGNING_SECRET_PREVIOUS
    printf '%s' "$NEW_SECRET"     | wrangler_cmd secret put PROXY_SIGNING_SECRET
    echo
    echo "Rotation staged. Store this NEW signing secret securely — you will need"
    echo "it as CURRENT_SECRET for the next rotation:"
    echo
    echo "  $NEW_SECRET"
    echo
    echo "Wait >= PROXY_TOKEN_TTL_SECONDS (default 4h) + margin, then run:"
    echo "  scripts/rotate-proxy-secret.sh cleanup"
    ;;
  cleanup)
    cd "$CORE_DIR"
    wrangler_cmd secret delete PROXY_SIGNING_SECRET_PREVIOUS
    echo "Removed PROXY_SIGNING_SECRET_PREVIOUS. Rotation complete."
    ;;
  *)
    echo "usage: $0 [rotate|cleanup]" >&2
    exit 1
    ;;
esac
