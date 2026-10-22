import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveVercelCLI } from '../server/vercel-cli.mjs';

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prota-cli-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const write = (file, value) => {
        const target = path.join(root, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
    };
    write('package.json', { dependencies: { vercel: '1.2.3' } });
    write('package-lock.json', { packages: { '': { dependencies: { vercel: '1.2.3' } }, 'node_modules/vercel': { version: '1.2.3' } } });
    write('node_modules/vercel/package.json', { version: '1.2.3', bin: { vercel: 'dist/cli.cjs' } });
    write('node_modules/vercel/dist/cli.cjs', 'console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));');
    return { root, write };
}

test('resolves the exact installed and locked product dependency', t => {
    const { root } = fixture(t);
    assert.equal(resolveVercelCLI(root), path.join(root, 'node_modules/vercel/dist/cli.cjs'));
});

test('missing local dependency never falls back to global commands or caches', t => {
    const { root } = fixture(t);
    fs.rmSync(path.join(root, 'node_modules'), { recursive: true });
    assert.throws(() => resolveVercelCLI(root), /依赖缺失.*npm ci/);
});

test('mismatched installed version and changed lockfile are rejected', t => {
    const { root, write } = fixture(t);
    write('node_modules/vercel/package.json', { version: '9.9.9', bin: { vercel: 'dist/cli.cjs' } });
    assert.throws(() => resolveVercelCLI(root), /版本不一致/);
    write('node_modules/vercel/package.json', { version: '1.2.3', bin: { vercel: 'dist/cli.cjs' } });
    write('package-lock.json', { packages: { '': { dependencies: { vercel: '^1.2.3' } }, 'node_modules/vercel': { version: '1.2.3' } } });
    assert.throws(() => resolveVercelCLI(root), /版本不一致/);
});

test('version ranges and incomplete entrypoints fail closed', t => {
    const { root, write } = fixture(t);
    fs.rmSync(path.join(root, 'node_modules/vercel/dist/cli.cjs'));
    assert.throws(() => resolveVercelCLI(root), /安装不完整/);
    write('package.json', { dependencies: { vercel: '^1.2.3' } });
    assert.throws(() => resolveVercelCLI(root), /精确/);
});

test('absolute wrapper works from business cwd and preserves argument boundaries and exit status', t => {
    const { root, write } = fixture(t);
    write('server/vercel-cli.mjs', fs.readFileSync(new URL('../server/vercel-cli.mjs', import.meta.url), 'utf8'));
    write('scripts/vercel-cli.mjs', fs.readFileSync(new URL('../scripts/vercel-cli.mjs', import.meta.url), 'utf8'));
    const business = path.join(root, 'business workspace'); fs.mkdirSync(business);
    const wrapper = path.join(root, 'scripts/vercel-cli.mjs');
    const result = spawnSync(process.execPath, [wrapper, 'deploy', '--cwd', business], { cwd: business, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { args: ['deploy', '--cwd', business], cwd: fs.realpathSync(business) });
    write('node_modules/vercel/dist/cli.cjs', 'process.exit(7);');
    assert.equal(spawnSync(process.execPath, [wrapper, 'login'], { cwd: business }).status, 7);
    const check = spawnSync(process.execPath, [wrapper, '--prota-check'], { cwd: business, encoding: 'utf8' });
    assert.equal(check.status, 0); assert.equal(check.stdout, '');
});
