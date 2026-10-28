import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runtimeInventory, verifyInventory } from '../scripts/pi-integrity.mjs';
import { assertNodeVersion, piVersion, piCliRelative } from '../scripts/pi-paths.mjs';
import { verifyPi } from '../scripts/verify-pi.mjs';

test('Pi minimum Node version checks minor versions numerically', () => {
    for (const version of ['20.20.0', '22.9.0', '22.18.99']) assert.throws(() => assertNodeVersion(version), />=22.19/);
    for (const version of ['22.19.0', '22.20.0', '24.16.0']) assert.doesNotThrow(() => assertNodeVersion(version));
});

test('runtime verification rejects an Extension whose source was not rebuilt', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prota-pi-stale-extension-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    for (const name of [piCliRelative, 'LICENSE.pi', 'extensions/prota-extension.mjs']) {
        fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
        fs.writeFileSync(path.join(directory, name), 'test-fixture');
    }
    const manifest = { ...piVersion, files: runtimeInventory(directory),
        extension: { protocolVersion: 1, sources: { 'integrations/pi/prota-extension.ts': 'invalid-source-hash' } } };
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    await assert.rejects(verifyPi(directory, { smoke: false }), /source changed without rebuilding/);
});

test('Pi runtime inventory detects changed, missing and unexpected files', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prota-pi-integrity-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(path.join(directory, 'chunks'));
    fs.writeFileSync(path.join(directory, 'chunks/runtime.js'), 'original');
    const manifest = { files: runtimeInventory(directory) };
    assert.doesNotThrow(() => verifyInventory(directory, manifest));
    fs.writeFileSync(path.join(directory, 'chunks/runtime.js'), 'tampered');
    assert.throws(() => verifyInventory(directory, manifest), /integrity mismatch/);
    fs.rmSync(path.join(directory, 'chunks/runtime.js'));
    assert.throws(() => verifyInventory(directory, manifest), /integrity mismatch/);
    fs.writeFileSync(path.join(directory, 'chunks/runtime.js'), 'original');
    fs.writeFileSync(path.join(directory, 'injected.js'), 'unexpected');
    assert.throws(() => verifyInventory(directory, manifest), /integrity mismatch/);
});
