import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const configDirectory = path.resolve(process.env.READIFY_CONFIG_DIR || path.join(os.homedir(), '.config', 'prota'));
export function getWorkspaceRoot() {
    const file = path.join(configDirectory, 'workspace.json');
    let configured = process.env.READIFY_WORKSPACE || (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).path : null);
    if (!configured) {
        const legacy = path.join(applicationRoot, 'data/projects.json');
        if (fs.existsSync(legacy) && JSON.parse(fs.readFileSync(legacy, 'utf8')).projects?.length) return applicationRoot;
        const root = path.join(configDirectory, 'workspace');
        fs.mkdirSync(path.join(root, 'src/pages'), { recursive: true });
        fs.mkdirSync(path.join(root, 'data'), { recursive: true });
        if (!fs.existsSync(path.join(root, 'data/projects.json'))) fs.writeFileSync(path.join(root, 'data/projects.json'), JSON.stringify({ projects: [], activeProjectId: null, activePageId: null }), { mode: 0o600 });
        if (!fs.existsSync(path.join(root, 'workspace.json'))) fs.writeFileSync(path.join(root, 'workspace.json'), JSON.stringify({ id: crypto.randomUUID(), formatVersion: 1, createdAt: Date.now() / 1000 }), { mode: 0o600 });
        fs.writeFileSync(file, JSON.stringify({ path: root }), { mode: 0o600 });
        configured = root;
    }
    const root = path.resolve(configured);
    if (!fs.existsSync(path.join(root, 'src', 'pages')) || !fs.existsSync(path.join(root, 'data', 'projects.json'))) {
        throw new Error('项目存放位置不可用，请在设置中重新定位工作区。');
    }
    if (root !== applicationRoot) {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workspace.json'), 'utf8'));
        if (manifest.formatVersion !== 1 || !manifest.id) throw new Error('工作区清单无效，请在设置中重新选择。');
    }
    return root;
}
export function workspaceLocked() {
    return fs.existsSync(path.join(configDirectory, 'workspace.lock'));
}
