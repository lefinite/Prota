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
    write('package-lock.json', { packages: { '': { dependencies: { vercel: '1.2.3' } }, 'node_modules/.prota-vercel/node_modules/vercel': { version: '1.2.3' } } });
    write('node_modules/.prota-vercel/node_modules/vercel/package.json', { name: 'vercel', version: '1.2.3', bin: { vercel: 'dist/cli.cjs' } });
    write('node_modules/.prota-vercel/node_modules/vercel/dist/cli.cjs', 'console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));');
    return { root, write };
}

test('resolves the product-managed CLI', t => {
    const { root } = fixture(t);
    assert.equal(resolveVercelCLI(root), path.join(root, 'node_modules/.prota-vercel/node_modules/vercel/dist/cli.cjs'));
});

test('missing local dependency never falls back to global commands or caches', t => {
    const { root } = fixture(t);
    fs.rmSync(path.join(root, 'node_modules'), { recursive: true });
    assert.throws(() => resolveVercelCLI(root), /依赖缺失.*vercel:update/);
});

test('accepts an updated CLI without matching the product lockfile', t => {
    const { root, write } = fixture(t);
    write('node_modules/.prota-vercel/node_modules/vercel/package.json', { name: 'vercel', version: '9.9.9', bin: { vercel: 'dist/cli.cjs' } });
    assert.equal(resolveVercelCLI(root), path.join(root, 'node_modules/.prota-vercel/node_modules/vercel/dist/cli.cjs'));
});

test('incomplete entrypoints and invalid packages fail with repair instructions', t => {
    const { root, write } = fixture(t);
    fs.rmSync(path.join(root, 'node_modules/.prota-vercel/node_modules/vercel/dist/cli.cjs'));
    assert.throws(() => resolveVercelCLI(root), /安装不完整.*vercel:update/);
    write('node_modules/.prota-vercel/node_modules/vercel/package.json', { name: 'other', version: '1.2.3' });
    assert.throws(() => resolveVercelCLI(root), /安装信息无效/);
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
    write('node_modules/.prota-vercel/node_modules/vercel/dist/cli.cjs', 'process.exit(7);');
    assert.equal(spawnSync(process.execPath, [wrapper, 'login'], { cwd: business }).status, 7);
    const check = spawnSync(process.execPath, [wrapper, '--prota-check'], { cwd: business, encoding: 'utf8' });
    assert.equal(check.status, 0); assert.equal(check.stdout, '');
});


test('installer explicitly fetches latest on each run without changing product manifests', t => {
    const { root, write } = fixture(t);
    write('server/vercel-cli.mjs', fs.readFileSync(new URL('../server/vercel-cli.mjs', import.meta.url), 'utf8'));
    write('scripts/install-vercel-cli.mjs', fs.readFileSync(new URL('../scripts/install-vercel-cli.mjs', import.meta.url), 'utf8'));
    write('tools/vercel-runtime/package.json', { private: true, dependencies: { vercel: 'latest' } });
    write('fake-npm.cjs', `
      const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
      const args=process.argv.slice(2);assert(args.includes('vercel@latest'));assert(args.includes('--package-lock=false'));assert(args.includes('--prefer-online'));
      const directory=path.join(args[args.indexOf('--prefix')+1],'node_modules/vercel');fs.mkdirSync(directory,{recursive:true});
      fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name:'vercel',version:process.env.TEST_CLI_VERSION,bin:{vercel:'cli.cjs'}}));
      fs.writeFileSync(path.join(directory,'cli.cjs'),'');
    `);
    const original=fs.readFileSync(path.join(root,'package-lock.json'),'utf8');
    for (const version of ['1.0.0','2.0.0']) {
        const result=spawnSync(process.execPath,[path.join(root,'scripts/install-vercel-cli.mjs')],{cwd:os.tmpdir(),encoding:'utf8',env:{...process.env,npm_execpath:path.join(root,'fake-npm.cjs'),TEST_CLI_VERSION:version}});
        assert.equal(result.status,0,result.stderr);
        const cli=resolveVercelCLI(root);
        assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(cli),'package.json'),'utf8')).version,version);
    }
    assert.equal(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'),original);
});
