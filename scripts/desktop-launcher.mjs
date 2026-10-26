import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveVercelCLI } from '../server/vercel-cli.mjs';
import { extractRuntime } from './runtime-archive.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const windows = process.platform === 'win32';
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const config = process.env.READIFY_CONFIG_DIR || path.join(os.homedir(), '.config/prota');
const runtime = path.join(config, 'runtime');
const statusFile = process.argv[2];
const bridgePort = Number(process.env.READIFY_PORT || 8080);
const agentPort = Number(process.env.READIFY_AGENT_PORT || 8081);
const bridgeBase = 'http://127.0.0.1:' + bridgePort;
const agentBase = 'http://127.0.0.1:' + agentPort;
let visible = false;
let currentStep = 1;
try { visible = Boolean(JSON.parse(fs.readFileSync(statusFile)).show); } catch {}
export function fingerprint(directory) {
    return crypto.createHash('sha256').update(['package.json', 'package-lock.json', 'scripts/install-vercel-cli.mjs', 'tools/vercel-runtime/package.json'].map(file => fs.readFileSync(path.join(directory, file))).join('\n')).digest('hex');
}
export function dependenciesReady(directory, installedFingerprint) {
    try {
        const lock = JSON.parse(fs.readFileSync(path.join(directory, 'package-lock.json')));
        for (const name of ['@codeany/open-agent-sdk', 'playwright']) {
            const installed = JSON.parse(fs.readFileSync(path.join(directory, 'node_modules', name, 'package.json')));
            if (installed.version !== lock.packages['node_modules/' + name].version) return false;
        }
        resolveVercelCLI(directory);
        return !installedFingerprint || installedFingerprint === fingerprint(directory);
    } catch { return false; }
}
function status(step, title, detail, show = false, state = 'preparing') {
    currentStep = step;
    visible ||= show;
    if (statusFile) {
        fs.writeFileSync(statusFile + '.next', JSON.stringify({ step, title, detail, show: visible, state }));
        fs.renameSync(statusFile + '.next', statusFile);
    }
}
function execute(command, args, options = {}) {
    const result = spawnSync(command, args, { encoding: 'utf8', detached: !windows, windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...options });
    if (result.error?.code === 'ETIMEDOUT') {
        if (windows) spawnSync('taskkill.exe', ['/PID', String(result.pid), '/T', '/F'], { windowsHide: true });
        else { try { process.kill(-result.pid, 'SIGTERM'); } catch {} }
    }
    if (result.error || result.status !== 0) throw Error('准备未完成。请检查网络，并确认产品文件夹可以写入后重试。');
    return result.stdout;
}
function download(url, target) {
    execute(windows ? path.join(process.env.SystemRoot, 'System32/curl.exe') : '/usr/bin/curl', ['-fLsS', '--retry', '2', '--connect-timeout', '20', '--max-time', '600', url, '-o', target]);
}
export function selectPythonAsset(release, arch, platform = process.platform) {
    if (!['arm64', 'x64'].includes(arch) || !['darwin', 'win32'].includes(platform)) return undefined;
    const target = arch === 'arm64' ? 'aarch64' : 'x86_64';
    const triple = platform === 'win32' ? 'pc-windows-msvc' : 'apple-darwin';
    return release.assets.find(asset => new RegExp(`^cpython-3\\.13\\.[0-9]+\\+.+-${target}-${triple}-install_only_stripped\\.tar\\.gz$`).test(asset.name));
}
export function npmEntry(node, platform = process.platform) {
    return path.resolve(path.dirname(node), platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : '../lib/node_modules/npm/bin/npm-cli.js');
}
export async function pythonRuntime(candidates = windows ? [path.join(runtime, 'python/python.exe')] : [path.join(runtime, 'python/bin/python3'), '/opt/homebrew/bin/python3', '/usr/local/bin/python3']) {
    fs.mkdirSync(runtime, { recursive: true });
    for (const binary of candidates) {
        if (!fs.existsSync(binary)) continue;
        const result = spawnSync(binary, ['-c', 'import ssl,http.server,sys;sys.exit(0 if sys.version_info >= (3,9) else 1)'], { windowsHide: true });
        if (result.status === 0) return binary;
    }
    status(2, '准备 Python 环境', '正在下载产品专用运行环境，不会修改系统 Python。', true);
    const temporary = fs.mkdtempSync(path.join(runtime, 'python-download-'));
    try {
        const metadata = path.join(temporary, 'release.json');
        download('https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest', metadata);
        const release = JSON.parse(fs.readFileSync(metadata));
        const asset = selectPythonAsset(release, process.arch);
        if (!asset) throw Error('暂时没有适用于这台电脑的 Python 环境，请稍后重试。');
        const archive = path.join(temporary, 'python.tar.gz'); download(asset.browser_download_url, archive);
        let expected = asset.digest?.replace(/^sha256:/, '');
        if (!expected) {
            const checksum = release.assets.find(item => item.name === asset.name + '.sha256');
            if (!checksum) throw Error('Python 下载缺少校验信息，请稍后重试。');
            const checksumPath = path.join(temporary, 'checksum'); download(checksum.browser_download_url, checksumPath);
            expected = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
        }
        const actual = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
        if (!/^[a-f0-9]{64}$/.test(expected) || actual !== expected) throw Error('Python 下载校验未通过，请重试。');
        if (windows) extractRuntime(archive, temporary);
        else execute('/usr/bin/tar', ['-xzf', archive, '-C', temporary]);
        const relativeBinary = windows ? 'python.exe' : 'bin/python3';
        const binary = path.join(temporary, 'python', relativeBinary);
        execute(binary, ['-c', 'import ssl, http.server, sys;assert sys.version_info >= (3,9)']);
        const destination = path.join(runtime, 'python');
        if (fs.existsSync(destination)) fs.renameSync(destination, path.join(temporary, 'previous-python'));
        fs.renameSync(path.join(temporary, 'python'), destination);
        return path.join(destination, relativeBinary);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
async function request(url) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1200) }); return response.ok ? await response.json() : null; } catch { return null; }
}
function child(command, args, logFile, env) {
    const log = fs.openSync(logFile, 'a');
    const process = spawn(command, args, { cwd: root, env, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
    process.unref(); fs.closeSync(log); return process.pid;
}
async function releaseOwnedPort(port, entry) {
    if (windows) {
        execute(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/windows-ports.ps1'), String(port), path.join(root, entry)]);
        return;
    }
    const listeners = spawnSync('/usr/sbin/lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim().split(/\s+/).filter(Boolean);
    for (const pid of new Set(listeners)) {
        const cwd = spawnSync('/usr/sbin/lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).stdout.split('\n').find(line => line.startsWith('n'))?.slice(1);
        const command = spawnSync('/bin/ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8' }).stdout;
        const decoded = cwd?.replace(/(?:\\x[0-9a-f]{2})+/gi, value => Buffer.from(value.replace(/\\x/g, ''), 'hex').toString('utf8')).normalize('NFC');
        if (decoded !== fs.realpathSync(root).normalize('NFC') || !command.includes(entry)) throw Error('本机 ' + port + ' 端口被其他程序占用，请关闭该程序后重试。');
        process.kill(Number(pid), 'SIGTERM');
    }
    for (let attempt = 0; attempt < 30; attempt++) {
        const result = spawnSync('/usr/sbin/lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' });
        if (!result.stdout.trim()) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('上一份 Prota 尚未退出，请稍后重试。');
}

async function main() {
    fs.mkdirSync(runtime, { recursive: true });
    // A directory lock serializes double clicks without touching business files.
    const lock = path.join(runtime, 'launch.lock');
    try { fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'pid'), String(process.pid)); }
    catch {
        try { process.kill(Number(fs.readFileSync(path.join(lock, 'pid'))), 0); return; }
        catch { fs.rmSync(lock, { recursive: true, force: true }); fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'pid'), String(process.pid)); }
    }
    try {
        const nodeDir = path.dirname(process.execPath);
        process.env.PATH = nodeDir + path.delimiter + process.env.PATH;
        if (!windows) process.env.SSL_CERT_FILE ||= '/etc/ssl/cert.pem';
        process.env.PYTHONUTF8 = '1';
        const python = await pythonRuntime();
        const installState = path.join(runtime, 'installation-' + crypto.createHash('sha256').update(root).digest('hex').slice(0, 16) + '.json');
        let previous; try { previous = JSON.parse(fs.readFileSync(installState)).fingerprint; } catch {}
        if (!dependenciesReady(root, previous)) {
            const activeAgent = await request(agentBase + '/api/agent/health');
            if (activeAgent?.activeRuns) throw Error('Prota 正在生成内容，请完成当前任务后再准备依赖。');
            status(3, '准备产品依赖', '自动安装所需组件和最新版分享工具，完成后继续打开工作台。', true);
            execute(process.execPath, [npmEntry(process.execPath), 'ci', '--no-audit', '--no-fund', '--fetch-retries=1', '--fetch-timeout=60000'], { cwd: root, env: process.env, stdio: 'inherit', timeout: 900000 });
            if (!dependenciesReady(root)) throw Error('依赖安装不完整，请重试。');
        }
        fs.writeFileSync(installState, JSON.stringify({ fingerprint: fingerprint(root) }));
        status(4, '打开工作台', '运行环境已就绪，正在启动本机服务。');
        const identity = crypto.createHash('sha256').update(fs.realpathSync(root)).digest('hex');
        const health = await request(bridgeBase + '/api/product/health');
        let agent = await request(agentBase + '/api/agent/health');
        const bridgeBuild = crypto.createHash('sha256').update(Buffer.concat(['server/bridge.py', 'server/deployer.py', 'server/vercel_setup.py', 'server/share_security.py', 'server/share_gateway.mjs', 'server/share_gate_page.mjs', 'server/share_manager.py'].map(file => fs.readFileSync(path.join(root, file))))).digest('hex');
        const agentBuild = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'server/agent-server.mjs'))).digest('hex');
        const environment = { ...process.env, READIFY_AGENT_HOST: '127.0.0.1' };
        fs.mkdirSync(path.join(root, 'logs'), { recursive: true });
        // Initialize once before Python and Node can both create a new workspace.
        execute(python, ['-c', 'from server.workspace import workspace_root; workspace_root()'], { cwd: root, env: environment });
        if (health?.installation !== identity || health?.build !== bridgeBuild) {
            if (agent?.activeRuns) throw Error('Prota 正在生成内容，请完成当前任务后再重新启动。');
            await releaseOwnedPort(bridgePort, 'server/bridge.py');
            child(python, [path.join(root, 'server/bridge.py')], path.join(root, 'logs/bridge.log'), environment);
        }
        agent = await request(agentBase + '/api/agent/health');
        if (agent?.installation !== identity || agent?.build !== agentBuild) {
            if (agent?.activeRuns) throw Error('Prota 正在生成内容，请完成当前任务后再重新启动。');
            await releaseOwnedPort(agentPort, 'server/agent-server.mjs');
            child(process.execPath, ['--env-file-if-exists=.env', path.join(root, 'server/agent-server.mjs')], path.join(root, 'logs/agent-server.log'), environment);
        }
        for (let attempt = 0; attempt < 60; attempt++) {
            const bridge = await request(bridgeBase + '/api/product/health');
            if (bridge?.installation === identity && await request(agentBase + '/api/agent/health')) {
                if (!process.env.PROTA_NO_OPEN) {
                    if (windows) execute(powershell, ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process "' + bridgeBase + '/portal/index.html"']);
                    else execute('/usr/bin/open', [bridgeBase + '/portal/index.html']);
                }
                status(4, '已就绪', '', false, 'ready'); return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw Error('本机服务未能启动，请重试；详细信息已保存到本机日志。');
    } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main().catch(error => { status(currentStep, '启动未完成', error.message, true, 'error'); process.exitCode = 1; });
