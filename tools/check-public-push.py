#!/usr/bin/env python3
"""Reject pushes carrying legacy business history, runtime data or known secrets."""
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('public_release', root / 'tools/public-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
common = Path(subprocess.check_output(['git', 'rev-parse', '--git-common-dir'], text=True).strip())
safety = common / 'prota-safety.json'
legacy = set(json.loads(safety.read_text()).get('legacyRoots', [])) if safety.exists() else set()
for line in sys.stdin:
    local_ref, revision, remote_ref, old_revision = line.split()
    if set(revision) == {'0'}:
        continue
    commits = subprocess.check_output(['git', 'rev-list', revision], text=True).splitlines()
    if legacy.intersection(commits):
        sys.exit('拒绝推送：该分支仍包含旧业务历史。请只推送干净的产品分支。')
    for commit in commits:
        files = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', commit], text=True).splitlines()
        if any(re.match(r'^(src/pages/.+|shares/|data/(agent-sessions|agent-uploads|published-static|share-archive)/)', file) or file == '.env' for file in files):
            sys.exit('拒绝推送：提交历史包含业务或运行文件。')
        if 'data/projects.json' in files:
            index = json.loads(subprocess.check_output(['git', 'show', commit + ':data/projects.json']))
            if index.get('projects'):
                sys.exit('拒绝推送：项目总索引不是空白产品默认值。')
    # Inspect every newly pushed commit: deleting a secret at the tip does not
    # remove the secret from intermediate history.
    known_old = set(old_revision) != {'0'} and subprocess.run(['git', 'cat-file', '-e', old_revision], capture_output=True).returncode == 0
    incoming = subprocess.check_output(['git', 'rev-list', revision, *(('^' + old_revision,) if known_old else ())], text=True).splitlines()
    for incoming_commit in incoming:
        with tempfile.TemporaryDirectory(prefix='prota-push-audit-') as temporary:
            target = Path(temporary).resolve()
            packed = subprocess.check_output(['git', 'archive', incoming_commit])
            with tarfile.open(fileobj=io.BytesIO(packed)) as archive:
                for member in archive.getmembers():
                    destination = target / member.name
                    if target not in destination.resolve().parents or not (member.isdir() or member.isfile()):
                        sys.exit('拒绝推送：归档包含不安全的路径或符号链接。')
                    if member.isfile():
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_bytes(archive.extractfile(member).read())
            findings = release.audit(target)
            if findings:
                print(json.dumps(findings, ensure_ascii=False), file=sys.stderr)
                sys.exit('拒绝推送：产品提交检查未通过。')
print('产品推送检查通过：无旧业务历史和业务运行文件。', file=sys.stderr)
