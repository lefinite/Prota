import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { extractRuntime } from '../scripts/runtime-archive.mjs';

function entry(name, content = '', type = '0') {
    const body = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'utf8');
    header.write(body.length.toString(8).padStart(11, '0'), 124, 11, 'ascii');
    header.write(type, 156, 1, 'ascii');
    header.fill(32, 148, 156);
    const checksum = header.reduce((a,b) => a+b, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    return Buffer.concat([header, body, Buffer.alloc((512 - body.length % 512) % 512)]);
}
function fixture(t, entries) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "Prota 中文 user's archive-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const archive = path.join(root, 'python.tar.gz');
    fs.writeFileSync(archive, gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)])));
    return { root, archive };
}

test('extracts runtime files through Unicode and space-containing staging paths', t => {
    const { root, archive } = fixture(t, [entry('python/', '', '5'), entry('python/python.exe', 'executable'), entry('python/Lib/模块.py', '# utf8')]);
    extractRuntime(archive, root);
    assert.equal(fs.readFileSync(path.join(root, 'python/Lib/模块.py'), 'utf8'), '# utf8');
});

test('honors byte-counted PAX paths', t => {
    const value = 'path=python/Lib/中文.py\n';
    let length = Buffer.byteLength(value) + 3;
    while (Buffer.byteLength(String(length) + ' ' + value) !== length) length = Buffer.byteLength(String(length) + ' ' + value);
    const { root, archive } = fixture(t, [entry('pax', String(length) + ' ' + value, 'x'), entry('placeholder', 'contents')]);
    extractRuntime(archive, root);
    assert.equal(fs.readFileSync(path.join(root, 'python/Lib/中文.py'), 'utf8'), 'contents');
});

test('rejects traversal, Windows absolute paths and links', t => {
    for (const [name,type] of [['../outside','0'],['C:/outside','0'],['python/link','2']]) {
        const { root, archive } = fixture(t, [entry(name, '', type)]);
        assert.throws(() => extractRuntime(archive, root), /Unsafe|Unsupported/);
    }
});

test('rejects corrupt headers before writing files', t => {
    const broken = entry('python/python.exe', 'contents'); broken[1] ^= 1;
    const { root, archive } = fixture(t, [broken]);
    assert.throws(() => extractRuntime(archive, root), /checksum/);
    assert.equal(fs.existsSync(path.join(root, 'python')), false);
});
