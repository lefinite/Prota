import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { PiRpcTransport } from '../server/pi/rpc-transport.mjs';
import { productRoot, piRuntime, piVersion, piCliRelative, assertNodeVersion } from './pi-paths.mjs';
import { verifyInventory } from './pi-integrity.mjs';

export async function smokePi(directory) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'prota-pi-smoke-'));
    const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home,
        PI_CODING_AGENT_DIR: path.join(home, 'config'), PI_OFFLINE: '1', PI_TELEMETRY: '0' };
    for (const name of ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TMP', 'TEMP']) {
        if (process.env[name]) env[name] = process.env[name];
    }
    const child = spawn(process.execPath, [path.join(directory, piCliRelative), '--mode', 'rpc',
        '--no-session', '--no-extensions', '--extension', path.join(directory, 'extensions/prota-extension.mjs'),
        '--no-skills', '--no-mcp', '--no-approve'], {
        cwd: home, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
    });
    const exited = new Promise(resolve => child.once('close', resolve));
    const rpc = new PiRpcTransport(child);
    try {
        const state = await rpc.request('get_state');
        if (!state || state.isStreaming !== false) throw new Error('Unexpected Pi startup state');
        await rpc.request('get_available_models');
        const commands = await rpc.request('get_commands');
        if (!commands.commands.some(command => command.name === 'prota-runtime-status')) {
            throw new Error('Prota Pi Extension did not load');
        }
    } finally {
        child.stdin.end();
        const kill = setTimeout(() => child.kill('SIGKILL'), 5000);
        await exited;
        clearTimeout(kill);
        fs.rmSync(home, { recursive: true, force: true });
    }
}

export async function verifyPi(directory = piRuntime, { smoke = true } = {}) {
    assertNodeVersion();
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.commit !== piVersion.commit || manifest.version !== piVersion.version) {
        throw new Error('Pi runtime does not match pi-version.json; run npm run pi:build');
    }
    verifyInventory(directory, manifest);
    if (!manifest.files[piCliRelative] || !manifest.files['LICENSE.pi']
        || !manifest.files['extensions/prota-extension.mjs']) throw new Error('Incomplete Pi runtime');
    if (manifest.extension?.protocolVersion !== 1 || !manifest.extension.sources?.['integrations/pi/prota-extension.ts']) {
        throw new Error('Pi runtime lacks its Prota Extension build record; run npm run pi:build');
    }
    for (const [name, hash] of Object.entries(manifest.extension.sources)) {
        const relative = path.relative(productRoot, path.resolve(productRoot, name));
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid Pi Extension source path');
        const actual = createHash('sha256').update(fs.readFileSync(path.join(productRoot, name))).digest('hex');
        if (actual !== hash) throw new Error(`Prota Extension source changed without rebuilding Pi: ${name}`);
    }
    if (smoke) await smokePi(directory);
    return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    await verifyPi();
    console.log(`Pi ${piVersion.version} integrity and RPC smoke verified (${piVersion.commit})`);
}
