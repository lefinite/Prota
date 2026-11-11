import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { userEditBoundary } from '../server/user-edits.mjs';

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-edit-boundary-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const file = path.join(root, 'src/pages/demo/page/v1/index.html');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '<button id="x">旧</button>');
    return { root, file };
}
function create(root) {
    const request = { clientEditId: 'node-test', projectId: 'demo', pageId: 'page', version: 'v1', target: { type: 'page' }, element: { selector: '#x', originalText: '旧', nextText: '新' } };
    return JSON.parse(execFileSync('python3', ['-c', 'import sys,json; from server.copy_edits import EditService; s=EditService(sys.argv[1]); print(json.dumps(s.create(json.loads(sys.argv[2])))); s.close()', root, JSON.stringify(request)], { encoding: 'utf8' }));
}

test('Node Agent boundary queues edits across concurrent runs and drains only after both finish', async t => {
    const { root, file } = await fixture(t);
    await userEditBoundary('start', root, 'run1'); await userEditBoundary('start', root, 'run2');
    assert.equal(create(root).status, 'queued');
    await userEditBoundary('end', root, 'run1');
    assert.equal(await fs.readFile(file, 'utf8'), '<button id="x">旧</button>');
    await userEditBoundary('end', root, 'run2');
    assert.equal(await fs.readFile(file, 'utf8'), '<button id="x">新</button>');
});

test('Node Agent completion reports recoverable conflicts without overwriting Agent source', async t => {
    const { root, file } = await fixture(t);
    assert.equal(create(root).status, 'committed');
    await userEditBoundary('start', root, 'run');
    await fs.writeFile(file, '<button id="x">Agent</button>');
    const result = await userEditBoundary('end', root, 'run');
    assert.equal(result.conflictCount, 1); assert.equal(result.editIds.length, 1);
    assert.equal(await fs.readFile(file, 'utf8'), '<button id="x">Agent</button>');
});

test('Agent boundary fails closed when the protection store cannot be initialized', async t => {
    const { root } = await fixture(t);
    await fs.mkdir(path.join(root, 'data'), { recursive: true });
    await fs.writeFile(path.join(root, 'data/user-edit-assets'), 'blocked');
    await assert.rejects(userEditBoundary('start', root, 'run'));
});
