#!/usr/bin/env node
// Install the current CLI independently of the product's dependency lockfile.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { applicationRoot } from '../server/vercel-cli.mjs';

const directory = path.join(applicationRoot, 'node_modules/.prota-vercel');
fs.mkdirSync(directory, { recursive: true });
fs.copyFileSync(path.join(applicationRoot, 'tools/vercel-runtime/package.json'), path.join(directory, 'package.json'));
console.log('正在安装 npm 仓库 latest 标签对应的 Vercel CLI…');
// An isolated prefix avoids recursively executing this product's postinstall.
// Explicit @latest resolves the tag on each installation, even with an old cache.
const args = ['install', '--prefix', directory, '--no-save', '--package-lock=false', '--prefer-online', '--no-audit', '--no-fund', 'vercel@latest'];
const result = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], { stdio: 'inherit' })
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error || result.status !== 0) {
    console.error('Vercel CLI 安装失败，请检查 npm 网络连接后运行 npm run vercel:update。');
    process.exitCode = result.status || 1;
}
