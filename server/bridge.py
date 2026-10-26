#!/usr/bin/env python3
import http.server
import socketserver
import urllib.parse
import subprocess
import os
import json
import re
import base64
import html
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
try:
    from server import workspace
except ImportError:
    import workspace
from datetime import datetime, timezone
from copy import deepcopy

PORT = int(os.environ.get('READIFY_PORT', '8080'))
PUBLIC_DOMAIN = "prota.example.com"

def load_settings():
    root = get_project_root()
    settings_path = os.path.join(root, 'data', 'settings.json')
    defaults = {
        "publicDomain": "prota.example.com",
        "staticDomain": "",
        "gitAutoPush": False,
        "vercelAutoDeploy": True
    }
    if os.path.isfile(settings_path):
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {**defaults, **data}
        except Exception:
            pass
    return defaults

def save_settings(data):
    root = get_project_root()
    settings_path = os.path.join(root, 'data', 'settings.json')
    os.makedirs(os.path.dirname(settings_path), exist_ok=True)
    with open(settings_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def sharing_configured(settings):
    """A saved address alone is not a configured publishing destination."""
    domain = settings.get('staticDomain')
    if not isinstance(domain, str) or not domain or domain.endswith('.example.com') or not settings.get('vercelAutoDeploy', True):
        return False
    try:
        config = json.loads((workspace.CONFIG_DIR / 'vercel.json').read_text(encoding='utf-8'))
        return bool(config.get('projectId') and config.get('orgId') and config.get('staticDomain') == domain)
    except (OSError, ValueError, AttributeError):
        return False


def get_agent_provider_config_path():
    return str(workspace.CONFIG_DIR / 'agent-provider-config.json')


def normalize_agent_provider_config(data):
    if not isinstance(data, dict):
        raise ValueError('Provider config must be an object')
    raw_providers = data.get('providers', [])
    if not isinstance(raw_providers, list):
        raise ValueError('providers must be an array')

    providers = []
    for raw in raw_providers[:50]:
        if not isinstance(raw, dict):
            continue
        provider_id = str(raw.get('id', '')).strip()[:200]
        if not provider_id:
            continue
        sdk_options = raw.get('sdkOptions', {})
        if not isinstance(sdk_options, dict):
            sdk_options = {}
        sdk_options = dict(sdk_options)
        sdk_options.pop('planMode', None)
        if sdk_options.get('permissionMode') == 'plan':
            sdk_options['permissionMode'] = 'default'
        raw_models = raw.get('models', [])
        raw_endpoints = raw.get('endpointCandidates', [])
        providers.append({
            'id': provider_id,
            'label': str(raw.get('label', '')).strip()[:200],
            'presetId': str(raw.get('presetId', '')).strip()[:200] or None,
            'apiType': str(raw.get('apiType', 'anthropic-messages')).strip()[:100],
            'model': str(raw.get('model', '')).strip()[:300],
            'baseURL': str(raw.get('baseURL', '')).strip()[:2000],
            'apiKey': str(raw.get('apiKey', '')).strip()[:10000],
            'sdkOptions': sdk_options,
            'models': [
                str(item).strip()[:300]
                for item in raw_models[:500]
                if str(item).strip()
            ] if isinstance(raw_models, list) else [],
            'endpointCandidates': [
                str(item).strip()[:2000]
                for item in raw_endpoints[:100]
                if str(item).strip()
            ] if isinstance(raw_endpoints, list) else [],
            'createdAt': raw.get('createdAt'),
            'updatedAt': raw.get('updatedAt')
        })

    provider_ids = {provider['id'] for provider in providers}
    active_provider_id = str(data.get('activeProviderId', '')).strip()[:200] or None
    selected_provider_id = str(data.get('selectedProviderId', '')).strip()[:200] or None
    if active_provider_id not in provider_ids:
        active_provider_id = providers[0]['id'] if providers else None
    if selected_provider_id not in provider_ids:
        selected_provider_id = active_provider_id

    return {
        'providers': providers,
        'activeProviderId': active_provider_id,
        'selectedProviderId': selected_provider_id
    }


def load_agent_provider_config():
    config_path = get_agent_provider_config_path()
    if not os.path.isfile(config_path):
        legacy = os.path.join(get_application_root(), 'data', 'agent-provider-config.json')
        if os.path.isfile(legacy):
            with open(legacy, encoding='utf-8') as stream:
                save_agent_provider_config(json.load(stream))
        else:
            return None
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return normalize_agent_provider_config(json.load(f))
    except Exception:
        return None


def save_agent_provider_config(data):
    config = normalize_agent_provider_config(data)
    config_path = get_agent_provider_config_path()
    temp_path = f'{config_path}.tmp'
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(temp_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    os.chmod(temp_path, 0o600)
    os.replace(temp_path, config_path)
    return config



def get_project_root():
    return str(workspace.workspace_root())


def get_application_root():
    return str(workspace.APP_ROOT)


def normalize_safe_segment(value):
    return re.sub(r'[^a-zA-Z0-9_\-]', '', str(value or '')).strip()


def replace_copy_text_in_file(file_path, original_text, next_text):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    candidates = [original_text]
    if '\n' not in original_text:
        candidates.extend([
            original_text.replace(' ', ''),
            original_text.replace(' ', '\\n'),
            original_text.replace(' ', '\\\\n')
        ])

    escaped_original = json.dumps(original_text, ensure_ascii=False)[1:-1]
    escaped_next = json.dumps(next_text, ensure_ascii=False)[1:-1]
    if escaped_original != original_text:
        candidates.append(escaped_original)

    seen = set()
    unique_candidates = []
    for candidate in candidates:
        if candidate and candidate not in seen:
            seen.add(candidate)
            unique_candidates.append(candidate)

    matches = []
    for candidate in unique_candidates:
        count = content.count(candidate)
        if count:
            matches.append((candidate, count))

    total_matches = sum(count for _, count in matches)
    if total_matches == 0:
        return {'status': 'missing', 'count': 0}

    next_content = content
    replaced_count = 0
    for matched_text, count in matches:
        replacement = escaped_next if matched_text == escaped_original else next_text
        next_content = next_content.replace(matched_text, replacement)
        replaced_count += count

    if next_content == content:
        return {'status': 'missing', 'count': 0}

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(next_content)

    return {'status': 'updated', 'count': replaced_count}


def replace_copy_html_snippet_in_file(file_path, html_snippet, original_text, next_text):
    if not html_snippet or not original_text:
        return {'status': 'missing', 'count': 0}

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    snippets = [html_snippet]
    stripped = html_snippet.strip()
    if stripped != html_snippet:
        snippets.append(stripped)

    decoded_original = html.unescape(original_text)
    escaped_original = html.escape(decoded_original, quote=False)
    escaped_next = html.escape(next_text, quote=False)

    for snippet in snippets:
        if not snippet or snippet not in content:
            continue
        next_snippet = snippet
        replacements = [
            (original_text, next_text),
            (decoded_original, next_text),
            (escaped_original, escaped_next)
        ]
        changed = False
        for source, target in replacements:
            if source and source in next_snippet:
                next_snippet = next_snippet.replace(source, target, 1)
                changed = True
                break
        if not changed or next_snippet == snippet:
            continue
        next_content = content.replace(snippet, next_snippet, 1)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(next_content)
        return {'status': 'updated', 'count': 1, 'strategy': 'htmlSnippet'}

    return {'status': 'missing', 'count': 0}


def normalize_visible_text(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', str(value or '')))).strip()


def parse_simple_selector(selector):
    raw = str(selector or '').split('>')[-1].strip()
    raw = re.sub(r':nth-of-type\(\d+\)', '', raw)
    if not raw:
        return {}
    if raw.startswith('#'):
        return {'id': raw[1:]}
    tag_match = re.match(r'^([a-zA-Z][\w-]*)', raw)
    tag = tag_match.group(1).lower() if tag_match else ''
    id_match = re.search(r'#([\w\-\\]+)', raw)
    classes = [item.replace('\\', '') for item in re.findall(r'\.([\w\-\\]+)', raw)]
    return {
        'tag': tag,
        'id': id_match.group(1).replace('\\', '') if id_match else '',
        'classes': classes
    }


def tag_attrs_match(attrs, parsed):
    if parsed.get('id'):
        id_match = re.search(r'\bid\s*=\s*["\']([^"\']+)["\']', attrs)
        if not id_match or id_match.group(1) != parsed['id']:
            return False
    classes = parsed.get('classes') or []
    if classes:
        class_match = re.search(r'\bclass\s*=\s*["\']([^"\']+)["\']', attrs)
        if not class_match:
            return False
        source_classes = set(class_match.group(1).split())
        if not all(cls in source_classes for cls in classes):
            return False
    return True


def replace_copy_selector_in_file(file_path, selector, original_text, next_text):
    parsed = parse_simple_selector(selector)
    if not parsed or not (parsed.get('id') or parsed.get('classes')):
        return {'status': 'missing', 'count': 0}

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    tag = parsed.get('tag') or r'[a-zA-Z][\w-]*'
    pattern = re.compile(
        rf'<(?P<tag>{tag})(?P<attrs>[^>]*)>(?P<body>.*?)</(?P=tag)>',
        re.DOTALL | re.IGNORECASE
    )
    matches = []
    normalized_original = normalize_visible_text(original_text)
    for match in pattern.finditer(content):
        attrs = match.group('attrs') or ''
        if not tag_attrs_match(attrs, parsed):
            continue
        body = match.group('body')
        if normalized_original and normalize_visible_text(body) != normalized_original:
            continue
        matches.append(match)

    if not matches:
        return {'status': 'missing', 'count': 0}

    escaped_next = html.escape(next_text, quote=False)
    next_content_parts = []
    cursor = 0
    replaced_count = 0
    for match in matches:
        body = match.group('body')
        if '<' in body and normalize_visible_text(body) != normalize_visible_text(original_text):
            continue
        next_content_parts.append(content[cursor:match.start('body')])
        next_content_parts.append(escaped_next)
        cursor = match.end('body')
        replaced_count += 1

    if not replaced_count:
        return {'status': 'missing', 'count': 0}

    next_content_parts.append(content[cursor:])
    next_content = ''.join(next_content_parts)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(next_content)
    return {'status': 'updated', 'count': replaced_count, 'strategy': 'selector'}


def upsert_copy_patch(version_dir, selector, next_text):
    if not selector or not next_text:
        return None

    app_path = os.path.join(version_dir, 'app.js')
    if os.path.isfile(app_path):
        with open(app_path, 'r', encoding='utf-8') as f:
            content = f.read()
    else:
        content = ''

    start_marker = '/* READIFY_COPY_PATCHES_START */'
    end_marker = '/* READIFY_COPY_PATCHES_END */'
    patches = []
    marker_pattern = re.compile(
        re.escape(start_marker) + r'\n(?P<body>.*?)\n' + re.escape(end_marker),
        re.DOTALL
    )
    match = marker_pattern.search(content)
    if match:
        body = match.group('body')
        json_match = re.search(r'const patches = (?P<json>\[.*?\]);', body, re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group('json'))
                if isinstance(parsed, list):
                    patches = parsed
            except Exception:
                patches = []

    next_patch = {'selector': selector, 'text': next_text}
    replaced = False
    for index, patch in enumerate(patches):
        if isinstance(patch, dict) and patch.get('selector') == selector:
            patches[index] = next_patch
            replaced = True
            break
    if not replaced:
        patches.append(next_patch)

    patches_json = json.dumps(patches, ensure_ascii=False, indent=2)
    block = f"""{start_marker}
(() => {{
  const patches = {patches_json};
  const applyReadifyCopyPatches = () => {{
    patches.forEach((patch) => {{
      const target = document.querySelector(patch.selector);
      if (target && target.textContent !== patch.text) {{
        target.textContent = patch.text;
      }}
    }});
  }};
  if (document.readyState === "loading") {{
    document.addEventListener("DOMContentLoaded", applyReadifyCopyPatches);
  }} else {{
    applyReadifyCopyPatches();
  }}
  window.addEventListener("load", applyReadifyCopyPatches);
  setTimeout(applyReadifyCopyPatches, 0);
  setTimeout(applyReadifyCopyPatches, 120);
  setTimeout(applyReadifyCopyPatches, 600);
  if (document.body) {{
    new MutationObserver(applyReadifyCopyPatches).observe(document.body, {{
      childList: true,
      subtree: true,
      characterData: true
    }});
  }}
}})();
{end_marker}"""

    if match:
        next_content = marker_pattern.sub(block, content)
    else:
        next_content = content.rstrip() + '\n\n' + block + '\n'

    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(next_content)

    return os.path.relpath(app_path, get_project_root())


def apply_copy_edits(project_id, page_id, version, changes):
    root = get_project_root()
    safe_project_id = normalize_safe_segment(project_id)
    safe_page_id = normalize_safe_segment(page_id)
    safe_version = normalize_safe_segment(version)
    if not safe_project_id or not safe_page_id or not safe_version:
        raise ValueError('Invalid projectId, pageId, or version')

    version_dir = os.path.join(root, 'src', 'pages', safe_project_id, safe_page_id, safe_version)
    if not os.path.isdir(version_dir):
        raise FileNotFoundError(f'Version directory not found: src/pages/{safe_project_id}/{safe_page_id}/{safe_version}')

    ordered_files = []
    for filename in ('app.js', 'index.html', 'styles.css'):
        file_path = os.path.join(version_dir, filename)
        if os.path.isfile(file_path):
            ordered_files.append(file_path)
    for filename in os.listdir(version_dir):
        if not filename.endswith(('.js', '.html', '.css', '.json')):
            continue
        file_path = os.path.join(version_dir, filename)
        if os.path.isfile(file_path) and file_path not in ordered_files:
            ordered_files.append(file_path)

    results = []
    for index, change in enumerate(changes):
        original_text = str(change.get('originalText') or '').strip()
        next_text = str(change.get('nextText') or '').strip()
        selector = str(change.get('selector') or '').strip()
        html_snippet = str(change.get('htmlSnippet') or '').strip()
        if not original_text or not next_text or original_text == next_text:
            results.append({
                'index': index,
                'status': 'skipped',
                'reason': 'empty_or_unchanged',
                'originalText': original_text,
                'nextText': next_text
            })
            continue

        per_file = []
        updated = None
        updated_count = 0
        for file_path in ordered_files:
            outcome = replace_copy_html_snippet_in_file(file_path, html_snippet, original_text, next_text)
            rel_path = os.path.relpath(file_path, root)
            if outcome['status'] == 'updated':
                updated = rel_path
                updated_count = outcome.get('count', 1)
                per_file.append({'file': rel_path, **outcome})
                break

            outcome = replace_copy_selector_in_file(file_path, selector, original_text, next_text)
            if outcome['status'] == 'updated':
                updated = rel_path
                updated_count = outcome.get('count', 1)
                per_file.append({'file': rel_path, **outcome})
                break

            outcome = replace_copy_text_in_file(file_path, original_text, next_text)
            if outcome['status'] == 'updated':
                updated = rel_path
                updated_count = outcome.get('count', 1)
                per_file.append({'file': rel_path, **outcome})
                break
            if outcome['status'] == 'missing':
                per_file.append({'file': rel_path, **outcome})

        if updated:
            results.append({
                'index': index,
                'status': 'updated',
                'file': updated,
                'count': updated_count,
                'originalText': original_text,
                'nextText': next_text
            })
        else:
            patched_file = upsert_copy_patch(version_dir, selector, next_text)
            if patched_file:
                results.append({
                    'index': index,
                    'status': 'patched',
                    'file': patched_file,
                    'reason': '源码中没有找到原文案，已按选择器写入运行时文案补丁',
                    'selector': selector,
                    'originalText': original_text,
                    'nextText': next_text
                })
            else:
                results.append({
                    'index': index,
                    'status': 'missing',
                    'reason': '没有在当前版本源码中找到原文案，也缺少可用选择器',
                    'files': [os.path.relpath(path, root) for path in ordered_files],
                    'originalText': original_text,
                    'nextText': next_text
                })

    return results


def migrate_to_projects():
    root = get_project_root()
    json_path = os.path.join(root, 'data', 'projects.json')
    if not os.path.isfile(json_path):
        return

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return

    # Check if this is already in the new format
    if 'projects' in data:
        return

    # If 'pages' key exists, perform migration
    if 'pages' in data:
        print("Migrating legacy pages to project-based layout...")
        pages_list = data.get('pages', [])
        
        # 1. Create target project directory: src/pages/readify
        readify_dir = os.path.join(root, 'src', 'pages', 'readify')
        os.makedirs(readify_dir, exist_ok=True)

        # 2. Move physical page folders
        import shutil
        for page in pages_list:
            page_id = page.get('id')
            if not page_id:
                continue
            src_dir = os.path.join(root, 'src', 'pages', page_id)
            dest_dir = os.path.join(readify_dir, page_id)
            if os.path.isdir(src_dir) and page_id != 'readify':
                try:
                    shutil.move(src_dir, dest_dir)
                    print(f"Moved page folder: {page_id} -> readify/{page_id}")
                except Exception as e:
                    print(f"Error moving {page_id}: {str(e)}")

        # Move any unlisted legacy page folders directly under src/pages/
        pages_root = os.path.join(root, 'src', 'pages')
        for entry in os.listdir(pages_root):
            entry_path = os.path.join(pages_root, entry)
            if not os.path.isdir(entry_path) or entry.startswith('.'):
                continue
            if entry in ('readify', 'templates'):
                continue
            has_versions = False
            for sub in os.listdir(entry_path):
                if os.path.isdir(os.path.join(entry_path, sub)) and re.match(r'^v\d+$', sub):
                    has_versions = True
                    break
            if has_versions:
                dest_dir = os.path.join(readify_dir, entry)
                try:
                    shutil.move(entry_path, dest_dir)
                    print(f"Moved unlisted page folder: {entry} -> readify/{entry}")
                except Exception as e:
                    print(f"Error moving unlisted page folder {entry}: {str(e)}")

        # 3. Create new JSON structure
        new_data = {
            "projects": [
                {
                    "id": "readify",
                    "name": "Readify",
                    "deleted": False,
                    "deletedAt": None,
                    "pages": pages_list
                }
            ],
            "activeProjectId": "readify",
            "activePageId": data.get('activePage', '')
        }

        # Write updated config
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, indent=2, ensure_ascii=False)
        print("Migration to project-based layout complete!")


def scan_projects_and_pages(root):
    """Scan src/pages/ and return {project_id: {page_id: [versions]}} dict."""
    pages_dir = os.path.join(root, 'src', 'pages')
    if not os.path.isdir(pages_dir):
        return {}

    discovered = {}
    for proj_entry in sorted(os.listdir(pages_dir)):
        proj_path = os.path.join(pages_dir, proj_entry)
        if not os.path.isdir(proj_path) or proj_entry.startswith('.') or proj_entry == 'templates':
            continue

        proj_pages = {}
        for page_entry in sorted(os.listdir(proj_path)):
            page_path = os.path.join(proj_path, page_entry)
            if not os.path.isdir(page_path) or page_entry.startswith('.'):
                continue

            versions = []
            for v_entry in sorted(os.listdir(page_path)):
                v_path = os.path.join(page_path, v_entry)
                if os.path.isdir(v_path) and re.match(r'^v\d+$', v_entry):
                    if os.path.isfile(os.path.join(v_path, 'index.html')):
                        versions.append(v_entry)

            if versions:
                versions.sort(key=lambda v: int(v[1:]), reverse=True)
                proj_pages[page_entry] = versions

        # Keep project entry even if empty
        discovered[proj_entry] = proj_pages

    return discovered


def is_prd_doc_filename(filename, is_in_docs_dir=False):
    """Return True for markdown files that should appear in the document reader."""
    name = filename.strip()
    lower = name.lower()
    return lower.endswith('.md')


def list_prd_documents(root, project_id, page_id, version):
    """List PRD-like markdown documents under the page level docs folder (preferred) and version folder (legacy)."""
    docs_dir = os.path.normpath(os.path.join(root, 'src', 'pages', project_id, page_id, 'docs'))
    version_dir = os.path.normpath(os.path.join(root, 'src', 'pages', project_id, page_id, version))
    pages_root = os.path.normpath(os.path.join(root, 'src', 'pages'))

    documents = []
    seen_filenames = set()

    # Scan directories in order of preference: docs/ then version/
    for base_dir in [docs_dir, version_dir]:
        if not os.path.isdir(base_dir):
            continue

        for filename in sorted(os.listdir(base_dir)):
            if filename in seen_filenames:
                continue
            path = os.path.join(base_dir, filename)
            if not os.path.isfile(path):
                continue
            if not filename.lower().endswith('.md'):
                continue
            if not is_prd_doc_filename(filename, is_in_docs_dir=(base_dir == docs_dir)):
                continue
            
            # Determine relative path for shell loading (must be absolute from root)
            if base_dir == docs_dir:
                rel_path = f'/src/pages/{project_id}/{page_id}/docs/{filename}'
            else:
                rel_path = f'/src/pages/{project_id}/{page_id}/{version}/{filename}'
            stat = os.stat(path)

            documents.append({
                'path': rel_path,
                'filename': filename,
                'label': filename,
                'updatedAt': datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                'updatedAtMs': stat.st_mtime * 1000,
                'size': stat.st_size
            })
            seen_filenames.add(filename)

    documents.sort(key=lambda item: (
        -(item.get('updatedAtMs') or 0),
        item['filename']
    ))
    return documents


def get_next_prd_document_filename(root, project_id, page_id, version):
    """Build the next filename in the page-version-document-version format."""
    docs_dir = os.path.normpath(os.path.join(root, 'src', 'pages', project_id, page_id, 'docs'))
    base_name = f'{page_id}-{version}-prd-v'
    max_version = 0

    for document in list_prd_documents(root, project_id, page_id, version):
        filename = document.get('filename') or ''
        match = re.search(r'(?:^|[-_])prd[-_]?v(\d+)(?=\.md$|[-_])', filename, re.IGNORECASE)
        if match:
            max_version = max(max_version, int(match.group(1)))

    next_version = max_version + 1
    while os.path.exists(os.path.join(docs_dir, f'{base_name}{next_version}.md')):
        next_version += 1

    return f'{base_name}{next_version}.md', next_version


def build_new_prd_document_content(page_name, page_id, version, document_version):
    title = (page_name or page_id or '页面').strip()
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    return '\n'.join([
        f'# {title} PRD',
        '',
        f'> 页面: {page_id} | 版本: {version} | 文档版本: PRD v{document_version} | 创建时间: {now}',
        '',
        '## 1. 背景与目标',
        '',
        '## 2. 功能范围',
        '',
        '## 3. 交互规则',
        '',
        '## 4. 验收标准',
        ''
    ])


def resolve_prd_document_path(root, project_id, page_id, version, requested_path=''):
    """Resolve a PRD markdown path. Prefers src/pages/{projectId}/{pageId}/docs/ for new writes."""
    pages_root = os.path.normpath(os.path.join(root, 'src', 'pages'))
    version_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, version))
    docs_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, 'docs'))

    if not version_dir.startswith(pages_root + os.sep):
        raise ValueError('Invalid page path')
    
    # We require the version directory to exist to ensure it's a valid page/version
    if not os.path.isdir(version_dir):
        raise ValueError('Version directory not found')

    raw_path = urllib.parse.unquote(str(requested_path or ''))
    filename = os.path.basename(raw_path) or 'product-doc.md'
    if not filename.lower().endswith('.md'):
        raise ValueError('Only markdown files can be saved')

    # If requested path explicitly points to version dir or legacy structure
    if requested_path and f'/{version}/' in requested_path and '/docs/' not in requested_path:
        document_path = os.path.normpath(os.path.join(version_dir, filename))
        if not document_path.startswith(version_dir + os.sep):
            raise ValueError('Invalid PRD document path')
    else:
        # Default to docs dir
        document_path = os.path.normpath(os.path.join(docs_dir, filename))
        if not document_path.startswith(docs_dir + os.sep):
            raise ValueError('Invalid PRD document path')

    return document_path, filename


