#!/usr/bin/env bash
set -euo pipefail
REPO="https://github.com/shadcn-ui/ui.git"
BRANCH="main"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/repo"
DEST="$HERE/official-live-snapshot"
rm -rf "$DEST"
mkdir -p "$DEST"
copy_path() {
  local rel="$1"
  if [ ! -e "$TMP/repo/$rel" ]; then
    echo "Missing upstream path: $rel" >&2
    exit 2
  fi
  mkdir -p "$DEST/$(dirname "$rel")"
  cp -R "$TMP/repo/$rel" "$DEST/$rel"
}
copy_path "skills/shadcn"
printf 'Synced %s (%s) into %s\n' "$REPO" "$BRANCH" "$DEST"
