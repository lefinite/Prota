#!/usr/bin/env python3
"""Export product sources into a fresh directory, then fail closed on private data.

No Git history is copied. Review the emitted audit before creating a public repo.
"""
import argparse
import json
import re
import shutil
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import workspace

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ['Prota.app', '.githooks', 'portal', 'server', 'scripts', 'src/templates', 'tools', '.claude/skills', 'assets']
FILES = ['package.json', 'package-lock.json', 'README.md', 'README.zh-CN.md', 'AGENTS.md', '.gitignore', 'start-portal.command',
         'data/agent-provider-presets.json', 'data/agent-sdk-extension.mjs', 'data/templates.json',
         'docs/workspace-and-publishing.md', 'docs/share-setup-guide.md', 'docs/sharing-flow.mmd', 'docs/sharing-flow.svg',
         'docs/developer-setup.md', 'docs/workspace-storage.md', 'docs/unified-settings-design.md', 'docs/provider-model-discovery.md']
PRIVATE_PARTS = {'node_modules', '__pycache__', '.git', '.DS_Store', 'user-preferences.md', '.readify-skills.json', 'skill-backups'}
SIGNALS = [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
           r'gh[pousr]_[A-Za-z0-9]{25,}', r'sk-[A-Za-z0-9_-]{24,}']



def audit(directory):
    findings = []
    signals = list(SIGNALS)
    try:
        projects = json.loads((workspace.workspace_root() / 'data/projects.json').read_text()).get('projects', [])
        for project in projects:
            project_id = project['id']
            signals.append(re.escape('src/pages/' + project_id + '/'))
            name = project.get('name', '')
            if len(name) >= 4 and name not in {'Readify', 'Readify Web', '示例项目', '模板项目'}:
                signals.append(re.escape(name))
        signals.append(re.escape(str(Path.home())))
        settings = json.loads((workspace.workspace_root() / 'data/settings.json').read_text())
        signals.extend(re.escape(settings[key]) for key in ['staticDomain', 'publicDomain'] if settings.get(key) and not settings[key].endswith('example.com'))
    except (OSError, ValueError):
        pass
    secret_values = []
    config = workspace.CONFIG_DIR / 'agent-provider-config.json'
    if config.is_file():
        data = json.loads(config.read_text())
        secret_values = [p['apiKey'] for p in data.get('providers', []) if len(p.get('apiKey', '')) >= 12]
    for file in directory.rglob('*'):
        relative = file.relative_to(directory).as_posix()
        if file.is_symlink():
            findings.append({'file': relative, 'reason': 'symbolic link'})
            continue
        if not file.is_file():
            continue
        if relative.startswith(('src/pages/', 'shares/', 'data/agent-sessions/', 'data/agent-uploads/')) or file.name == '.env':
            findings.append({'file': relative, 'reason': 'business/runtime file'})
        content = file.read_bytes()
        if any(s.encode() in content for s in secret_values):
            findings.append({'file': relative, 'reason': 'matches a local provider credential'})
        if file.suffix in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2', '.ttf', '.ico'}:
            continue
        text = content.decode('utf-8', errors='replace')
        for pattern in signals:
            if re.search(pattern, text, re.I):
                findings.append({'file': relative, 'reason': 'private identity or credential pattern', 'pattern': pattern})
    return findings


def export(target):
    if target.exists():
        raise ValueError('导出目录必须不存在，避免覆盖已有文件。')
    if target == ROOT or ROOT in target.parents or target in ROOT.parents:
        raise ValueError('导出目录必须位于产品目录之外。')
    target.mkdir(parents=True)
    for relative in DIRECTORIES:
        source = ROOT / relative
        if not source.is_dir():
            continue
        for file in source.rglob('*'):
            rel = file.relative_to(ROOT)
            if file.is_symlink() or PRIVATE_PARTS.intersection(rel.parts) or not file.is_file():
                continue
            dest = target / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, dest)
    for relative in FILES:
        source = ROOT / relative
        if source.is_file():
            dest = target / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
    # Generic regression suites; actual business-page tests stay in the private workspace.
    for source in (ROOT / 'tests').glob('*'):
        if source.is_file() and source.suffix in {'.py', '.mjs'} and not source.name.startswith('readify-'):
            dest = target / 'tests' / source.name
            dest.parent.mkdir(exist_ok=True)
            shutil.copy2(source, dest)
    (target / 'src/pages').mkdir(parents=True)
    (target / 'data/projects.json').write_text(json.dumps({'projects': [], 'activeProjectId': None, 'activePageId': None}, indent=2)+'\n')
    findings = audit(target)
    return {'readyForReview': not findings, 'files': sum(f.is_file() for f in target.rglob('*')), 'findings': findings,
            'limits': 'Automated checks do not establish ownership or replace human review of templates, skills, images and dependencies.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', type=Path)
    parser.add_argument('--audit-only', action='store_true')
    args = parser.parse_args()
    target = args.target.expanduser().resolve()
    result = {'findings': audit(target)} if args.audit_only else export(target)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(1 if result['findings'] else 0)
