/** Resolve the CLI installed by the product's install/update workflow. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveVercelCLI(root = applicationRoot) {
    const restore = '请在产品安装目录执行 npm run vercel:update 安装最新版 Vercel CLI。';
    const directory = path.join(root, 'node_modules/.prota-vercel/node_modules/vercel');
    let installed;
    try {
        installed = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    } catch {
        throw new Error('Vercel CLI 依赖缺失。' + restore);
    }
    // Accept the installed release rather than comparing it to a product lock.
    if (installed.name !== 'vercel' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(installed.version || '')) {
        throw new Error('Vercel CLI 安装信息无效。' + restore);
    }
    const bin = installed.bin?.vercel;
    const entry = typeof bin === 'string' ? path.resolve(directory, bin) : '';
    if (!entry.startsWith(directory + path.sep) || !fs.existsSync(entry)) {
        throw new Error('Vercel CLI 安装不完整。' + restore);
    }
    return entry;
}
