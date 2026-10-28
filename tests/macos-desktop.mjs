import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { agentBuild } from '../server/agent-build.mjs';

if (process.platform !== 'darwin') throw new Error('This desktop acceptance test requires macOS');
const source = fileURLToPath(new URL('..', import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "Prota 中文 user's desktop-"));
const suppliedProduct = process.env.PROTA_TEST_PRODUCT;
const nativeApp = process.env.PROTA_TEST_NATIVE_APP === '1';
const product = suppliedProduct ? path.resolve(suppliedProduct) : path.join(temporary, 'product');
const config = path.join(temporary, 'config');
fs.mkdirSync(config);
if (!suppliedProduct) {
    fs.mkdirSync(product);
    const archive = path.join(temporary, 'product.tar');
    execFileSync('git', ['archive', '--format=tar', '-o', archive, 'HEAD'], { cwd: source });
    execFileSync('/usr/bin/tar', ['-xf', archive, '-C', product]);
    fs.cpSync(path.join(source, 'runtime/pi'), path.join(product, 'runtime/pi'), { recursive: true, verbatimSymlinks: true });
}
async function availablePort() {
    const server = http.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}
const bridgePort = await availablePort(), agentPort = await availablePort();
const env = { ...process.env, READIFY_CONFIG_DIR: config, READIFY_PORT: String(bridgePort),
    READIFY_AGENT_PORT: String(agentPort), PROTA_NO_OPEN: '1' };
const nativeCache = path.join(temporary, 'native-launcher');
if (nativeApp) Object.assign(env, { PROTA_LAUNCHER_CACHE_DIR: nativeCache, PROTA_LAUNCHER_TEST_UI: '1' });
delete env.READIFY_WORKSPACE;
const status = path.join(temporary, 'status.json');
const endpoint = port => `http://127.0.0.1:${port}`;
const get = async url => (await fetch(url)).json();
let runningLauncher;
async function launch(cold = false) {
    const before = nativeApp && fs.existsSync(nativeCache) ? new Set(fs.readdirSync(nativeCache)) : new Set();
    const args = nativeApp ? [path.join(product, 'Prota.app/Contents/MacOS/Prota')]
        : [path.join(product, 'scripts/bootstrap-macos.sh'), product, status];
    runningLauncher = spawn('/bin/bash', args,
        { cwd: product, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(temporary, 'launcher.log'), { flags: 'a' });
    runningLauncher.stdout.pipe(log); runningLauncher.stderr.pipe(log);
    const exit = new Promise((resolve, reject) => {
        runningLauncher.once('error', reject);
        runningLauncher.once('exit', code => code === 0 ? resolve() : reject(new Error(`Launcher exited ${code}; diagnostics ${temporary}`)));
    });
    const timeout = setTimeout(() => process.kill(-runningLauncher.pid, 'SIGTERM'), 15 * 60_000);
    try { await exit; } finally { clearTimeout(timeout); log.end(); }
    if (nativeApp) {
        const entries = fs.readdirSync(nativeCache).filter(name => !before.has(name));
        const results = entries.filter(name => name.endsWith('.result'));
        assert.equal(results.length, 1, 'Native app must retain exactly one test preparation result');
        fs.copyFileSync(path.join(nativeCache, results[0]), status);
        assert.equal(entries.some(name => name.endsWith('.ui')), cold,
            cold ? 'Cold launch must show the actual Cocoa preparation window' : 'Healthy launch must not show preparation UI');
    }
    assert.equal(JSON.parse(fs.readFileSync(status)).state, 'ready');
    const bridge = await get(endpoint(bridgePort) + '/api/product/health');
    const agent = await get(endpoint(agentPort) + '/api/agent/health');
    assert.equal(agent.installation, bridge.installation);
    assert.equal(agent.build, agentBuild(product));
}
function listener(port) {
    const pids = execFileSync('/usr/sbin/lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split(/\s+/);
    assert.equal(pids.length, 1);
    return Number(pids[0]);
}
const adapter = path.join(product, 'server/pi/event-adapter.mjs');
const originalAdapter = fs.readFileSync(adapter);
try {
    await launch(true);
    const manifest = fs.readFileSync(path.join(product, 'runtime/pi/manifest.json'));
    const vercel = path.join(product, 'node_modules/.prota-vercel/node_modules/vercel/package.json');
    const installedAt = fs.statSync(vercel).mtimeMs;
    const projectsFile = path.join(config, 'workspace/data/projects.json');
    const projects = fs.readFileSync(projectsFile);
    const firstAgent = listener(agentPort), firstBridge = listener(bridgePort);
    await launch();
    assert.equal(listener(agentPort), firstAgent);
    assert.equal(fs.statSync(vercel).mtimeMs, installedAt);
    assert.deepEqual(fs.readFileSync(path.join(product, 'runtime/pi/manifest.json')), manifest);
    fs.appendFileSync(adapter, '\n// isolated Pi adapter update acceptance test\n');
    await launch();
    assert.notEqual(listener(agentPort), firstAgent);
    assert.equal(listener(bridgePort), firstBridge);
    assert.deepEqual(fs.readFileSync(projectsFile), projects);
    assert.deepEqual(fs.readFileSync(path.join(product, 'runtime/pi/manifest.json')), manifest);
    assert.equal(fs.statSync(vercel).mtimeMs, installedAt);
    console.log('macOS cold product startup, warm reuse and Pi adapter service restart passed.');
    if (nativeApp) console.log('Native .app entry, Cocoa preparation window visibility and warm-launch UI suppression passed.');
    console.log('Diagnostics: ' + temporary);
} finally {
    fs.writeFileSync(adapter, originalAdapter);
    for (const port of [agentPort, bridgePort]) {
        try {
            const pid = listener(port);
            const command = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
            if (command.includes(product)) process.kill(pid, 'SIGTERM');
        } catch {}
    }
}
