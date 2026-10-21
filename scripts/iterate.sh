#!/bin/bash
set -euo pipefail

# Readify Iteration Helper (Bash Version)
# Usage: ./iterate.sh <project_id> <page_id> <new_version> [source_version]

PROJECT_ID=${1:-}
PAGE_ID=${2:-}
NEW_VERSION=${3:-}

if [ -z "$PROJECT_ID" ] || [ -z "$PAGE_ID" ] || [ -z "$NEW_VERSION" ]; then
    echo "Usage: ./iterate.sh <project_id> <page_id> <new_version> [source_version]"
    exit 1
fi

if [[ ! "$PROJECT_ID" =~ ^[a-zA-Z0-9_-]+$ ]] || [[ ! "$PAGE_ID" =~ ^[a-zA-Z0-9_-]+$ ]] || [[ ! "$NEW_VERSION" =~ ^v[0-9]+$ ]]; then
    echo "Error: invalid project, page or version ID" >&2
    exit 1
fi
WORKSPACE_ROOT=$(node "$(dirname "$0")/../server/workspace-path.mjs")
PAGES_DIR="$WORKSPACE_ROOT/src/pages/$PROJECT_ID/$PAGE_ID"

# Use provided source version, or fall back to latest
if [ -n "${4:-}" ] && [ -d "$PAGES_DIR/$4" ]; then
    SOURCE_VERSION=$4
else
    SOURCE_VERSION=$(ls "$PAGES_DIR" | grep "^v" | sort -V | tail -n 1)
fi

echo "Forking from $SOURCE_VERSION to $NEW_VERSION..."
SOURCE_DIR="$PAGES_DIR/$SOURCE_VERSION"
TARGET_DIR="$PAGES_DIR/$NEW_VERSION"
if [ ! -f "$SOURCE_DIR/index.html" ]; then
    echo "Error: source version does not exist: $SOURCE_DIR" >&2
    exit 1
fi

if [ -d "$TARGET_DIR" ]; then
    echo "Error: Version $NEW_VERSION already exists at $TARGET_DIR"
    exit 1
fi

# 1. Copy directory
echo "Cloning $SOURCE_VERSION to $NEW_VERSION..."
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo -e "\nSuccessfully forked $PAGE_ID from $SOURCE_VERSION to $NEW_VERSION in project $PROJECT_ID!"
echo "New path: /src/pages/$PROJECT_ID/$PAGE_ID/$NEW_VERSION/"

