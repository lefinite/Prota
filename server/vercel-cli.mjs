/** Resolve only the Vercel CLI version installed and locked by this product. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveVercelCLI(root = applicationRoot) {
    const restore = '请在产品安装目录执行 npm ci，安装当前产品锁定的依赖。';
    const product = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const expected = product.dependencies?.vercel;
    if (!/^\d+\.\d+\.\d+$/.test(expected || '')) {
        throw new Error('产品未声明精确的 Vercel CLI 版本。' + restore);
    }
    let installed, locked;
    try {
        locked = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
        installed = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/vercel/package.json'), 'utf8'));
    } catch {
        throw new Error('Vercel CLI 依赖缺失。' + restore);
    }
    if (locked.packages?.['']?.dependencies?.vercel !== expected ||
        locked.packages?.['node_modules/vercel']?.version !== expected || installed.version !== expected) {
        throw new Error('Vercel CLI 版本与产品锁定版本不一致（需要 ' + expected + '）。' + restore);
    }
    const directory = path.join(root, 'node_modules/vercel');
    const bin = installed.bin?.vercel;
    const entry = typeof bin === 'string' ? path.resolve(directory, bin) : '';
    if (!entry.startsWith(directory + path.sep) || !fs.existsSync(entry)) {
        throw new Error('Vercel CLI 安装不完整。' + restore);
    }
    return entry;
}