def resolve_prd_asset_path(root, project_id, page_id, version, requested_filename=''):
    """Resolve a PRD asset path. Prefers src/pages/{projectId}/{pageId}/docs/prd-assets/."""
    pages_root = os.path.normpath(os.path.join(root, 'src', 'pages'))
    version_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, version))
    docs_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, 'docs'))

    if not version_dir.startswith(pages_root + os.sep):
        raise ValueError('Invalid page path')
    if not os.path.isdir(version_dir):
        raise ValueError('Version directory not found')

    raw_name = urllib.parse.unquote(str(requested_filename or ''))
    filename = os.path.basename(raw_name).strip() or 'prototype-shot.png'
    filename = re.sub(r'[^A-Za-z0-9._-]+', '-', filename)
    if not re.search(r'\.(png|jpg|jpeg|webp)$', filename, re.IGNORECASE):
        filename = f'{filename}.png'

    assets_dir = os.path.normpath(os.path.join(docs_dir, 'prd-assets'))
    asset_path = os.path.normpath(os.path.join(assets_dir, filename))
    
    if not asset_path.startswith(assets_dir + os.sep):
        raise ValueError('Invalid asset path')

    return assets_dir, asset_path, filename


# Image extensions that the PRD asset pipeline knows how to produce/reference.
# Only files matching these are eligible for garbage collection; sidecar
# metadata (.json) and other artifacts are left untouched.
PRD_IMAGE_ASSET_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg')


def extract_referenced_prd_assets(content):
    """Return a set of asset filenames referenced inside a PRD markdown body.

    Recognizes standard markdown image syntax ``![alt](url)`` as well as bare
    ``prd-assets/<name>`` mentions that may appear inside HTML/inline tags.
    Both relative and absolute URLs are collapsed to their basename so the
    result can be matched against directory listings.
    """
    referenced = set()
    if not content:
        return referenced

    text = str(content)

    # Standard markdown image syntax: ![alt](url ...)
    for match in re.finditer(r'!\[[^\]]*\]\(\s*([^)\s]+)', text):
        url = match.group(1).split('?')[0].split('#')[0].strip()
        try:
            url = urllib.parse.unquote(url)
        except Exception:
            pass
        name = os.path.basename(url)
        if name:
            referenced.add(name)

    # Bare prd-assets/<name> references that may live outside markdown image
    # syntax (e.g. inside raw HTML <img src="prd-assets/x.png">).
    for match in re.finditer(r'prd-assets/([^\s)"\'<>]+)', text):
        raw = match.group(1).split('?')[0].split('#')[0]
        try:
            raw = urllib.parse.unquote(raw)
        except Exception:
            pass
        name = os.path.basename(raw)
        if name:
            referenced.add(name)

    return referenced


def cleanup_unused_prd_assets(root, project_id, page_id, version):
    """Delete image files under docs/prd-assets/ that no PRD document references.

    Because the ``prd-assets`` folder is shared by every PRD document of a page,
    references are collected across ALL discovered documents before anything is
    removed — deleting an image that is still cited by a sibling document would
    break that document. Only image files (by extension) are considered; JSON
    sidecars and other non-image artifacts are always preserved.
    """
    pages_root = os.path.normpath(os.path.join(root, 'src', 'pages'))
    docs_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, 'docs'))
    assets_dir = os.path.normpath(os.path.join(docs_dir, 'prd-assets'))

    if not os.path.isdir(assets_dir):
        return []

    # Aggregate referenced asset filenames across every PRD document for this page.
    referenced = set()
    for document in list_prd_documents(root, project_id, page_id, version):
        rel_path = str(document.get('path') or '').lstrip('/')
        if not rel_path:
            continue
        doc_disk_path = os.path.normpath(os.path.join(root, rel_path))
        # Defensive: skip anything that escapes the pages tree.
        if not doc_disk_path.startswith(pages_root + os.sep):
            continue
        try:
            with open(doc_disk_path, 'r', encoding='utf-8') as handle:
                referenced |= extract_referenced_prd_assets(handle.read())
        except Exception:
            continue

    deleted = []
    for filename in os.listdir(assets_dir):
        lowered = filename.lower()
        if not lowered.endswith(PRD_IMAGE_ASSET_EXTENSIONS):
            continue
        if filename in referenced:
            continue
        full_path = os.path.normpath(os.path.join(assets_dir, filename))
        # Containment guard: only delete files physically inside assets_dir.
        if not full_path.startswith(assets_dir + os.sep):
            continue
        if not os.path.isfile(full_path):
            continue
        try:
            os.remove(full_path)
            deleted.append(filename)
        except Exception as exc:
            print(f"Failed to remove unused PRD asset {filename}: {exc}")

    if deleted:
        print(f"[prd-assets] Cleaned up {len(deleted)} unused image(s) for {project_id}/{page_id}: {deleted}")
    return deleted


def build_default_data_js(data):
    """Build JS object literal string for getDefaultData return value."""
    return json.dumps(data, indent=4, ensure_ascii=False)


def normalize_page_target_device(value):
    normalized = str(value or '').strip().lower()
    return normalized if normalized in ('web', 'canvas') else 'mobile'


def normalize_page_meta(page, versions, fallback_target_device='mobile'):
    normalized = deepcopy(page)
    normalized['parentId'] = normalized.get('parentId') or None
    normalized['order'] = normalized.get('order', 0)
    normalized['targetDevice'] = normalize_page_target_device(
        normalized.get('targetDevice') or fallback_target_device
    )
    normalized['deleted'] = bool(normalized.get('deleted', False))
    normalized['deletedAt'] = normalized.get('deletedAt')
    normalized['versionStates'] = normalized.get('versionStates', {}) or {}
    next_states = {}
    for version in versions:
        state = normalized['versionStates'].get(version, {}) or {}
        next_states[version] = {
            'deleted': bool(state.get('deleted', False)),
            'deletedAt': state.get('deletedAt')
        }
    normalized['versionStates'] = next_states
    return normalized


