import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const productRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function canvasPersistence(action, root, context, runId) {
    if (!context?.projectId || !context?.pageId || !/^v\d+$/.test(context.version || '')) return;
    for (const part of [context.projectId, context.pageId]) if (!/^[a-zA-Z0-9_-]+$/.test(part)) return;
    await new Promise((resolve, reject) => {
        const child = spawn(process.env.PROTA_PYTHON || 'python3', ['-m', 'server.canvas_autosave'], {
            cwd: productRoot, stdio: ['pipe', 'ignore', 'pipe'], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
        });
        let error = '';
        child.stderr.on('data', data => { error = (error + data).slice(-4000); });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve() : reject(new Error(error || 'Canvas persistence failed')));
        child.stdin.on('error', () => {});
        child.stdin.end(JSON.stringify({ action, root, context: { projectId: context.projectId, pageId: context.pageId, version: context.version }, runId }));
    });
}
