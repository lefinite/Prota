#!/bin/bash

# Readify Deletion Helper (Safe Version)
# Usage: ./delete.sh <page_id> <version>

PAGE_ID=$1
VERSION=$2

if [ -z "$PAGE_ID" ] || [ -z "$VERSION" ]; then
    echo "Usage: ./delete.sh <page_id> <version>"
    exit 1
fi

WORKSPACE_ROOT=$(node "$(dirname "$0")/../server/workspace-path.mjs") || exit 1
TARGET_DIR="$WORKSPACE_ROOT/src/pages/$PAGE_ID/$VERSION"
JSON_FILE="$WORKSPACE_ROOT/data/projects.json"
SHELL_FILE="$WORKSPACE_ROOT/portal/shell.js"

echo "🗑️ Deleting version $VERSION for page $PAGE_ID..."

# 1. Update data/projects.json using Python for reliable JSON manipulation
python3 -c "
import json, sys
try:
    with open('$JSON_FILE', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    page = next((p for p in data['pages'] if p['id'] == '$PAGE_ID'), None)
    if page:
        if '$VERSION' in page['versions']:
            page['versions'].remove('$VERSION')
            if page.get('activeVersion') == '$VERSION':
                page['activeVersion'] = page['versions'][0] if page['versions'] else ''
            
            with open('$JSON_FILE', 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print('Successfully updated $JSON_FILE')
except Exception as e:
    print(f'Error updating JSON: {e}')
    sys.exit(1)
"

# 2. Update portal/shell.js fallback defaults (using sed is okay for the fallback string)
if [ -f "$SHELL_FILE" ]; then
    sed -i '' "s/\"$VERSION\", //g" "$SHELL_FILE"
    sed -i '' "s/, \"$VERSION\"//g" "$SHELL_FILE"
    sed -i '' "s/\"$VERSION\"//g" "$SHELL_FILE"
    echo "Cleaned up portal/shell.js fallbacks"
fi

# 3. Physically delete the directory
if [ -d "$TARGET_DIR" ]; then
    rm -rf "$TARGET_DIR"
    echo "Physically removed directory: $TARGET_DIR"
else
    echo "Directory $TARGET_DIR not found, metadata-only cleanup performed."
fi

echo -e "\n✅ Success: $PAGE_ID / $VERSION removed."