def sync_projects():
    """Scan filesystem and sync projects.json + portal/shell.js."""
    root = get_project_root()
    migrate_to_projects()
    discovered = scan_projects_and_pages(root)

    # Read existing config to preserve names and preferences
    json_path = os.path.join(root, 'data', 'projects.json')
    existing = {}
    if os.path.isfile(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        except Exception:
            pass

    existing_projects_map = {p['id']: p for p in existing.get('projects', [])}

    projects = []
    all_project_ids = list(existing_projects_map.keys())
    for pid in discovered.keys():
        if pid not in all_project_ids:
            all_project_ids.append(pid)

    for pid in all_project_ids:
        proj_pages_scanned = discovered.get(pid, {})
        if pid in existing_projects_map:
            proj = deepcopy(existing_projects_map[pid])
            proj.pop('targetDevice', None)
            proj['deleted'] = bool(proj.get('deleted', False))
            proj['deletedAt'] = proj.get('deletedAt')
            proj['folders'] = [
                {
                    **folder,
                    'parentId': folder.get('parentId') or None,
                    'order': folder.get('order', (idx + 1) * 1000),
                    'deleted': bool(folder.get('deleted', False)),
                    'deletedAt': folder.get('deletedAt')
                }
                for idx, folder in enumerate(proj.get('folders', []) or [])
                if folder.get('id')
            ]
        else:
            proj = {
                'id': pid,
                'name': pid.capitalize(),
                'deleted': False,
                'deletedAt': None,
                'folders': [],
                'pages': []
            }

        existing_pages_map = {p['id']: p for p in proj.get('pages', [])}
        existing_order_values = [
            p.get('order', 0)
            for p in existing_pages_map.values()
            if isinstance(p.get('order', 0), (int, float)) and p.get('order', 0) > 0
        ]
        next_page_order = (max(existing_order_values) if existing_order_values else 0) + 1000

        pages = []
        all_page_ids = list(existing_pages_map.keys())
        for pgid in proj_pages_scanned.keys():
            if pgid not in all_page_ids:
                all_page_ids.append(pgid)

        for pgid in all_page_ids:
            versions = proj_pages_scanned.get(pgid, [])
            if pgid not in proj_pages_scanned:
                # If page exists in JSON but not scanned, preserve it if soft-deleted
                page_in_json = existing_pages_map.get(pgid, {})
                if page_in_json.get('deleted'):
                    pages.append(normalize_page_meta(page_in_json, page_in_json.get('versions', []) or []))
                continue

            if pgid in existing_pages_map:
                page = normalize_page_meta(existing_pages_map[pgid], versions)
                if not isinstance(page.get('order'), (int, float)) or page.get('order', 0) <= 0:
                    page['order'] = next_page_order
                    next_page_order += 1000
                page['versions'] = versions
                if page.get('activeVersion') not in versions:
                    page['activeVersion'] = versions[0]
            else:
                page = {
                    'id': pgid,
                    'name': pgid,
                    'parentId': None,
                    'order': next_page_order,
                    'targetDevice': 'mobile',
                    'versions': versions,
                    'activeVersion': versions[0],
                    'deleted': False,
                    'deletedAt': None,
                    'versionStates': {
                        version: {
                            'deleted': False,
                            'deletedAt': None
                        }
                        for version in versions
                    }
                }
                next_page_order += 1000
            pages.append(page)

        proj['pages'] = pages
        projects.append(proj)

    active_project_id = existing.get('activeProjectId', '')
    proj_ids = {p['id'] for p in projects if not p.get('deleted')}
    if active_project_id not in proj_ids:
        active_project_id = next((p['id'] for p in projects if not p.get('deleted')), '')
        if not active_project_id and projects:
            active_project_id = projects[0]['id']

    active_page_id = existing.get('activePageId', '')
    active_proj_obj = next((p for p in projects if p['id'] == active_project_id), None)
    if active_proj_obj:
        page_ids = {p['id'] for p in active_proj_obj['pages'] if not p.get('deleted')}
        if active_page_id not in page_ids:
            active_page_id = next((p['id'] for p in active_proj_obj['pages'] if not p.get('deleted')), '')
            if not active_page_id and active_proj_obj['pages']:
                active_page_id = active_proj_obj['pages'][0]['id']
    else:
        active_page_id = ''

    data = {
        'projects': projects,
        'activeProjectId': active_project_id,
        'activePageId': active_page_id
    }

    # Write projects.json
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # External workspaces must never modify installed application code.
    if Path(root).resolve() != workspace.APP_ROOT:
        workspace.write_metadata_snapshot(Path(root), data)
        return data

    # Update portal/shell.js getDefaultData()
    shell_path = os.path.join(root, 'portal', 'shell.js')
    if os.path.isfile(shell_path):
        with open(shell_path, 'r', encoding='utf-8') as f:
            content = f.read()

        start_tag = '/* __READIFY_DATA_START__ */'
        end_tag = '/* __READIFY_DATA_END__ */'
        start_idx = content.find(start_tag)
        end_idx = content.find(end_tag)

        if start_idx != -1 and end_idx != -1:
            new_value = build_default_data_js(data)
            content = content[:start_idx + len(start_tag)] + new_value + ' ' + content[end_idx:]
            with open(shell_path, 'w', encoding='utf-8') as f:
                f.write(content)

    return data


def slugify_share_part(value):
    text = str(value or '').strip().lower()
    text = re.sub(r'[^a-z0-9_-]+', '-', text)
    text = re.sub(r'-{2,}', '-', text).strip('-')
    return text or 'page'


def build_page_zip_bytes(root, project_id, page_id, version):
    """Zip a page version dir (plus its docs dir) and return the bytes.

    Mirrors what /api/agent/page/download-zip serves, so a static share can ship
    a pre-built zip next to its HTML and let visitors download it without the
    backend tunnel (prota.*) being up.
    """
    import io
    import zipfile
    segments = [project_id, page_id, version]
    if not all(isinstance(value, str) and re.fullmatch(r'[a-zA-Z0-9_-]+', value) for value in segments):
        raise ValueError('Invalid projectId/pageId/version format')
    page_dir = Path(root) / 'src/pages' / project_id / page_id
    if not (page_dir / version).is_dir():
        raise FileNotFoundError('Version directory not found')
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for folder in [page_dir / version, page_dir / 'docs']:
            if not folder.is_dir():
                continue
            for file in folder.rglob('*'):
                relative = file.relative_to(page_dir)
                if file.is_symlink():
                    raise ValueError('下载资源不能包含符号链接。')
                if file.is_file() and not any(part.startswith('.') or part in {'node_modules', '__pycache__'} for part in relative.parts):
                    archive.write(file, relative.as_posix())
    return buffer.getvalue()


def _safe_order(value):
    try:
        num = float(value)
        if num != num or num in (float('inf'), float('-inf')):
            return 0
        return int(num)
    except (TypeError, ValueError):
        return 0


def read_project_page(root, project_id, page_id):
    json_path = os.path.join(root, 'data', 'projects.json')
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        data = {'projects': []}
    proj = next((item for item in data.get('projects', []) if item.get('id') == project_id), None)
    if not proj:
        return None
    return next((item for item in proj.get('pages', []) if item.get('id') == page_id), None)


def read_project_record(root, project_id):
    json_path = os.path.join(root, 'data', 'projects.json')
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        data = {'projects': []}
    return next((item for item in data.get('projects', []) if item.get('id') == project_id), None)


def resolve_share_version_dir(root, project_id, page_id, version):
    if not re.match(r'^[A-Za-z0-9_-]+$', project_id or ''):
        raise ValueError('Invalid projectId')
    if not re.match(r'^[A-Za-z0-9_-]+$', page_id or ''):
        raise ValueError('Invalid pageId')
    if not re.match(r'^v\d+$', version or ''):
        raise ValueError('Invalid version')

    pages_root = os.path.normpath(os.path.join(root, 'src', 'pages'))
    version_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, version))
    if not version_dir.startswith(pages_root + os.sep):
        raise ValueError('Invalid page path')
    if not os.path.isfile(os.path.join(version_dir, 'index.html')):
        raise ValueError('Demo index.html not found')
    return version_dir


def read_share_prd(root, project_id, page_id, version, requested_path=''):
    documents = list_prd_documents(root, project_id, page_id, version)
    candidates = []
    if requested_path:
        try:
            document_path, filename = resolve_prd_document_path(root, project_id, page_id, version, requested_path)
            candidates.append((document_path, filename))
        except ValueError:
            pass
    for document in documents:
        try:
            document_path, filename = resolve_prd_document_path(root, project_id, page_id, version, document.get('path') or '')
            candidates.append((document_path, filename))
        except ValueError:
            continue
    try:
        document_path, filename = resolve_prd_document_path(root, project_id, page_id, version, 'product-doc.md')
        candidates.append((document_path, filename))
    except ValueError:
        pass

    seen = set()
    for document_path, filename in candidates:
        if document_path in seen:
            continue
        seen.add(document_path)
        if not os.path.isfile(document_path):
            continue
        try:
            with open(document_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Determine correct relative path for the client
            rel_path = os.path.relpath(document_path, root).replace('\\', '/')

            return {
                'content': content,
                'filename': filename,
                'path': rel_path
            }
        except Exception:
            continue

    return {
        'content': '',
        'filename': '',
        'path': ''
    }


def resolve_drawio_diagrams_dir(root, project_id, page_id, version):
    if not re.match(r'^[A-Za-z0-9_-]+$', project_id or ''):
        raise ValueError('Invalid projectId')
    if not re.match(r'^[A-Za-z0-9_-]+$', page_id or ''):
        raise ValueError('Invalid pageId')
    if not re.match(r'^v\d+$', version or ''):
        raise ValueError('Invalid version')

    pages_root = os.path.normpath(os.path.join(root, 'src', 'pages'))
    version_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, version))
    if not version_dir.startswith(pages_root + os.sep) or not os.path.isdir(version_dir):
        raise ValueError('Version directory not found')

    diagrams_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, 'docs', 'diagrams'))
    return diagrams_dir


def resolve_drawio_diagram_path(root, project_id, page_id, version, requested_path=''):
    diagrams_dir = resolve_drawio_diagrams_dir(root, project_id, page_id, version)
    raw_path = urllib.parse.unquote(str(requested_path or ''))
    filename = os.path.basename(raw_path).strip() or f'{version}.drawio'
    if not filename.lower().endswith('.drawio'):
        raise ValueError('Only .drawio files are supported')
    diagram_path = os.path.normpath(os.path.join(diagrams_dir, filename))
    if not diagram_path.startswith(diagrams_dir + os.sep):
        raise ValueError('Invalid diagram path')
    return diagrams_dir, diagram_path, filename


def list_drawio_diagrams(root, project_id, page_id, version, include_content=False):
    diagrams_dir = resolve_drawio_diagrams_dir(root, project_id, page_id, version)
    if not os.path.isdir(diagrams_dir):
        return []

    diagrams = []
    for filename in os.listdir(diagrams_dir):
        if not filename.lower().endswith('.drawio'):
            continue
        diagram_path = os.path.normpath(os.path.join(diagrams_dir, filename))
        if not diagram_path.startswith(diagrams_dir + os.sep) or not os.path.isfile(diagram_path):
            continue
        stat = os.stat(diagram_path)
        item = {
            'path': f'/{os.path.relpath(diagram_path, root).replace(chr(92), "/")}',
            'filename': filename,
            'label': os.path.splitext(filename)[0],
            'updatedAt': datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            'updatedAtMs': stat.st_mtime * 1000,
            'size': stat.st_size
        }
        if include_content:
            with open(diagram_path, 'r', encoding='utf-8') as f:
                item['content'] = f.read()
        diagrams.append(item)

    diagrams.sort(key=lambda item: (
        0 if item['filename'] == f'{version}.drawio' else 1,
        0 if item['filename'].startswith(f'{version}-') else 1,
        -(item.get('updatedAtMs') or 0),
        item['filename']
    ))
    return diagrams


def read_share_drawio(root, project_id, page_id, version, requested_path=''):
    diagrams = list_drawio_diagrams(root, project_id, page_id, version, include_content=True)
    selected = next((item for item in diagrams if item['path'].lstrip('/') == str(requested_path or '').lstrip('/')), None)
    selected = selected or (diagrams[0] if diagrams else None)
    return {
        'content': selected.get('content') if selected else '',
        'path': selected.get('path') if selected else '',
        'filename': selected.get('filename') if selected else '',
        'diagrams': diagrams
    }


def resolve_mindmaps_dir(root, project_id, page_id, version):
    # Validation mirrors resolve_drawio_diagrams_dir so mindmap docs live under
    # the same trusted page tree, just in a sibling `docs/mindmaps/` directory.
    if not re.match(r'^[A-Za-z0-9_-]+$', project_id or ''):
        raise ValueError('Invalid projectId')
    if not re.match(r'^[A-Za-z0-9_-]+$', page_id or ''):
        raise ValueError('Invalid pageId')
    if not re.match(r'^v\d+$', version or ''):
        raise ValueError('Invalid version')

    pages_root = os.path.normpath(os.path.join(root, 'src', 'pages'))
    version_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, version))
    if not version_dir.startswith(pages_root + os.sep) or not os.path.isdir(version_dir):
        raise ValueError('Version directory not found')

    mindmaps_dir = os.path.normpath(os.path.join(pages_root, project_id, page_id, 'docs', 'mindmaps'))
    return mindmaps_dir


def resolve_mindmap_path(root, project_id, page_id, version, requested_path=''):
    mindmaps_dir = resolve_mindmaps_dir(root, project_id, page_id, version)
    raw_path = urllib.parse.unquote(str(requested_path or ''))
    filename = os.path.basename(raw_path).strip() or f'{version}.mindmap'
    if not filename.lower().endswith('.mindmap'):
        raise ValueError('Only .mindmap files are supported')
    mindmap_path = os.path.normpath(os.path.join(mindmaps_dir, filename))
    if not mindmap_path.startswith(mindmaps_dir + os.sep):
        raise ValueError('Invalid mindmap path')
    return mindmaps_dir, mindmap_path, filename


def list_mindmaps(root, project_id, page_id, version, include_content=False):
    mindmaps_dir = resolve_mindmaps_dir(root, project_id, page_id, version)
    if not os.path.isdir(mindmaps_dir):
        return []

    mindmaps = []
    for filename in os.listdir(mindmaps_dir):
        if not filename.lower().endswith('.mindmap'):
            continue
        mindmap_path = os.path.normpath(os.path.join(mindmaps_dir, filename))
        if not mindmap_path.startswith(mindmaps_dir + os.sep) or not os.path.isfile(mindmap_path):
            continue
        stat = os.stat(mindmap_path)
        item = {
            'path': f'/{os.path.relpath(mindmap_path, root).replace(chr(92), "/")}',
            'filename': filename,
            'label': os.path.splitext(filename)[0],
            'updatedAt': datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            'updatedAtMs': stat.st_mtime * 1000,
            'size': stat.st_size
        }
        if include_content:
            with open(mindmap_path, 'r', encoding='utf-8') as f:
                item['content'] = f.read()
        mindmaps.append(item)

    mindmaps.sort(key=lambda item: (
        0 if item['filename'] == f'{version}.mindmap' else 1,
        0 if item['filename'].startswith(f'{version}-') else 1,
        -(item.get('updatedAtMs') or 0),
        item['filename']
    ))
    return mindmaps


def read_share_mindmap(root, project_id, page_id, version, requested_path=''):
    mindmaps = list_mindmaps(root, project_id, page_id, version, include_content=True)
    selected = next((item for item in mindmaps if item['path'].lstrip('/') == str(requested_path or '').lstrip('/')), None)
    selected = selected or (mindmaps[0] if mindmaps else None)
    return {
        'content': selected.get('content') if selected else '',
        'path': selected.get('path') if selected else '',
        'filename': selected.get('filename') if selected else '',
        'mindmaps': mindmaps
    }



