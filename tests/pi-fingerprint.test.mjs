import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { agentBuild } from '../server/agent-build.mjs';

test('Gateway build identity changes for Pi adapter, extension, upstream pin and runtime changes', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prota-build-id-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const name of ['server/agent-server.mjs', 'server/pi/runtime-manager.mjs',
        'integrations/pi/prota-extension.ts', 'pi-version.json', 'runtime/pi/manifest.json',
        'scripts/verify-pi.mjs']) {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        fs.writeFileSync(path.join(root, name), 'original');
    }
    const original = agentBuild(root);
    for (const name of ['server/pi/runtime-manager.mjs', 'integrations/pi/prota-extension.ts',
        'pi-version.json', 'runtime/pi/manifest.json', 'scripts/verify-pi.mjs']) {
        fs.writeFileSync(path.join(root, name), 'updated');
        assert.notEqual(agentBuild(root), original, name);
        fs.writeFileSync(path.join(root, name), 'original');
        assert.equal(agentBuild(root), original);
    }
    const moved = `${root}-moved`;
    fs.cpSync(root, moved, { recursive: true });
    t.after(() => fs.rmSync(moved, { recursive: true, force: true }));
    assert.equal(agentBuild(moved), original, 'Installation path must not change build identity');
});
