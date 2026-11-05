#!/usr/bin/env python3
"""Operator diagnostics/build/migrate/rollback; normal canvas users need none of these."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import workspace
from server.canvas_runtime_package import (is_canvas, is_shared, runtime_bundle, pin_runtime,
    migrate_entry, restore_entry, materialize_runtime)
parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['status', 'build', 'migrate', 'rollback'])
parser.add_argument('--workspace', type=Path)
parser.add_argument('--output', type=Path)
args = parser.parse_args()
root = (args.workspace or workspace.workspace_root()).resolve()
if args.action == 'build':
    if not args.output:
        parser.error('build requires --output')
    pinned, manifest = pin_runtime(root)
    materialize_runtime(args.output, pinned, manifest['runtimeHash'])
    print(json.dumps(manifest, ensure_ascii=False))
else:
    results = []
    for data in sorted((root / 'src/pages').glob('*/*/v*/canvas-data.js')):
        directory = data.parent
        project, page, version = directory.relative_to(root / 'src/pages').parts
        row = dict(projectId=project, pageId=page, version=version)
        try:
            if not is_canvas(directory):
                row['status'] = 'blocked'
                row['reason'] = 'not-a-canvas-editor'
            elif args.action == 'status':
                row['status'] = 'shared' if is_shared(directory) else 'legacy'
            elif args.action == 'migrate':
                # Never run this operator command while a browser/Agent is editing;
                # normal users migrate through the guarded Portal request instead.
                result = migrate_entry(root, row)
                row['status'] = 'blocked' if result.get('deferred') else 'shared'
            else:
                restore_entry(root, row)
                row['status'] = 'legacy'
        except (ValueError, OSError, KeyError) as error:
            row.update(status='failed', error=str(error))
        results.append(row)
    print(json.dumps(results, ensure_ascii=False, indent=2))
    if any(row['status'] in {'failed','blocked'} for row in results):
        sys.exit(1)