def read_share_annotations(version_dir):
    ann_path = os.path.join(version_dir, 'annotations.json')
    if os.path.isfile(ann_path):
        try:
            with open(ann_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return []


def _add_html_class_to_tag(tag, class_name):
    class_attr = re.search(r'\sclass=(["\'])(.*?)\1', tag, flags=re.I | re.S)
    if class_attr:
        classes = class_attr.group(2).split()
        if class_name not in classes:
            classes.append(class_name)
        next_class_attr = f' class={class_attr.group(1)}{" ".join(classes)}{class_attr.group(1)}'
        return tag[:class_attr.start()] + next_class_attr + tag[class_attr.end():]
    return tag[:-1] + f' class="{class_name}">'


def build_share_page_html(share_data):
    root = get_application_root()
    index_path = os.path.join(root, 'portal', 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()

    share_data = {
        **share_data,
        'enabled': True
    }
    data_json = json.dumps(share_data, ensure_ascii=False).replace('</', '<\\/')
    title = f'{share_data.get("pageName") or share_data.get("pageId") or "Prota"} {str(share_data.get("version") or "").upper()} · Prota Share'.strip()
    share_script = f'<script>window.__READIFY_SHARE__ = {data_json};</script>'
    html = html.replace('<script src="/workspace-data.js"></script>', '')
    html = html.replace('href="modules/settings/', 'href="/portal/modules/settings/')
    html = html.replace('href="modules/sharing/', 'href="/portal/modules/sharing/')

    share_styles = '''
  <style>
    body.is-share-mode {
      background: #fff;
    }
    body.is-share-mode .sidebar,
    body.is-share-mode .agent-workbench,
    body.is-share-mode #topTabs,
    body.is-share-mode #backToProjectsBtn,
    body.is-share-mode .version-selector-wrap,
    body.is-share-mode .version-row__actions,
    body.is-share-mode .version-panel__footer,
    body.is-share-mode #prdAiBtn,
    body.is-share-mode #prdEditBtn,
    body.is-share-mode #prdSaveBtn,
    body.is-share-mode #prdCancelEditBtn,
    body.is-share-mode .prd-dropdown-item__actions,
    body.is-share-mode .prd-dropdown-footer {
      display: none !important;
    }
    body.is-share-mode .main-content {
      width: 100vw;
      flex: 1 1 auto;
    }
    body.is-share-mode .content-header {
      padding: 0 24px;
    }
    body.is-share-mode:not(.is-share-mode--multi-page) .page-selector-wrapper {
      display: none !important;
    }
  </style>
'''
    head_injection = f'<head>\n  {share_script}\n{share_styles}  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n  <meta http-equiv="Pragma" content="no-cache">\n  <meta http-equiv="Expires" content="0">'
    html = re.sub(r'<head>', lambda _: head_injection, html, count=1, flags=re.I)
    html = re.sub(r'\s*<base\s+href="[^"]*">\s*', '\n', html, count=1)
    html = re.sub(
        r'<body\b([^>]*)>',
        lambda match: _add_html_class_to_tag(match.group(0), 'is-share-mode'),
        html,
        count=1,
        flags=re.I
    )
    html = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html, count=1, flags=re.S)
    # Share pages are served from /shares/. Use root-absolute URLs so the
    # portal shell, public domain, and iframe demo paths resolve identically.
    html = re.sub(r'href="shell\.css(\?[^"]*)?"', 'href="/portal/shell.css\\1"', html)
    # Use regex (mirroring shell.css) so a cache-buster query string like
    # prd.css?v=20260701-mindmap-xmind is preserved through the rewrite. A plain
    # exact-string replace silently misses the query-suffixed href, leaving a
    # relative path that 404s under /shares/ and renders the PRD unstyled.
    html = re.sub(r'href="modules/prd/prd\.css(\?[^"]*)?"', 'href="/portal/modules/prd/prd.css\\1"', html)
    html = html.replace('src="agent/', 'src="/portal/agent/')

    # Rewrite shell.js path using regex to support version query parameters.
    pattern = r'(\s*)<script\s+([^>]*\s+)?src="shell\.js(\?[^"]*)?"([^>]*)></script>'
    def repl(match):
        indent = match.group(1)
        attrs_before = match.group(2) or ''
        query = match.group(3) or ''
        attrs_after = match.group(4) or ''
        return f'{indent}<script {attrs_before}src="/portal/shell.js{query}"{attrs_after}></script>'
    html, _ = re.subn(pattern, repl, html, count=1)

    return html

    data_json = json.dumps(share_data, ensure_ascii=False).replace('</', '<\\/')
    template = r'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>__SHARE_TITLE__</title>
  <style>
    :root {
      --bg: #f4f6f8;
      --surface: #ffffff;
      --surface-soft: #f8fafc;
      --text: #111827;
      --muted: #64748b;
      --line: #dfe5ec;
      --brand: #2563eb;
      --brand-soft: rgba(37, 99, 235, 0.1);
      --success: #0f9f6e;
      --shadow: 0 20px 60px rgba(15, 23, 42, 0.14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      height: 100vh;
      overflow: hidden;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    button, select { font: inherit; }
    .share-shell {
      display: grid;
      grid-template-rows: 64px 1fr;
      height: 100vh;
      min-width: 0;
    }
    .share-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(16px);
      z-index: 10;
    }
    .share-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .share-title__mark {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: linear-gradient(135deg, #2563eb, #0f9f6e);
      font-weight: 750;
      flex: 0 0 auto;
    }
    .share-title h1 {
      margin: 0;
      font-size: 15px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .share-title p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 12px;
    }
    .share-header__actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 0 0 auto;
    }
    .share-pill,
    .share-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid var(--line);
      color: var(--muted);
      background: var(--surface);
      text-decoration: none;
      font-size: 12px;
      font-weight: 650;
    }
    .share-link { color: var(--brand); }
    .share-main {
      display: grid;
      grid-template-columns: minmax(420px, 1fr) 420px;
      min-height: 0;
      padding: 18px;
      gap: 18px;
    }
    .share-main.is-demo-only {
      grid-template-columns: 1fr;
    }
    .demo-pane,
    .doc-pane {
      min-height: 0;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .demo-pane {
      display: grid;
      grid-template-rows: 44px 1fr;
    }
    .pane-toolbar {
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      border-bottom: 1px solid var(--line);
      background: var(--surface-soft);
    }
    .pane-toolbar strong {
      font-size: 13px;
      font-weight: 720;
    }
    .pane-toolbar span {
      color: var(--muted);
      font-size: 12px;
    }
    .icon-button {
      width: 30px;
      height: 30px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      color: var(--muted);
      cursor: pointer;
    }
    .iframe-wrap {
      position: relative;
      min-height: 0;
      background: #eef1f5;
    }
    #demoFrame {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: #fff;
    }
    .annotation-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .annotation-ring {
      position: absolute;
      border: 2px solid var(--brand);
      border-radius: 12px;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.03), 0 0 0 5px rgba(37, 99, 235, 0.12);
      opacity: 0;
      transform: scale(0.98);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .annotation-ring.is-visible {
      opacity: 1;
      transform: scale(1);
    }
    .annotation-badge {
      position: absolute;
      min-width: 24px;
      height: 22px;
      padding: 0 7px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: var(--brand);
      font-size: 11px;
      font-weight: 760;
      box-shadow: 0 8px 18px rgba(37, 99, 235, 0.28);
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .annotation-badge.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .doc-pane {
      display: grid;
      grid-template-rows: auto 1fr;
    }
    .doc-tabs {
      display: flex;
      gap: 6px;
      padding: 10px;
      border-bottom: 1px solid var(--line);
      background: var(--surface-soft);
    }
    .doc-tab {
      flex: 1;
      min-height: 34px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
    }
    .doc-tab.is-active {
      color: var(--brand);
      border-color: rgba(37, 99, 235, 0.18);
      background: var(--brand-soft);
    }
    .doc-body {
      min-height: 0;
      overflow: auto;
      padding: 14px;
    }
    .annotation-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .annotation-card {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      text-align: left;
      cursor: pointer;
      transition: border-color 0.14s ease, box-shadow 0.14s ease, transform 0.14s ease;
    }
    .annotation-card:hover,
    .annotation-card.is-active {
      border-color: rgba(37, 99, 235, 0.42);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }
    .annotation-card.is-active {
      transform: translateY(-1px);
    }
    .annotation-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .annotation-card__number {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--brand-soft);
      color: var(--brand);
      font-size: 12px;
      font-weight: 760;
    }
    .annotation-card__target {
      color: var(--muted);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .annotation-card p {
      margin: 0;
      color: var(--text);
      font-size: 13px;
      line-height: 1.55;
    }
    .empty {
      min-height: 180px;
      display: grid;
      place-items: center;
      color: var(--muted);
      text-align: center;
      padding: 24px;
      line-height: 1.6;
    }
    .prd-document {
      font-size: 14px;
      line-height: 1.72;
      color: #1f2937;
    }
    .prd-document h1,
    .prd-document h2,
    .prd-document h3,
    .prd-document h4 {
      color: #111827;
      line-height: 1.28;
      margin: 1.2em 0 0.55em;
    }
    .prd-document h1 { font-size: 24px; margin-top: 0; }
    .prd-document h2 { font-size: 19px; padding-top: 8px; border-top: 1px solid var(--line); }
    .prd-document h3 { font-size: 16px; }
    .prd-document p { margin: 0 0 0.9em; }
    .prd-document ul,
    .prd-document ol { padding-left: 1.35em; margin: 0 0 0.9em; }
    .prd-document li { margin: 0.28em 0; }
    .prd-document .prd-task-list-item {
      display: flex;
      align-items: center;
      gap: 8px;
      list-style: none;
    }
    .prd-document .prd-task-list-item__checkbox {
      width: 16px;
      height: 16px;
      margin: 0;
      flex: 0 0 16px;
      accent-color: var(--success);
      opacity: 1;
    }
    .prd-document blockquote {
      margin: 0 0 1em;
      padding: 10px 12px;
      border-left: 3px solid var(--success);
      background: rgba(15, 159, 110, 0.08);
      color: #334155;
      border-radius: 8px;
    }
    .prd-document code {
      padding: 0.1em 0.35em;
      border-radius: 5px;
      background: #eef2f7;
      color: #0f172a;
    }
    .prd-document pre {
      overflow: auto;
      padding: 12px;
      border-radius: 10px;
      background: #111827;
      color: #e5e7eb;
    }
    .prd-document pre code {
      padding: 0;
      color: inherit;
      background: transparent;
    }
    .prd-document img {
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      border: 1px solid var(--line);
    }
    .prd-table-wrap {
      overflow: auto;
      margin: 0 0 1em;
      border: 1px solid var(--line);
      border-radius: 10px;
    }
    .prd-document table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .prd-document th,
    .prd-document td {
      border-bottom: 1px solid var(--line);
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
    }
    .prd-document th {
      background: var(--surface-soft);
      font-weight: 720;
    }
    @media (max-width: 980px) {
      body { overflow: auto; height: auto; min-height: 100vh; }
      .share-shell { min-height: 100vh; height: auto; grid-template-rows: auto 1fr; }
      .share-header { align-items: flex-start; flex-direction: column; padding: 14px 16px; gap: 12px; }
      .share-header__actions { width: 100%; flex-wrap: wrap; }
      .share-main { grid-template-columns: 1fr; padding: 12px; }
      .demo-pane { height: 72vh; min-height: 620px; }
      .doc-pane { min-height: 480px; }
    }
  </style>
</head>
<body>
  <div class="share-shell">
    <header class="share-header">
      <div class="share-title">
        <span class="share-title__mark">R</span>
        <div>
          <h1 id="shareTitle">Readify 分享页</h1>
          <p id="shareMeta"></p>
        </div>
      </div>
      <div class="share-header__actions">
        <span id="shareModePill" class="share-pill"></span>
        <a id="rawDemoLink" class="share-link" target="_blank" rel="noopener noreferrer">打开 Demo HTML</a>
      </div>
    </header>
    <main id="shareMain" class="share-main">
      <section class="demo-pane" aria-label="Demo">
        <div class="pane-toolbar">
          <strong>Demo</strong>
          <span id="demoPathLabel"></span>
          <button id="reloadFrame" class="icon-button" type="button" title="重新加载">↻</button>
        </div>
        <div class="iframe-wrap">
          <iframe id="demoFrame" title="Readify Demo"></iframe>
          <div id="annotationOverlay" class="annotation-overlay" aria-hidden="true"></div>
        </div>
      </section>
      <aside id="docPane" class="doc-pane" aria-label="文档">
        <div id="docTabs" class="doc-tabs"></div>
        <div id="docBody" class="doc-body"></div>
      </aside>
    </main>
  </div>
  <script id="shareData" type="application/json">__SHARE_DATA__</script>
  <script>
    const shareData = JSON.parse(document.getElementById('shareData').textContent);
    const state = {
      activeTab: '',
      activeAnnotation: -1
    };
    const modeLabels = {
      demo: '仅 Demo',
      annotations: 'Demo + 标注',
      prd: 'Demo + PRD',
      full: 'Demo + 标注 + PRD'
    };
    const includeAnnotations = Boolean(shareData.includeAnnotations);
    const includePrd = Boolean(shareData.includePrd);
    const availableTabs = [
      includeAnnotations ? 'annotations' : '',
      includePrd ? 'prd' : ''
    ].filter(Boolean);

    const demoFrame = document.getElementById('demoFrame');
    const annotationOverlay = document.getElementById('annotationOverlay');
    const docPane = document.getElementById('docPane');
    const docTabs = document.getElementById('docTabs');
    const docBody = document.getElementById('docBody');
    const shareMain = document.getElementById('shareMain');

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getDisplayTime(value) {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('zh-CN', { hour12: false });
    }

    function normalizePath(path) {
      const parts = [];
      String(path || '').split('/').forEach((part) => {
        if (!part || part === '.') return;
        if (part === '..') {
          if (parts.length && parts[parts.length - 1] !== '..') {
            parts.pop();
          } else {
            parts.push('..');
          }
          return;
        }
        parts.push(part);
      });
      return parts.join('/');
    }

    function resolveMarkdownUrl(rawUrl = '') {
      const url = String(rawUrl || '').trim().replace(/^<|>$/g, '');
      if (!url || /^(javascript|vbscript):/i.test(url)) return '#';
      if (/^(https?:|data:image\/|blob:|mailto:|tel:|#|\/)/i.test(url)) return url;
      const basePath = shareData.prdPath || '';
      const baseDir = basePath.split('/').slice(0, -1).join('/');
      return normalizePath(`${baseDir}/${url}`);
    }

    function formatMarkdownInline(text) {
      let html = escapeHtml(text);
      const codeSpans = [];
      html = html.replace(/`([^`]+)`/g, (_, code) => {
        const index = codeSpans.push(`<code>${escapeHtml(code)}</code>`) - 1;
        return `@@READIFY_CODE_${index}@@`;
      });
      html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, (_, alt, url) => {
        const src = resolveMarkdownUrl(url);
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
      });
      html = html.replace(/(^|[^!])\[([^\]]+)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, (_, prefix, label, url) => {
        const href = resolveMarkdownUrl(url);
        return `${prefix}<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
      });
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      html = html.replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>');
      html = html.replace(/@@READIFY_CODE_(\d+)@@/g, (_, index) => codeSpans[Number(index)] || '');
      return html;
    }

    function isMarkdownTableRow(line) {
      const trimmed = String(line || '').trim();
      return trimmed.includes('|') && trimmed.replace(/\|/g, '').trim().length > 0;
    }

    function isMarkdownTableDivider(line) {
      return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ''));
    }

    function parseMarkdownTableRow(line) {
      return String(line || '')
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());
    }

    function renderMarkdownTable(headers, rows) {
      const head = headers.map((cell) => `<th>${formatMarkdownInline(cell)}</th>`).join('');
      const body = rows.map((row) => `<tr>${headers.map((_, index) => `<td>${formatMarkdownInline(row[index] || '')}</td>`).join('')}</tr>`).join('');
      return `<div class="prd-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function renderMarkdown(markdown) {
      const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
      const html = [];
      let paragraph = [];
      let list = null;
      let codeLines = null;

      const flushParagraph = () => {
        if (!paragraph.length) return;
        html.push(`<p>${paragraph.map((line) => formatMarkdownInline(line)).join('<br>')}</p>`);
        paragraph = [];
      };
      const flushList = () => {
        if (!list) return;
        const tag = list.type === 'ordered' ? 'ol' : 'ul';
        html.push(`<${tag}>${list.items.map((item) => {
          const taskClass = item.taskState ? ' class="prd-task-list-item"' : '';
          const checkbox = item.taskState
            ? `<input class="prd-task-list-item__checkbox" type="checkbox" disabled${item.taskState.checked ? ' checked' : ''} aria-label="${item.taskState.checked ? '已完成' : '未完成'}">`
            : '';
          return `<li${taskClass}>${checkbox}${formatMarkdownInline(item.text)}</li>`;
        }).join('')}</${tag}>`);
        list = null;
      };
      const flushCode = () => {
        if (!codeLines) return;
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = null;
      };
      const pushListItem = (type, text, taskState = null) => {
        flushParagraph();
        if (!list || list.type !== type) {
          flushList();
          list = { type, items: [] };
        }
        list.items.push({ text, taskState });
      };

      for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index];
        const trimmed = rawLine.trim();
        if (codeLines) {
          if (trimmed.startsWith('```')) flushCode();
          else codeLines.push(rawLine);
          continue;
        }
        if (trimmed.startsWith('```')) {
          flushParagraph();
          flushList();
          codeLines = [];
          continue;
        }
        if (!trimmed) {
          flushParagraph();
          flushList();
          continue;
        }
        if (/^-{3,}$/.test(trimmed)) {
          flushParagraph();
          flushList();
          html.push('<hr>');
          continue;
        }
        const quoteMatch = /^>\s?(.+)$/.exec(trimmed);
        if (quoteMatch) {
          flushParagraph();
          flushList();
          html.push(`<blockquote>${formatMarkdownInline(quoteMatch[1])}</blockquote>`);
          continue;
        }
        const tableDivider = lines[index + 1] || '';
        if (isMarkdownTableRow(rawLine) && isMarkdownTableDivider(tableDivider)) {
          flushParagraph();
          flushList();
          const headers = parseMarkdownTableRow(rawLine);
          index += 2;
          const rows = [];
          while (index < lines.length && isMarkdownTableRow(lines[index])) {
            rows.push(parseMarkdownTableRow(lines[index]));
            index += 1;
          }
          index -= 1;
          html.push(renderMarkdownTable(headers, rows));
          continue;
        }
        const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (headingMatch) {
          flushParagraph();
          flushList();
          const level = Math.min(headingMatch[1].length, 4);
          html.push(`<h${level}>${formatMarkdownInline(headingMatch[2])}</h${level}>`);
          continue;
        }
        const unorderedMatch = /^\s*[-*+]\s+(.+)$/.exec(rawLine);
        if (unorderedMatch) {
          const taskMatch = /^\[([ xX])\]\s+(.+)$/.exec(unorderedMatch[1]);
          pushListItem(
            'unordered',
            taskMatch ? taskMatch[2] : unorderedMatch[1],
            taskMatch ? { checked: taskMatch[1].toLowerCase() === 'x' } : null
          );
          continue;
        }
        const orderedMatch = /^\s*\d+\.\s+(.+)$/.exec(rawLine);
        if (orderedMatch) {
          pushListItem('ordered', orderedMatch[1]);
          continue;
        }
        paragraph.push(trimmed);
      }
      flushCode();
      flushParagraph();
      flushList();
      return html.join('');
    }

    function renderTabs() {
      if (!availableTabs.length) {
        docPane.hidden = true;
        shareMain.classList.add('is-demo-only');
        return;
      }
      docPane.hidden = false;
      shareMain.classList.remove('is-demo-only');
      if (!state.activeTab || !availableTabs.includes(state.activeTab)) {
        state.activeTab = availableTabs[0];
      }
      docTabs.innerHTML = availableTabs.map((tab) => {
        const label = tab === 'annotations' ? `交互标注 ${shareData.annotations.length || 0}` : 'PRD';
        return `<button class="doc-tab${state.activeTab === tab ? ' is-active' : ''}" type="button" data-tab="${tab}">${escapeHtml(label)}</button>`;
      }).join('');
    }

    function renderAnnotationList() {
      if (!shareData.annotations.length) {
        docBody.innerHTML = '<div class="empty">当前分享页没有交互标注。</div>';
        return;
      }
      docBody.innerHTML = `
        <div class="annotation-list">
          ${shareData.annotations.map((annotation, index) => `
            <button class="annotation-card${state.activeAnnotation === index ? ' is-active' : ''}" type="button" data-annotation-index="${index}">
              <span class="annotation-card__top">
                <span class="annotation-card__number">${index + 1}</span>
                <span class="annotation-card__target">${escapeHtml(annotation.selector || annotation.meta?.textContent || '标注目标')}</span>
              </span>
              <p>${escapeHtml(annotation.description || '未填写说明')}</p>
            </button>
          `).join('')}
        </div>
      `;
    }

    function renderPrd() {
      if (!shareData.prdContent) {
        docBody.innerHTML = '<div class="empty">当前分享页没有可展示的 PRD。</div>';
        return;
      }
      docBody.innerHTML = `<article class="prd-document">${renderMarkdown(shareData.prdContent)}</article>`;
    }

    function renderDocs() {
      renderTabs();
      if (!availableTabs.length) return;
      if (state.activeTab === 'annotations') renderAnnotationList();
      else renderPrd();
    }

    function clearOverlay() {
      annotationOverlay.innerHTML = '';
    }

    function findAnnotationTarget(annotation) {
      const doc = demoFrame.contentDocument;
      if (!doc || !annotation?.selector) return null;
      try {
        return doc.querySelector(annotation.selector);
      } catch {
        return null;
      }
    }

    function showAnnotationTarget(index) {
      const annotation = shareData.annotations[index];
      if (!annotation) return;
      const target = findAnnotationTarget(annotation);
      clearOverlay();
      if (!target) return;
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const frameRect = demoFrame.getBoundingClientRect();
        const wrapRect = annotationOverlay.getBoundingClientRect();
        const left = frameRect.left - wrapRect.left + rect.left;
        const top = frameRect.top - wrapRect.top + rect.top;
        const ring = document.createElement('div');
        ring.className = 'annotation-ring is-visible';
        ring.style.left = `${Math.max(0, left - 4)}px`;
        ring.style.top = `${Math.max(0, top - 4)}px`;
        ring.style.width = `${Math.max(18, rect.width + 8)}px`;
        ring.style.height = `${Math.max(18, rect.height + 8)}px`;
        const badge = document.createElement('div');
        badge.className = 'annotation-badge is-visible';
        badge.textContent = String(index + 1);
        badge.style.left = `${Math.max(6, left + rect.width - 16)}px`;
        badge.style.top = `${Math.max(6, top - 12)}px`;
        annotationOverlay.append(ring, badge);
      }, 260);
    }

    function init() {
      document.getElementById('shareTitle').textContent = `${shareData.pageName || shareData.pageId} · ${String(shareData.version || '').toUpperCase()}`;
      document.getElementById('shareMeta').textContent = `Readify 单页分享 · ${getDisplayTime(shareData.generatedAt)}`;
      document.getElementById('shareModePill').textContent = modeLabels[shareData.mode] || modeLabels.full;
      document.getElementById('demoPathLabel').textContent = `${shareData.pageId}/${shareData.version}`;
      const rawDemoLink = document.getElementById('rawDemoLink');
      rawDemoLink.href = shareData.demoPath;
      demoFrame.src = shareData.demoPath;
      renderDocs();
    }

    docTabs.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]');
      if (!tab) return;
      state.activeTab = tab.dataset.tab;
      renderDocs();
    });

    docBody.addEventListener('click', (event) => {
      const card = event.target.closest('[data-annotation-index]');
      if (!card) return;
      state.activeAnnotation = Number.parseInt(card.dataset.annotationIndex || '0', 10);
      renderDocs();
      showAnnotationTarget(state.activeAnnotation);
    });

    demoFrame.addEventListener('load', () => {
      clearOverlay();
      if (state.activeAnnotation >= 0) {
        showAnnotationTarget(state.activeAnnotation);
      }
    });

    window.addEventListener('resize', () => {
      if (state.activeAnnotation >= 0) {
        showAnnotationTarget(state.activeAnnotation);
      }
    });

    document.getElementById('reloadFrame').addEventListener('click', () => {
      demoFrame.src = shareData.demoPath;
    });

    init();
  </script>
</body>
</html>'''
    return template.replace('__SHARE_TITLE__', title).replace('__SHARE_DATA__', data_json)


import hashlib
_PRODUCT_BUILD = hashlib.sha256(b''.join((workspace.APP_ROOT / file).read_bytes() for file in ['server/bridge.py', 'server/deployer.py', 'server/vercel_setup.py', 'server/share_security.py', 'server/share_gateway.mjs', 'server/share_gate_page.mjs', 'server/share_manager.py'])).hexdigest()


class BridgeHandler(http.server.SimpleHTTPRequestHandler):
    # Ensure UTF-8 charset for text-based files to avoid garbled characters in browsers
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.md': 'text/markdown; charset=UTF-8',
        '.drawio': 'application/vnd.jgraph.mxfile; charset=UTF-8',
        '.html': 'text/html; charset=UTF-8',
        '.js': 'application/javascript; charset=UTF-8',
        '.css': 'text/css; charset=UTF-8',
        '.json': 'application/json; charset=UTF-8',
    })

    def is_local_request(self):
        host = str(self.headers.get('Host', '')).split(':', 1)[0].strip('[]').lower()
        return host in {'localhost', '127.0.0.1', '::1'}

    def workspace_reply(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))

    def workspace_local(self):
        origin = self.headers.get('Origin')
        return self.client_address[0] in {'127.0.0.1', '::1'} and self.is_local_request() and (not origin or urllib.parse.urlparse(origin).netloc == self.headers.get('Host'))

    def translate_path(self, url_path):
        clean = urllib.parse.unquote(urllib.parse.urlsplit(url_path).path).lstrip('/')
        if clean == 'data/template-states.json':
            return str(workspace.CONFIG_DIR / 'template-states.json')
        if clean == 'workspace-data.js':
            return str(workspace.workspace_root() / 'portal/shell.js')
        asset = clean in {'data/projects.json', 'data/projects.snapshot.json'} or any(clean == prefix or clean.startswith(prefix + '/') for prefix in ('src/pages', 'assets', 'shares', 'data/agent-uploads'))
        if asset:
            root = workspace.workspace_root()
            resolved = (root / clean).resolve()
            if resolved != root and root not in resolved.parents:
                return str(workspace.CONFIG_DIR / '__denied__')
            return str(resolved)
        if any(part.startswith('.') for part in Path(clean).parts) or clean.startswith(('server/', 'scripts/', 'tests/', 'logs/')) or (clean.startswith('data/') and clean not in {'data/templates.json', 'data/template-states.json', 'data/agent-provider-presets.json'}):
            return str(workspace.CONFIG_DIR / '__denied__')
        resolved = (workspace.APP_ROOT / clean).resolve()
        return str(resolved) if resolved == workspace.APP_ROOT or workspace.APP_ROOT in resolved.parents else str(workspace.CONFIG_DIR / '__denied__')

    def do_GET(self):
        clean_path = self.path.split('?')[0]
        if clean_path == '/api/product/health':
            import hashlib
            return self.workspace_reply(200, {'product': 'prota', 'installation': hashlib.sha256(str(workspace.APP_ROOT.resolve()).encode()).hexdigest(), 'build': _PRODUCT_BUILD})
        if clean_path == '/api/vercel/status':
            if not self.workspace_local():
                return self.workspace_reply(403, {'error': '只能在本机连接分享账号。'})
            from server import vercel_setup
            return self.workspace_reply(200, vercel_setup.status())
        if clean_path == '/api/vercel/connection':
            if not self.workspace_local():
                return self.workspace_reply(403, {'error': '只能在本机检查分享授权。'})
            from server import vercel_setup
            return self.workspace_reply(200, vercel_setup.inspect_connection())
        if clean_path == '/api/workspace':
            if not self.workspace_local():
                return self.workspace_reply(403, {'error': '只能在运行程序的本机管理存储位置。'})
            return self.workspace_reply(200, workspace.status())
        if workspace.bridge_locked():
            return self.workspace_reply(423, {'error': '工作区正在切换，请等待完成。'})
        if clean_path.startswith(('/src/pages', '/assets', '/shares', '/data/projects.json', '/api/')):
            try:
                workspace.workspace_root()
            except (ValueError, OSError) as error:
                return self.workspace_reply(503, {'error': str(error)})
        if clean_path == '/api/shares':
            if not self.workspace_local():
                return self.workspace_reply(403, {'error': '只能在本机管理分享。'})
            try:
                from server.share_manager import inventory
                return self.workspace_reply(200, {'items': inventory(get_project_root(), self.headers.get('Host', 'localhost:8080'))})
            except Exception as error:
                return self.workspace_reply(400, {'error': str(error)})
        if clean_path == '/api/prd-docs':
            self.handle_prd_docs()
            return
        if clean_path == '/api/drawio-diagram':
            self.handle_drawio_diagram_get()
            return
        if clean_path == '/api/mindmap-diagram':
            self.handle_mindmap_diagram_get()
            return
        if clean_path == '/api/prd-active-context':
            self.handle_prd_active_context_get()
            return

        if clean_path == '/api/agent/page/download-zip':
            self.handle_download_zip()
            return

        if clean_path == '/api/settings':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            settings = load_settings()
            settings['sharingConfigured'] = sharing_configured(settings)
            self.wfile.write(json.dumps(settings).encode('utf-8'))
            return

        if clean_path == '/api/agent-provider-config':
            if not self.is_local_request():
                self.send_response(403)
                self.end_headers()
                return
            config = load_agent_provider_config()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'exists': config is not None,
                'config': config
            }, ensure_ascii=False).encode('utf-8'))
            return
            
        # Redirect root and index.html to portal/
        if clean_path in ('/', '/index.html'):
            self.send_response(302)
            self.send_header('Location', '/portal/index.html')
            self.end_headers()
            return
            
        # Legacy support for shell.js and shell.css at root
        if clean_path in ('/shell.js', '/shell.css'):
            self.send_response(302)
            self.send_header('Location', f'/portal{clean_path}')
            self.end_headers()
            return

        # Auto-sync before serving projects.json so the data always reflects actual folders
        if clean_path == '/data/projects.json':
            sync_projects()
        super().do_GET()

    def do_POST(self):
        clean_path = self.path.split('?')[0]
        if clean_path in {'/api/canvas/save', '/api/canvas/upgrade'}:
            if not self.workspace_local() or not self.headers.get('Content-Type', '').startswith('application/json'):
                return self.workspace_reply(403, {'error': '只能在本机保存画布。'})
            if workspace.bridge_locked():
                return self.workspace_reply(423, {'error': '工作区正在切换。'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length <= 0 or length > 24 * 1024 * 1024:
                    return self.workspace_reply(413, {'error': '画布数据过大，请减少图片或使用本版本 assets 文件。'})
                from server.canvas_store import save_canvas, upgrade_runtime
                if clean_path == '/api/canvas/upgrade':
                    return self.workspace_reply(200, upgrade_runtime(workspace.workspace_root(), json.loads(self.rfile.read(length)), Path(get_application_root()) / 'src/templates/infinite-canvas'))
                code, result = save_canvas(workspace.workspace_root(), json.loads(self.rfile.read(length)))
                return self.workspace_reply(code, result)
            except (ValueError, OSError, TypeError) as error:
                return self.workspace_reply(400, {'error': str(error)})
        if clean_path.startswith('/api/vercel/'):
            if not self.workspace_local() or not self.headers.get('Content-Type', '').startswith('application/json'):
                return self.workspace_reply(403, {'error': '只能在本机产品界面管理分享账号。'})
            try:
                if workspace.bridge_locked():
                    raise ValueError('请等待工作区切换完成后再连接。')
                length = int(self.headers.get('Content-Length', '0'))
                if length < 0 or length > 4096:
                    return self.workspace_reply(413, {'error': '请求过大。'})
                params = json.loads(self.rfile.read(length) or b'{}')
                from server import vercel_setup
                if clean_path == '/api/vercel/connect':
                    return self.workspace_reply(202, vercel_setup.start(params.get('domain', '')))
                if clean_path == '/api/vercel/cancel':
                    return self.workspace_reply(200, vercel_setup.cancel())
                return self.workspace_reply(404, {'error': '未知操作。'})
            except Exception as error:
                return self.workspace_reply(400, {'error': str(error)})
        if clean_path.startswith('/api/workspace/'):
            if not self.workspace_local():
                return self.workspace_reply(403, {'error': '只能在运行程序的本机管理存储位置。'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length > 16384:
                    return self.workspace_reply(413, {'error': '请求过大。'})
                params = json.loads(self.rfile.read(length) or b'{}')
                if clean_path == '/api/workspace/choose':
                    return self.workspace_reply(200, {'path': workspace.native_directory()})
                if clean_path == '/api/workspace/plan':
                    return self.workspace_reply(200, workspace.plan(params.get('path'), params.get('mode')))
                if clean_path == '/api/workspace/change':
                    return self.workspace_reply(202, workspace.start(params.get('path'), params.get('mode'), params.get('source')))
                if clean_path == '/api/workspace/keep':
                    if workspace.bridge_locked():
                        raise ValueError('工作区正在切换，请等待完成。')
                    workspace.atomic_json(workspace.CONFIG_PATH, {'path': str(workspace.workspace_root())})
                    return self.workspace_reply(200, workspace.status())
                return self.workspace_reply(404, {'error': '未知操作。'})
            except Exception as error:
                return self.workspace_reply(400, {'error': str(error)})
        if workspace.bridge_locked():
            return self.workspace_reply(423, {'error': '工作区正在切换，请等待完成。'})
        try:
            workspace.workspace_root()
        except (ValueError, OSError) as error:
            return self.workspace_reply(503, {'error': str(error)})
        if clean_path == '/api/shares/manage':
            if not self.workspace_local() or not self.headers.get('Content-Type', '').startswith('application/json'):
                return self.workspace_reply(403, {'error': '只能在本机产品界面管理分享。'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 32768:
                    raise ValueError('请求大小无效。')
                from server.share_manager import manage
                params = json.loads(self.rfile.read(length))
                if not isinstance(params, dict):
                    raise ValueError('请求格式无效。')
                return self.workspace_reply(200, manage(get_project_root(), params, self.headers.get('Host', 'localhost:8080')))
            except Exception as error:
                return self.workspace_reply(400, {'error': str(error)})
        if self.path.startswith('/api/iterate'):
            self.handle_iterate()
        elif self.path.startswith('/api/create-project'):
            self.handle_create_project()
        elif self.path.startswith('/api/delete-project'):
            self.handle_delete_project()
        elif self.path.startswith('/api/force-delete-project'):
            self.handle_force_delete_project()
        elif self.path.startswith('/api/restore-project'):
            self.handle_restore_project()
        elif self.path.startswith('/api/rename-project-id'):
            self.handle_rename_project_id()
        elif self.path.startswith('/api/rename-project'):
            self.handle_rename_project()
        elif self.path.startswith('/api/restore-page'):
            self.handle_restore_page()
        elif self.path.startswith('/api/delete-page'):
            self.handle_delete_page()
        elif self.path.startswith('/api/force-delete-page'):
            self.handle_force_delete_page()
        elif self.path.startswith('/api/rename-page'):
            self.handle_rename_page()
        elif self.path.startswith('/api/page-structure'):
            self.handle_page_structure()
        elif self.path.startswith('/api/delete'):
            self.handle_delete()
        elif self.path.startswith('/api/annotations'):
            self.handle_annotations()
        elif self.path.split('?')[0] == '/api/copy-edits':
            self.handle_copy_edits()
        elif self.path.split('?')[0] == '/api/bind-jump':
            self.handle_bind_jump()
        elif self.path.split('?')[0] == '/api/prd-asset':
            self.handle_prd_asset_save()
        elif self.path.split('?')[0] == '/api/capture-screenshot':
            self.handle_capture_screenshot()
        elif self.path.split('?')[0] == '/api/prd-doc':
            self.handle_prd_doc_save()
        elif self.path.split('?')[0] == '/api/prd-doc/create':
            self.handle_prd_doc_create()
        elif self.path.split('?')[0] == '/api/prd-doc/delete':
            self.handle_prd_doc_delete()
        elif self.path.split('?')[0] == '/api/drawio-diagram':
            self.handle_drawio_diagram_save()
        elif self.path.split('?')[0] == '/api/mindmap-diagram':
            self.handle_mindmap_diagram_save()
        elif self.path.split('?')[0] == '/api/prd-active-context':
            self.handle_prd_active_context_save()
        elif self.path.split('?')[0] == '/api/share-page':
            self.handle_share_page()
        elif self.path.split('?')[0] == '/api/share-folder':
            self.handle_share_folder()
        elif self.path.split('?')[0] == '/api/agent-provider-config':
            self.handle_save_agent_provider_config()
        elif self.path.startswith('/api/settings'):
            self.handle_save_settings()
        elif self.path.startswith('/api/sync'):
            self.handle_sync()
        else:
            super().do_POST()

    def handle_create_project(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))
        project_id = params.get('projectId')
        project_name = params.get('projectName')
        if not project_id or not project_name:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing projectId or projectName')
            return
        
        project_id = re.sub(r'[^a-zA-Z0-9_\-]', '', project_id).lower()
        if not project_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Invalid projectId')
            return

        try:
            root = get_project_root()
            proj_dir = os.path.join(root, 'src', 'pages', project_id)
            os.makedirs(proj_dir, exist_ok=True)
            
            json_path = os.path.join(root, 'data', 'projects.json')
            if os.path.isfile(json_path):
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = {'projects': []}
            
            existing_proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if existing_proj:
                existing_proj['deleted'] = False
                existing_proj['deletedAt'] = None
                existing_proj['name'] = project_name
                existing_proj.pop('targetDevice', None)
            else:
                new_proj = {
                    'id': project_id,
                    'name': project_name,
                    'deleted': False,
                    'deletedAt': None,
                    'pages': []
                }
                data.setdefault('projects', []).append(new_proj)
                
            data['activeProjectId'] = project_id
            data['activePageId'] = ''
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            synced = sync_projects()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Successfully created project {project_name} ({project_id})",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_create_project: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_delete_project(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))
        project_id = params.get('projectId')
        deleted_at = params.get('deletedAt')
        if not project_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing projectId')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return
                
            proj['deleted'] = True
            proj['deletedAt'] = deleted_at
            
            if data.get('activeProjectId') == project_id:
                data['activeProjectId'] = ''
                data['activePageId'] = ''
                
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            synced = sync_projects()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Successfully deleted project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_delete_project: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_restore_project(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))
        project_id = params.get('projectId')
        if not project_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing projectId')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return
                
            proj['deleted'] = False
            proj['deletedAt'] = None
            data['activeProjectId'] = project_id
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            synced = sync_projects()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Successfully restored project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_restore_project: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_rename_project(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))
        project_id = params.get('projectId')
        new_name = params.get('newName')
        if not project_id or not new_name:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing projectId or newName')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return
                
            proj['name'] = new_name
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            synced = sync_projects()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Successfully renamed project {project_id} to {new_name}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_rename_project: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_rename_project_id(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))
        project_id = params.get('projectId')
        new_project_id = str(params.get('newProjectId') or '').strip().lower()
        if not project_id or not new_project_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing projectId or newProjectId')
            return
        if not re.match(r'^[a-z0-9_-]+$', new_project_id):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Invalid newProjectId')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            projects = data.get('projects', [])
            proj = next((p for p in projects if p.get('id') == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return
            if new_project_id == project_id:
                synced = sync_projects()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "message": f"Project ID unchanged: {project_id}",
                    "projects": synced
                }).encode('utf-8'))
                return
            if any(p.get('id') == new_project_id for p in projects):
                self.send_response(409)
                self.end_headers()
                self.wfile.write(f"Project ID already exists: {new_project_id}".encode('utf-8'))
                return

            pages_root = os.path.join(root, 'src', 'pages')
            old_dir = os.path.join(pages_root, project_id)
            new_dir = os.path.join(pages_root, new_project_id)
            if os.path.exists(new_dir):
                self.send_response(409)
                self.end_headers()
                self.wfile.write(f"Project directory already exists: {new_project_id}".encode('utf-8'))
                return
            if os.path.isdir(old_dir):
                os.rename(old_dir, new_dir)
            else:
                os.makedirs(new_dir, exist_ok=True)

            proj['id'] = new_project_id
            if data.get('activeProjectId') == project_id:
                data['activeProjectId'] = new_project_id

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            synced = sync_projects()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Successfully changed project ID {project_id} to {new_project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_rename_project_id: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_iterate(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))
        
        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        new_version = params.get('newVersion')
        
        if not page_id or not new_version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing parameters')
            return

        try:
            source_version = params.get('sourceVersion')
            cmd = ["/bin/bash", os.path.join(get_application_root(), "scripts", "iterate.sh"), project_id, page_id, new_version]
            if source_version:
                cmd.append(source_version)
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                sync_projects()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {
                    "status": "success",
                    "message": f"Successfully iterated {page_id} to {new_version} in project {project_id}",
                    "output": result.stdout
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
            else:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Script error: {result.stderr}".encode('utf-8'))
                
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_delete(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')

        if not page_id or not version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing parameters')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return

            page = next((item for item in proj.get('pages', []) if item.get('id') == page_id), None)
            if not page:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Page not found: {page_id}".encode('utf-8'))
                return

            page = normalize_page_meta(page, page.get('versions', []))
            if version not in page.get('versions', []):
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Version not found: {page_id}/{version}".encode('utf-8'))
                return

            page['versions'].remove(version)
            page.get('versionStates', {}).pop(version, None)
            if page.get('activeVersion') == version:
                page['activeVersion'] = page['versions'][0] if page['versions'] else ''

            for idx, item in enumerate(proj['pages']):
                if item.get('id') == page_id:
                    proj['pages'][idx] = page
                    break

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            version_dir = os.path.join(root, 'src', 'pages', project_id, page_id, version)
            if os.path.isdir(version_dir):
                import shutil
                shutil.rmtree(version_dir)

            synced = sync_projects()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Deleted version {page_id}/{version} in project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_delete: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_delete_page(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        if not page_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return

            page = next((item for item in proj.get('pages', []) if item.get('id') == page_id), None)
            if not page:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Page not found: {page_id}".encode('utf-8'))
                return

            page = normalize_page_meta(page, page.get('versions', []))
            page['deleted'] = True
            page['deletedAt'] = params.get('deletedAt')

            for idx, item in enumerate(proj['pages']):
                if item.get('id') == page_id:
                    proj['pages'][idx] = page
                    break

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            synced = sync_projects()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Soft deleted page {page_id} in project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_delete_page: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_force_delete_project(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))
        project_id = params.get('projectId')
        if not project_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing projectId')
            return

        try:
            if not re.match(r'^[A-Za-z0-9_-]+$', project_id):
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'Invalid projectId')
                return

            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            projects = data.get('projects', [])
            idx_to_remove = -1
            for idx, p in enumerate(projects):
                if p['id'] == project_id:
                    idx_to_remove = idx
                    break
            
            if idx_to_remove == -1:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return

            projects.pop(idx_to_remove)
            
            if data.get('activeProjectId') == project_id:
                data['activeProjectId'] = ''
                data['activePageId'] = ''

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            proj_dir = os.path.join(root, 'src', 'pages', project_id)
            if os.path.isdir(proj_dir):
                import shutil
                shutil.rmtree(proj_dir)

            synced = sync_projects()

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Successfully force deleted project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_force_delete_project: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_force_delete_page(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))
        project_id = params.get('projectId')
        page_id = params.get('pageId')
        if not project_id or not page_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing projectId or pageId')
            return

        try:
            if not re.match(r'^[A-Za-z0-9_-]+$', project_id) or not re.match(r'^[A-Za-z0-9_-]+$', page_id):
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'Invalid parameters')
                return

            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return

            pages = proj.get('pages', [])
            idx_to_remove = -1
            for idx, page in enumerate(pages):
                if page.get('id') == page_id:
                    idx_to_remove = idx
                    break

            if idx_to_remove == -1:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Page not found: {page_id}".encode('utf-8'))
                return

            pages.pop(idx_to_remove)

            if data.get('activePageId') == page_id and data.get('activeProjectId') == project_id:
                data['activePageId'] = ''

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            page_dir = os.path.join(root, 'src', 'pages', project_id, page_id)
            if os.path.isdir(page_dir):
                import shutil
                shutil.rmtree(page_dir)

            synced = sync_projects()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Successfully force deleted page {page_id} in project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_force_delete_page: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_rename_page(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        new_name = params.get('newName')
        if not page_id or not new_name:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId or newName')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return

            page = next((item for item in proj.get('pages', []) if item.get('id') == page_id), None)
            if not page:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Page not found: {page_id}".encode('utf-8'))
                return

            page = normalize_page_meta(page, page.get('versions', []))
            page['name'] = new_name

            for idx, item in enumerate(proj['pages']):
                if item.get('id') == page_id:
                    proj['pages'][idx] = page
                    break

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            synced = sync_projects()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Renamed page {page_id} to {new_name} in project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_rename_page: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_page_structure(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        incoming_folders = params.get('folders', [])
        incoming_pages = params.get('pages', [])
        if not project_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing projectId')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            proj = next((p for p in data.get('projects', []) if p.get('id') == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return

            page_ids = {page.get('id') for page in proj.get('pages', []) if page.get('id')}
            folder_map = {}
            for idx, folder in enumerate(incoming_folders if isinstance(incoming_folders, list) else []):
                folder_id = str(folder.get('id') or '').strip()
                if not folder_id:
                    continue
                folder_map[folder_id] = {
                    'id': folder_id,
                    'name': str(folder.get('name') or '未命名文件夹'),
                    'parentId': folder.get('parentId') or None,
                    'order': folder.get('order', (idx + 1) * 1000),
                    'collapsed': bool(folder.get('collapsed', False)),
                    'deleted': bool(folder.get('deleted', False)),
                    'deletedAt': folder.get('deletedAt')
                }

            active_folder_ids = {folder_id for folder_id, folder in folder_map.items() if not folder.get('deleted')}
            for folder in folder_map.values():
                parent_id = folder.get('parentId')
                if parent_id not in active_folder_ids or parent_id == folder.get('id'):
                    folder['parentId'] = None

            safe_incoming_pages = incoming_pages if isinstance(incoming_pages, list) else []
            page_structure = {
                str(item.get('id')): item
                for item in safe_incoming_pages if isinstance(item, dict) and item.get('id') in page_ids
            }
            for idx, page in enumerate(proj.get('pages', [])):
                page_id = page.get('id')
                structure = page_structure.get(page_id, {})
                parent_id = structure.get('parentId') or None
                page['parentId'] = parent_id if parent_id in active_folder_ids else None
                page['order'] = structure.get('order', page.get('order', (idx + 1) * 1000))

            proj['folders'] = list(folder_map.values())

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            synced = sync_projects()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Updated page structure for project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_page_structure: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_restore_page(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        if not page_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId')
            return

        try:
            root = get_project_root()
            json_path = os.path.join(root, 'data', 'projects.json')
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            proj = next((p for p in data.get('projects', []) if p['id'] == project_id), None)
            if not proj:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Project not found: {project_id}".encode('utf-8'))
                return

            page = next((item for item in proj.get('pages', []) if item.get('id') == page_id), None)
            if not page:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Page not found: {page_id}".encode('utf-8'))
                return

            page = normalize_page_meta(page, page.get('versions', []))
            page['deleted'] = False
            page['deletedAt'] = None

            for idx, item in enumerate(proj['pages']):
                if item.get('id') == page_id:
                    proj['pages'][idx] = page
                    break

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            synced = sync_projects()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Restored page {page_id} in project {project_id}",
                "projects": synced
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_restore_page: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_annotations(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        annotations = params.get('annotations')

        if not page_id or not version or annotations is None:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing parameters')
            return

        try:
            root = get_project_root()
            ann_path = os.path.join(root, 'src', 'pages', project_id, page_id, version, 'annotations.json')

            os.makedirs(os.path.dirname(ann_path), exist_ok=True)
            with open(ann_path, 'w', encoding='utf-8') as f:
                json.dump(annotations, f, indent=2, ensure_ascii=False)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "message": f"Annotations saved for {project_id}/{page_id}/{version}",
                "count": len(annotations)
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_copy_edits(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        changes = params.get('changes')

        if not page_id or not version or not isinstance(changes, list):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId, version, or changes')
            return

        try:
            results = apply_copy_edits(project_id, page_id, version, changes)
            updated_count = len([item for item in results if item.get('status') in ('updated', 'patched')])
            response = {
                "status": "success" if updated_count == len(changes) else "partial",
                "updatedCount": updated_count,
                "totalCount": len(changes),
                "results": results
            }
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=UTF-8')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except FileNotFoundError as e:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_copy_edits: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_bind_jump(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        selector = params.get('selector')
        target_page_id = params.get('targetPageId')

        if not page_id or not version or not selector:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId, version, or selector')
            return

        try:
            root = get_project_root()
            page_dir = os.path.join(root, 'src', 'pages', project_id, page_id, version)
            file_path = os.path.join(page_dir, 'index.html')

            if not os.path.exists(file_path):
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"File not found: {file_path}".encode('utf-8'))
                return

            from bs4 import BeautifulSoup
            with open(file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            soup = BeautifulSoup(html_content, 'html.parser')
            element = soup.select_one(selector)

            if not element:
                cleaned_selector = selector
                if cleaned_selector.startswith('html > body > '):
                    cleaned_selector = cleaned_selector[14:]
                elif cleaned_selector.startswith('body > '):
                    cleaned_selector = cleaned_selector[7:]
                element = soup.select_one(cleaned_selector)

            if not element:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(f"Element not found with selector: {selector}".encode('utf-8'))
                return

            if target_page_id:
                element['data-link-to'] = target_page_id
            else:
                if 'data-link-to' in element.attrs:
                    del element['data-link-to']

            output_html = str(soup)

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(output_html)

            sync_projects()

            response = {
                "status": "success",
                "message": "Jump binding updated successfully"
            }
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=UTF-8')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_bind_jump: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_prd_doc_save(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        requested_path = params.get('path') or ''
        content = params.get('content')

        if not page_id or not version or not isinstance(content, str):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId, version, or content')
            return

        try:
            root = get_project_root()
            document_path, filename = resolve_prd_document_path(root, project_id, page_id, version, requested_path)

            os.makedirs(os.path.dirname(document_path), exist_ok=True)
            with open(document_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(content)

            stat = os.stat(document_path)
            if '/docs/' in document_path:
                relative_path = f'/src/pages/{project_id}/{page_id}/docs/{filename}'
            else:
                relative_path = f'/src/pages/{project_id}/{page_id}/{version}/{filename}'

            # Reclaim disk space: drop prd-assets images no longer cited by any
            # PRD document (e.g. when the user removed an image line before saving).
            try:
                cleanup_unused_prd_assets(root, project_id, page_id, version)
            except Exception as exc:
                print(f"PRD asset cleanup failed during save: {exc}")

            documents = list_prd_documents(root, project_id, page_id, version)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'status': 'success',
                'message': f'PRD saved for {project_id}/{page_id}/{version}',
                'path': relative_path,
                'filename': filename,
                'size': stat.st_size,
                'updatedAt': stat.st_mtime,
                'documents': documents
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_prd_doc_save: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_prd_active_context_get(self):
        try:
            root = get_project_root()
            context_path = os.path.join(root, 'data', 'active-prd-context.json')
            context = {}
            if os.path.isfile(context_path):
                with open(context_path, 'r', encoding='utf-8') as f:
                    context = json.load(f)
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=UTF-8')
            self.end_headers()
            self.wfile.write(json.dumps(context, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_prd_active_context_save(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        params = json.loads(self.rfile.read(content_length).decode('utf-8') or '{}')
        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        requested_path = params.get('path') or ''
        if not page_id or not version or not requested_path:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId, version, or path')
            return
        try:
            root = get_project_root()
            document_path, _ = resolve_prd_document_path(root, project_id, page_id, version, requested_path)
            if not os.path.isfile(document_path):
                raise ValueError('PRD document not found')
            relative_path = f'/{os.path.relpath(document_path, root).replace(chr(92), "/")}'
            context = {
                'projectId': project_id,
                'pageId': page_id,
                'version': version,
                'path': relative_path,
                'updatedAt': datetime.now(timezone.utc).isoformat()
            }
            context_path = os.path.join(root, 'data', 'active-prd-context.json')
            os.makedirs(os.path.dirname(context_path), exist_ok=True)
            with open(context_path, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(context, f, ensure_ascii=False, indent=2)
                f.write('\n')
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=UTF-8')
            self.end_headers()
            self.wfile.write(json.dumps(context, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_prd_doc_create(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        page_name = params.get('pageName') or page_id

        if not page_id or not version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId or version')
            return

        try:
            root = get_project_root()
            version_dir = os.path.normpath(os.path.join(root, 'src', 'pages', project_id, page_id, version))
            pages_root = os.path.normpath(os.path.join(root, 'src', 'pages'))
            if not version_dir.startswith(pages_root + os.sep):
                raise ValueError('Invalid page path')
            if not os.path.isdir(version_dir):
                raise ValueError('Version directory not found')

            docs_dir = os.path.normpath(os.path.join(root, 'src', 'pages', project_id, page_id, 'docs'))
            filename, document_version = get_next_prd_document_filename(root, project_id, page_id, version)
            document_path = os.path.normpath(os.path.join(docs_dir, filename))
            if not document_path.startswith(docs_dir + os.sep):
                raise ValueError('Invalid PRD document path')

            content = build_new_prd_document_content(page_name, page_id, version, document_version)
            os.makedirs(docs_dir, exist_ok=True)
            with open(document_path, 'x', encoding='utf-8', newline='\n') as f:
                f.write(content)

            stat = os.stat(document_path)
            relative_path = f'/src/pages/{project_id}/{page_id}/docs/{filename}'
            documents = list_prd_documents(root, project_id, page_id, version)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'status': 'success',
                'message': f'PRD created for {project_id}/{page_id}/{version}',
                'path': relative_path,
                'filename': filename,
                'content': content,
                'size': stat.st_size,
                'updatedAt': stat.st_mtime,
                'documentVersion': document_version,
                'documents': documents
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except FileExistsError:
            self.send_response(409)
            self.end_headers()
            self.wfile.write(b'PRD document already exists, please retry')
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_prd_doc_create: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_prd_doc_delete(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        requested_path = params.get('path') or ''

        if not page_id or not version or not requested_path:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId, version, or path')
            return

        try:
            root = get_project_root()
            document_path, filename = resolve_prd_document_path(root, project_id, page_id, version, requested_path)

            if os.path.isfile(document_path):
                os.remove(document_path)

            # After removing this document, any image it uniquely referenced may
            # now be orphaned; reclaim those too (shared references are preserved).
            try:
                cleanup_unused_prd_assets(root, project_id, page_id, version)
            except Exception as exc:
                print(f"PRD asset cleanup failed during delete: {exc}")

            documents = list_prd_documents(root, project_id, page_id, version)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'status': 'success',
                'message': 'PRD file deleted successfully',
                'documents': documents
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_prd_doc_delete: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_prd_asset_save(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        content_type = params.get('contentType') or 'image/png'
        data_url = params.get('dataUrl') or ''
        requested_filename = params.get('filename') or ''

        if not page_id or not version or not isinstance(data_url, str):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId, version, or dataUrl')
            return

        if content_type not in ('image/png', 'image/jpeg', 'image/webp'):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Unsupported asset content type')
            return

        try:
            match = re.match(r'^data:(image/(?:png|jpeg|webp));base64,(.+)$', data_url, re.DOTALL)
            if not match:
                raise ValueError('Invalid image data URL')

            encoded = match.group(2)
            image_bytes = base64.b64decode(encoded, validate=True)
            if len(image_bytes) > 8 * 1024 * 1024:
                raise ValueError('Image is too large')

            root = get_project_root()
            assets_dir, asset_path, filename = resolve_prd_asset_path(root, project_id, page_id, version, requested_filename)
            os.makedirs(assets_dir, exist_ok=True)
            with open(asset_path, 'wb') as f:
                f.write(image_bytes)

            relative_path = f'src/pages/{project_id}/{page_id}/docs/prd-assets/{filename}'
            markdown_path = f'prd-assets/{filename}'
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'status': 'success',
                'path': relative_path,
                'markdownPath': markdown_path,
                'filename': filename,
                'size': len(image_bytes)
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_prd_asset_save: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_capture_screenshot(self):
        import time
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        filename = params.get('filename') or f"prototype-shot-{int(time.time() * 1000)}"

        if not page_id or not version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId or version')
            return

        temp_html_path = None
        try:
            root = get_project_root()
            page_dir = os.path.join(root, 'src', 'pages', project_id, page_id, version)
            out_dir = os.path.join(root, 'src', 'pages', project_id, page_id, 'docs', 'prd-assets')
            os.makedirs(out_dir, exist_ok=True)

            html_content = params.get('htmlContent')
            html_file = 'index.html'
            if html_content:
                html_file = '__temp_capture.html'
                print(f"[SCREENSHOT DEBUG] Received dynamic HTML of size: {len(html_content)} bytes")
                temp_html_path = os.path.join(page_dir, html_file)
                with open(temp_html_path, 'w', encoding='utf-8') as f:
                    f.write(html_content)
            else:
                print(f"[SCREENSHOT DEBUG] No dynamic HTML received, falling back to default index.html")

            script_path = os.path.join(get_application_root(), 'tools', 'capture', 'prd-evidence.mjs')
            if not os.path.exists(script_path):
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Playwright screenshot script not found")
                return

            cmd = [
                "node",
                script_path,
                "--page-dir", page_dir,
                "--shot-name", filename,
                "--out", out_dir,
                "--html-file", html_file
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                relative_path = f"src/pages/{project_id}/{page_id}/docs/prd-assets/{filename}.png"
                markdown_path = f"prd-assets/{filename}.png"
                
                full_path = os.path.join(out_dir, f"{filename}.png")
                if not os.path.exists(full_path):
                    raise ValueError(f"Screenshot file was not generated: {result.stderr}")

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {
                    'status': 'success',
                    'path': relative_path,
                    'markdownPath': markdown_path,
                    'filename': f"{filename}.png"
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            else:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Screenshot script error: {result.stderr}".encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_capture_screenshot: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))
        finally:
            if temp_html_path and os.path.exists(temp_html_path):
                try:
                    os.remove(temp_html_path)
                except Exception as e:
                    print(f"Failed to remove temporary capture html: {e}")

    def handle_share_page(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        raw_share_type = str(params.get('shareType') or params.get('mode') or 'local').strip().lower()
        if raw_share_type == 'static':
            share_type = 'static'
            is_public = False
        else:
            is_public = (params.get('public') is True) or (raw_share_type == 'public')
            share_type = 'public' if is_public else 'local'

        if not page_id or not version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId or version')
            return

        try:
            try:
                from server.share_security import create_policy, save_policy, public_policy
            except ImportError:
                from share_security import create_policy, save_policy, public_policy
            if share_type != 'static' and params.get('access') is not None:
                raise ValueError('有效期和密码保护仅支持链接分享。')
            access_policy = create_policy(params.get('access')) if share_type == 'static' else None
            root = get_project_root()
            sync_projects()
            version_dir = resolve_share_version_dir(root, project_id, page_id, version)
            page = read_project_page(root, project_id, page_id) or {}
            page_name = params.get('pageName') or page.get('name') or page_id
            annotations = read_share_annotations(version_dir)
            prd = read_share_prd(root, project_id, page_id, version, params.get('prdPath') or '')
            diagram = read_share_drawio(root, project_id, page_id, version, params.get('diagramPath') or '')
            mindmap = read_share_mindmap(root, project_id, page_id, version, params.get('mindmapPath') or '')

            include_annotations = True
            include_prd = True
            share_data = {
                'projectId': project_id,
                'pageId': page_id,
                'pageName': page_name,
                'targetDevice': normalize_page_target_device(page.get('targetDevice')),
                'pageMode': page.get('pageMode', 'standard'),
                'version': version,
                'shareType': share_type,
                'includeAnnotations': include_annotations,
                'includePrd': include_prd,
                'demoPath': f'/src/pages/{project_id}/{page_id}/{version}/index.html',
                'annotations': annotations if include_annotations else [],
                'prdContent': prd.get('content') if include_prd else '',
                'prdPath': f'/{prd.get("path")}' if include_prd and prd.get('path') else '',
                'prdFilename': prd.get('filename') if include_prd else '',
                'diagramContent': diagram.get('content') or '',
                'diagramPath': diagram.get('path') or '',
                'diagramFilename': diagram.get('filename') or '',
                'diagrams': diagram.get('diagrams') or [],
                'mindmapContent': mindmap.get('content') or '',
                'mindmapPath': mindmap.get('path') or '',
                'mindmapFilename': mindmap.get('filename') or '',
                'mindmaps': mindmap.get('mindmaps') or [],
                'generatedAt': datetime.now(timezone.utc).isoformat()
            }

            filename = f'{slugify_share_part(page_id)}-{version}-{share_type}.html'
            share_dir = os.path.join(root, 'shares')
            os.makedirs(share_dir, exist_ok=True)
            share_path = os.path.join(share_dir, filename)
            shell_share_data = {
                'enabled': True,
                'projectId': project_id,
                'pageId': page_id,
                'pageName': page_name,
                'targetDevice': normalize_page_target_device(page.get('targetDevice')),
                'pageMode': page.get('pageMode', 'standard'),
                'version': version,
                'shareType': share_type,
                'generatedAt': share_data['generatedAt'],
                'annotations': annotations if include_annotations else [],
                'prdContent': prd.get('content') if include_prd else '',
                'prdPath': f'/{prd.get("path")}' if include_prd and prd.get('path') else '',
                'prdFilename': prd.get('filename') if include_prd else '',
                'diagramContent': diagram.get('content') or '',
                'diagramPath': diagram.get('path') or '',
                'diagramFilename': diagram.get('filename') or '',
                'diagrams': diagram.get('diagrams') or [],
                'mindmapContent': mindmap.get('content') or '',
                'mindmapPath': mindmap.get('path') or '',
                'mindmapFilename': mindmap.get('filename') or '',
                'mindmaps': mindmap.get('mindmaps') or [],
                'documents': list_prd_documents(root, project_id, page_id, version)
            }

            # Static shares: pre-build a downloadable zip (version dir + docs) and
            # deploy it next to the HTML so the share's "download" button works
            # without the backend tunnel (prota.*) being up.
            extra_deploy_files = []
            if share_type == 'static':
                try:
                    zip_bytes = build_page_zip_bytes(root, project_id, page_id, version)
                    zip_filename = f'{slugify_share_part(page_id)}-{version}-static.zip'
                    with open(os.path.join(share_dir, zip_filename), 'wb') as zf:
                        zf.write(zip_bytes)
                    shell_share_data['zipFilename'] = zip_filename
                    extra_deploy_files.append(os.path.relpath(os.path.join(share_dir, zip_filename), root))
                except Exception as zip_err:
                    print(f"Static share zip generation failed: {zip_err}")

            with open(share_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(build_share_page_html(shell_share_data))

            if access_policy:
                save_policy(root, filename, access_policy, (params.get('access') or {}).get('password', ''))
            settings = load_settings()
            static_domain = settings.get("staticDomain", "")
            public_domain = settings.get("publicDomain", "prota.example.com")

            deploy_warning = ''
            if share_type == 'static':
                try:
                    from server.deployer import VercelDeployer
                except ImportError:
                    from deployer import VercelDeployer
                deployer = VercelDeployer(root)
                try:
                    deployer.deploy(share_path, project_id=project_id, page_id=page_id, version=version, extra_files=extra_deploy_files)
                except Exception as e:
                    deploy_warning = str(e)
                    print(f"Static share file generated, but Vercel deploy failed: {deploy_warning}", flush=True)
                url = f'https://{static_domain}/shares/{filename}' if static_domain else ''
            elif is_public:
                url = f'https://{public_domain}/shares/{filename}'
            else:
                host = self.headers.get('Host') or f'localhost:{PORT}'
                url = f'http://{host}/shares/{filename}'
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'status': 'partial' if deploy_warning else 'success',
                'path': f'shares/{filename}',
                'url': url,
                'projectId': project_id,
                'pageId': page_id,
                'version': version,
                'shareType': share_type,
                'annotationCount': len(share_data['annotations']),
                'hasPrd': bool(share_data['prdContent']),
                'access': public_policy(access_policy) if access_policy else None,
                'deployWarning': deploy_warning
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_share_page: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_share_folder(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8') or '{}')

        project_id = params.get('projectId', 'readify')
        folder_id = params.get('folderId')
        raw_share_type = str(params.get('shareType') or params.get('mode') or 'local').strip().lower()
        if raw_share_type == 'static':
            share_type = 'static'
            is_public = False
        else:
            is_public = (params.get('public') is True) or (raw_share_type == 'public')
            share_type = 'public' if is_public else 'local'

        if not folder_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing folderId')
            return

        try:
            try:
                from server.share_security import create_policy, save_policy, public_policy
            except ImportError:
                from share_security import create_policy, save_policy, public_policy
            if share_type != 'static' and params.get('access') is not None:
                raise ValueError('有效期和密码保护仅支持链接分享。')
            access_policy = create_policy(params.get('access')) if share_type == 'static' else None
            root = get_project_root()
            sync_projects()
            project = read_project_record(root, project_id) or {}
            project_name = project.get('name') or project_id

            folders_raw = project.get('folders') or []
            pages_raw = project.get('pages') or []

            target_folder = next((f for f in folders_raw if f.get('id') == folder_id), None)
            if not target_folder:
                raise ValueError('Folder not found')
            folder_name = params.get('folderName') or target_folder.get('name') or folder_id

            # Collect descendant folder ids (recursive), then gather pages whose
            # parentId belongs to any of them. Skip deleted folders and pages.
            active_folders_by_id = {f['id']: f for f in folders_raw if not f.get('deleted') and f.get('id')}
            descendant_folder_ids = set()
            pending = [folder_id]
            while pending:
                current = pending.pop()
                if current in descendant_folder_ids:
                    continue
                descendant_folder_ids.add(current)
                for f in folders_raw:
                    if f.get('deleted'):
                        continue
                    if f.get('parentId') == current and f.get('id') not in descendant_folder_ids:
                        pending.append(f.get('id'))

            folders_payload = []
            for f in folders_raw:
                if f.get('deleted'):
                    continue
                if f.get('id') not in descendant_folder_ids:
                    continue
                folders_payload.append({
                    'id': str(f.get('id')),
                    'name': str(f.get('name') or '未命名文件夹'),
                    'parentId': (str(f.get('parentId')) if f.get('parentId') else None),
                    'order': _safe_order(f.get('order')),
                    'collapsed': bool(f.get('collapsed')),
                })

            pages_payload = []
            for page in pages_raw:
                if page.get('deleted'):
                    continue
                page_parent = page.get('parentId')
                if not page_parent or page_parent not in descendant_folder_ids:
                    continue
                version = page.get('activeVersion') or (page.get('versions') or [None])[0]
                if not version:
                    continue
                version_states = page.get('versionStates') or {}
                version_state = version_states.get(version) or {}
                if version_state.get('deleted'):
                    continue
                try:
                    version_dir = resolve_share_version_dir(root, project_id, page.get('id'), version)
                except ValueError:
                    continue
                annotations = read_share_annotations(version_dir)
                prd = read_share_prd(root, project_id, page.get('id'), version, params.get('prdPath') or '')
                diagram = read_share_drawio(root, project_id, page.get('id'), version, params.get('diagramPath') or '')
                mindmap = read_share_mindmap(root, project_id, page.get('id'), version, params.get('mindmapPath') or '')
                pages_payload.append({
                    'id': str(page.get('id')),
                    'name': str(page.get('name') or page.get('id')),
                    'targetDevice': normalize_page_target_device(page.get('targetDevice')),
                'pageMode': page.get('pageMode', 'standard'),
                    'version': str(version),
                    'parentId': str(page.get('parentId')),
                    'order': _safe_order(page.get('order')),
                    'demoPath': f'/src/pages/{project_id}/{page.get("id")}/{version}/index.html',
                    'annotations': annotations,
                    'prdContent': prd.get('content') or '',
                    'prdPath': f'/{prd.get("path")}' if prd.get('path') else '',
                    'prdFilename': prd.get('filename') or '',
                    'documents': list_prd_documents(root, project_id, page.get('id'), version),
                    'diagramContent': diagram.get('content') or '',
                    'diagramPath': diagram.get('path') or '',
                    'diagramFilename': diagram.get('filename') or '',
                    'diagrams': diagram.get('diagrams') or [],
                    'mindmapContent': mindmap.get('content') or '',
                    'mindmapPath': mindmap.get('path') or '',
                    'mindmapFilename': mindmap.get('filename') or '',
                    'mindmaps': mindmap.get('mindmaps') or [],
                })

            if not pages_payload:
                raise ValueError('文件夹内没有可分享的页面')

            generated_at = datetime.now(timezone.utc).isoformat()

            share_payload = {
                'enabled': True,
                'mode': 'folder',
                'projectId': project_id,
                'projectName': project_name,
                'folderId': str(folder_id),
                'folderName': folder_name,
                'shareType': share_type,
                'generatedAt': generated_at,
                'folders': sorted(folders_payload, key=lambda x: x['order']),
                'pages': sorted(pages_payload, key=lambda x: x['order']),
            }

            filename = f'{slugify_share_part(project_id)}-{slugify_share_part(folder_id)}-folder-{share_type}.html'
            share_dir = os.path.join(root, 'shares')
            os.makedirs(share_dir, exist_ok=True)
            share_path = os.path.join(share_dir, filename)
            with open(share_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(build_share_page_html(share_payload))

            if access_policy:
                save_policy(root, filename, access_policy, (params.get('access') or {}).get('password', ''))
            settings = load_settings()
            static_domain = settings.get("staticDomain", "")
            public_domain = settings.get("publicDomain", "prota.example.com")

            deploy_warning = ''
            if share_type == 'static':
                try:
                    from server.deployer import VercelDeployer
                except ImportError:
                    from deployer import VercelDeployer
                deployer = VercelDeployer(root)
                page_versions = [(p['id'], p['version']) for p in pages_payload]
                try:
                    deployer.deploy(share_path, project_id=project_id, page_versions=page_versions)
                except Exception as e:
                    deploy_warning = str(e)
                    print(f"Static folder share file generated, but Vercel deploy failed: {deploy_warning}", flush=True)
                url = f'https://{static_domain}/shares/{filename}' if static_domain else ''
            elif is_public:
                url = f'https://{public_domain}/shares/{filename}'
            else:
                host = self.headers.get('Host') or f'localhost:{PORT}'
                url = f'http://{host}/shares/{filename}'

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'status': 'partial' if deploy_warning else 'success',
                'path': f'shares/{filename}',
                'url': url,
                'projectId': project_id,
                'folderId': folder_id,
                'shareType': share_type,
                'pageCount': len(pages_payload),
                'access': public_policy(access_policy) if access_policy else None,
                'deployWarning': deploy_warning,
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_share_folder: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_save_settings(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            settings = {
                "publicDomain": str(data.get("publicDomain", "prota.example.com")).strip(),
                "staticDomain": str(data.get("staticDomain", "")).strip(),
                "gitAutoPush": False,
                "vercelAutoDeploy": bool(data.get("vercelAutoDeploy", True)),
                "shareMode": data.get("shareMode") if data.get("shareMode") in {"vercel", "custom", "local"} else ("custom" if data.get("staticDomain") and not str(data.get("staticDomain")).endswith(".vercel.app") else "vercel")
            }
            save_settings(settings)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "settings": {**settings, 'sharingConfigured': sharing_configured(settings)}}).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_save_agent_provider_config(self):
        try:
            if not self.is_local_request():
                self.send_response(403)
                self.end_headers()
                return
            content_length = int(self.headers.get('Content-Length', '0'))
            if content_length <= 0 or content_length > 1024 * 1024:
                raise ValueError('Invalid provider config payload size')
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            config = save_agent_provider_config(data)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'config': config
            }, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_sync(self):
        try:
            result = sync_projects()
            if result:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'No projects found in src/pages/')
        except Exception as e:
            print(f"Error in handle_sync: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Sync error: {str(e)}".encode('utf-8'))

    def handle_prd_docs(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        project_id = (query.get('projectId') or ['readify'])[0]
        page_id = (query.get('pageId') or [''])[0]
        version = (query.get('version') or [''])[0]
        if not page_id or not version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId or version')
            return

        try:
            root = get_project_root()
            documents = list_prd_documents(root, project_id, page_id, version)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'projectId': project_id,
                'pageId': page_id,
                'version': version,
                'documents': documents
            }, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            print(f"Error in handle_prd_docs: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_drawio_diagram_get(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        project_id = (query.get('projectId') or ['readify'])[0]
        page_id = (query.get('pageId') or [''])[0]
        version = (query.get('version') or [''])[0]
        requested_path = (query.get('path') or [''])[0]
        if not page_id or not version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId or version')
            return
        try:
            root = get_project_root()
            diagrams = list_drawio_diagrams(root, project_id, page_id, version)
            selected = next((item for item in diagrams if item['path'].lstrip('/') == requested_path.lstrip('/')), None)
            selected = selected or (diagrams[0] if diagrams else None)
            content = ''
            if selected:
                _, diagram_path, _ = resolve_drawio_diagram_path(
                    root, project_id, page_id, version, selected.get('path') or ''
                )
                with open(diagram_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=UTF-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                'projectId': project_id,
                'pageId': page_id,
                'version': version,
                'content': content,
                'path': selected.get('path') if selected else '',
                'filename': selected.get('filename') if selected else '',
                'diagrams': diagrams
            }, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_drawio_diagram_save(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        params = json.loads(self.rfile.read(content_length).decode('utf-8') or '{}')
        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        requested_path = params.get('path') or ''
        content = params.get('content')
        if not page_id or not version or not isinstance(content, str):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId, version, or content')
            return
        if len(content.encode('utf-8')) > 5 * 1024 * 1024:
            self.send_response(413)
            self.end_headers()
            self.wfile.write(b'Draw.io XML is too large')
            return
        if '<mxfile' not in content or '</mxfile>' not in content:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Invalid draw.io XML')
            return
        try:
            import xml.etree.ElementTree as ET
            document = ET.fromstring(content)
            diagrams = document.findall('diagram') if document.tag == 'mxfile' else []
            if not diagrams or not all(diagram.find('mxGraphModel') is not None for diagram in diagrams):
                raise ValueError('Invalid draw.io XML structure')
            root = get_project_root()
            diagrams_dir, diagram_path, filename = resolve_drawio_diagram_path(
                root, project_id, page_id, version, requested_path
            )
            os.makedirs(diagrams_dir, exist_ok=True)
            with open(diagram_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(content)
            relative_path = os.path.relpath(diagram_path, root).replace('\\', '/')
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=UTF-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'path': f'/{relative_path}',
                'filename': filename,
                'diagrams': list_drawio_diagrams(root, project_id, page_id, version)
            }, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_mindmap_diagram_get(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        project_id = (query.get('projectId') or ['readify'])[0]
        page_id = (query.get('pageId') or [''])[0]
        version = (query.get('version') or [''])[0]
        requested_path = (query.get('path') or [''])[0]
        if not page_id or not version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId or version')
            return
        try:
            root = get_project_root()
            mindmaps = list_mindmaps(root, project_id, page_id, version)
            selected = next((item for item in mindmaps if item['path'].lstrip('/') == requested_path.lstrip('/')), None)
            selected = selected or (mindmaps[0] if mindmaps else None)
            content = ''
            if selected:
                _, mindmap_path, _ = resolve_mindmap_path(
                    root, project_id, page_id, version, selected.get('path') or ''
                )
                with open(mindmap_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=UTF-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                'projectId': project_id,
                'pageId': page_id,
                'version': version,
                'content': content,
                'path': selected.get('path') if selected else '',
                'filename': selected.get('filename') if selected else '',
                'mindmaps': mindmaps
            }, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_mindmap_diagram_save(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        params = json.loads(self.rfile.read(content_length).decode('utf-8') or '{}')
        project_id = params.get('projectId', 'readify')
        page_id = params.get('pageId')
        version = params.get('version')
        requested_path = params.get('path') or ''
        content = params.get('content')
        if not page_id or not version or not isinstance(content, str):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId, version, or content')
            return
        if len(content.encode('utf-8')) > 2 * 1024 * 1024:
            self.send_response(413)
            self.end_headers()
            self.wfile.write(b'Mindmap content is too large')
            return
        try:
            root = get_project_root()
            mindmaps_dir, mindmap_path, filename = resolve_mindmap_path(
                root, project_id, page_id, version, requested_path
            )
            os.makedirs(mindmaps_dir, exist_ok=True)
            with open(mindmap_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(content)
            relative_path = os.path.relpath(mindmap_path, root).replace('\\', '/')
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=UTF-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'path': f'/{relative_path}',
                'filename': filename,
                'mindmaps': list_mindmaps(root, project_id, page_id, version)
            }, ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))

    def handle_download_zip(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        project_id = (query.get('projectId') or ['readify'])[0]
        page_id = (query.get('pageId') or [''])[0]
        version = (query.get('version') or [''])[0]

        if not page_id or not version:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing pageId or version')
            return

        try:
            file_bytes = build_page_zip_bytes(get_project_root(), project_id, page_id, version)
        except ValueError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Invalid parameters format')
            return
        except FileNotFoundError as e:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
            return
        except Exception as e:
            print(f"Error in handle_download_zip: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {str(e)}".encode('utf-8'))
            return

        safe_project_id = re.sub(r'[^a-zA-Z0-9_\-]', '', project_id)
        safe_page_id = re.sub(r'[^a-zA-Z0-9_\-]', '', page_id)
        safe_version = re.sub(r'[^a-zA-Z0-9_\-]', '', version)
        self.send_response(200)
        self.send_header('Content-Type', 'application/zip')
        self.send_header('Content-Disposition', f'attachment; filename="{safe_project_id}_{safe_page_id}_{safe_version}_prd.zip"')
        self.send_header('Content-Length', str(len(file_bytes)))
        self.end_headers()
        self.wfile.write(file_bytes)

    def end_headers(self):

        # The browser might block the request if this header is duplicated.
        # SimpleHTTPRequestHandler.end_headers() is where we inject our CORS headers.
        # We don't call super() until after we have sent our custom headers.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Disable caching so the browser always loads the latest file versions
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    print(f"Readify Bridge Server starting on http://localhost:{PORT}")
    print("Features enabled: File Serving + Iteration API + Auto-Sync")
    print(f"Root directory: {os.getcwd()}")

    # Auto-sync: scan actual folder structure and update config files
    try:
        synced = sync_projects()
    except (OSError, ValueError) as error:
        print(f'Workspace unavailable: {error}')
        synced = None
    if synced and synced.get('projects'):
        for proj in synced['projects']:
            print(f"  Project: {proj.get('name') or proj.get('id')} ({proj.get('id')})")
            for p in proj.get('pages', []):
                print(f"    Synced: {p['name']} ({p['id']}) -> {', '.join(p['versions'])}")
    else:
        print("  Warning: No projects or pages found.")

    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True


    with ReusableTCPServer(("", PORT), BridgeHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nBridge Server stopped.")
