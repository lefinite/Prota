import { canvasPersistence } from './canvas-autosave.mjs';
import { mergePiCommands } from './pi/command-registry.mjs';
import { buildConnectionProbe } from './pi/connection-probe.mjs';
import { ensureRunPreview, previewRunMetadata } from './preview/lifecycle.mjs';
import http from 'http';
import { discoverProviderModels } from './provider-models.mjs';
import { configDirectory, getWorkspaceRoot, workspaceLocked } from './workspace.mjs';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash, randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { piVersion } from '../scripts/pi-paths.mjs';
import { ProtaPiGateway } from './pi/gateway-adapter.mjs';
import { agentBuild } from './agent-build.mjs';
import { ensureEngineInfo, sessionPaths, synchronizeEngineInfo } from './pi/session-adapter.mjs';
import { knownSecrets, redactSecrets } from './pi/secrets.mjs';
import { configuredMcpSecrets, enabledMcpTools } from './pi/mcp-adapter.mjs';
import { resolveExecutionSkill } from './pi/skill-adapter.mjs';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PRODUCT_AGENT_BUILD = agentBuild(ROOT_DIR);
const PORT = Number.parseInt(process.env.READIFY_AGENT_PORT || '8081', 10);
const HOST = process.env.READIFY_AGENT_HOST || '127.0.0.1';
const PROVIDER_PRESETS_PATH = path.join(ROOT_DIR, 'data', 'agent-provider-presets.json');
const AGENT_SDK_EXTENSION_PATH = path.join(ROOT_DIR, 'data', 'agent-sdk-extension.mjs');
const PROJECT_SKILLS_DIR = path.join(ROOT_DIR, '.claude', 'skills');
const PROJECT_SKILL_STATE_PATH = path.join(PROJECT_SKILLS_DIR, '.readify-skills.json');
const TEMPLATE_SYSTEMS_DIR = path.join(ROOT_DIR, 'src', 'templates', 'design-systems');
const TEMPLATE_FRAMEWORK_SKILLS_DIR = path.join(ROOT_DIR, 'src', 'templates', 'framework-skills');
const LEGACY_TEMPLATE_DATA_PATH = path.join(ROOT_DIR, 'data', 'templates.json');
const TEMPLATE_STATE_PATH = path.join(configDirectory, 'template-states.json');
const HEARTBEAT_INTERVAL_MS = 8000;
const SIMULATION_STEP_DELAY_MS = 420;
const MAX_AGENT_IMAGE_ATTACHMENTS = 4;
const MAX_AGENT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SESSION_TITLE_CHARS = 10;
const SESSION_TITLE_FALLBACK = '新会话';
// 命名专用小模型：与主对话模型解耦，快且便宜
const SESSION_TITLE_MODEL = 'glm-5.3-flash';
// 部分模型（如 glm-5.3）带思考输出，maxTokens 太小会导致返回空文本
const SESSION_TITLE_MAX_TOKENS = 512;
const DEFAULT_SESSION_PAGE_SIZE = 30;
const MAX_SESSION_PAGE_SIZE = 100;
const SESSION_PERSIST_DEBOUNCE_MS = 300;
const CHECKPOINT_RECENT_SESSION_LIMIT = 5;
const CHECKPOINTS_PER_SESSION_LIMIT = 3;
const CHECKPOINT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CHECKPOINT_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
const CHECKPOINT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const CHECKPOINT_TEXT_EXTENSIONS = new Set([
    '.cjs', '.css', '.csv', '.env', '.gitignore', '.html', '.js', '.json', '.jsx',
    '.md', '.mjs', '.mts', '.py', '.sh', '.svg', '.toml', '.ts', '.tsx', '.txt',
    '.xml', '.yaml', '.yml'
]);
const CHECKPOINT_EXCLUDED_DIRS = new Set([
    '.cache',
    '.git',
    '.next',
    'coverage',
    'dist',
    'node_modules'
]);
const CHECKPOINT_EXCLUDED_PREFIXES = [
    '.agents/',
    '.claude/skills/',
    '.codex/',
    'assets/',
    'data/agent-checkpoints/',
    'data/agent-sessions/',
    'data/agent-uploads/',
    'data/temp/',
    'shares/',
    'logs/'
];
const SUPPORTED_AGENT_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const CONFIGURED_AGENT_REQUEST_TIMEOUT_MS = Number.parseInt(
    process.env.READIFY_AGENT_REQUEST_TIMEOUT_MS || '',
    10
);
const DEFAULT_AGENT_REQUEST_TIMEOUT_MS = Number.isFinite(CONFIGURED_AGENT_REQUEST_TIMEOUT_MS) && CONFIGURED_AGENT_REQUEST_TIMEOUT_MS > 0
    ? CONFIGURED_AGENT_REQUEST_TIMEOUT_MS
    : 20 * 60 * 1000;
const MIN_AGENT_REQUEST_TIMEOUT_MS = 30 * 1000;
const MAX_AGENT_REQUEST_TIMEOUT_MS = 60 * 60 * 1000;
const CONFIGURED_AGENT_MAX_TURNS = Number.parseInt(process.env.READIFY_AGENT_MAX_TURNS || '', 10);
const DEFAULT_AGENT_MAX_TURNS = Number.isFinite(CONFIGURED_AGENT_MAX_TURNS) && CONFIGURED_AGENT_MAX_TURNS > 0
    ? CONFIGURED_AGENT_MAX_TURNS
    : 200;
const MIN_SKILL_AGENT_MAX_TURNS = 60;
const MIN_AGENT_MAX_TURNS = 1;
const MAX_AGENT_MAX_TURNS = 200;
const READIFY_RUNTIME_OPTION_KEYS = new Set([
    'requestTimeoutMs',
    'providerTimeoutMs',
    'timeoutMs',
    'timeout'
]);
const SDK_JSON_OPTION_KEYS = new Set([
    'apiType',
    'model',
    'apiKey',
    'baseURL',
    'cwd',
    'systemPrompt',
    'appendSystemPrompt',
    'tools',
    'allowedTools',
    'disallowedTools',
    'permissionMode',
    'canUseTool',
    'maxTurns',
    'maxBudgetUsd',
    'thinking',
    'maxThinkingTokens',
    'jsonSchema',
    'outputFormat',
    'mcpServers',
    'agents',
    'hooks',
    'maxTokens',
    'effort',
    'reasoningEffort',
    'fallbackModel',
    'continue',
    'resume',
    'forkSession',
    'persistSession',
    'sessionId',
    'enableFileCheckpointing',
    'includePartialMessages',
    'abortController',
    'abortSignal',
    'sandbox',
    'settingSources',
    'env',
    'plugins',
    'additionalDirectories',
    'agent',
    'debug',
    'debugFile',
    'toolConfig',
    'promptSuggestions',
    'strictMcpConfig',
    'extraArgs',
    'betas',
    'permissionPromptToolName',
    'requestTimeoutMs',
    'providerTimeoutMs',
    'timeoutMs',
    'timeout'
]);
const SDK_QUERY_OPTION_KEYS = new Set([
    'apiType',
    'model',
    'apiKey',
    'baseURL',
    'cwd',
    'systemPrompt',
    'appendSystemPrompt',
    'tools',
    'allowedTools',
    'disallowedTools',
    'permissionMode',
    'canUseTool',
    'maxTurns',
    'maxBudgetUsd',
    'thinking',
    'maxThinkingTokens',
    'jsonSchema',
    'outputFormat',
    'mcpServers',
    'agents',
    'hooks',
    'maxTokens',
    'effort',
    'reasoningEffort',
    'fallbackModel',
    'includePartialMessages',
    'abortController',
    'abortSignal',
    'sandbox',
    'settingSources',
    'env',
    'plugins',
    'additionalDirectories',
    'agent',
    'debug',
    'debugFile',
    'toolConfig',
    'promptSuggestions',
    'strictMcpConfig',
    'extraArgs',
    'betas',
    'permissionPromptToolName',
    'requestTimeoutMs',
    'providerTimeoutMs',
    'timeoutMs',
    'timeout'
]);
const SESSION_STREAM_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Accel-Buffering': 'no'
};

const localSkills = new Map();
const localCommands = new Map();
const autoDiscoveredSkills = new Map();
let lastProjectSkillRefreshAt = 0;
const providerPresets = await loadProviderPresets();
await registerBuiltInSkills();
await refreshProjectSkills({ force: true });
const agentSdkExtension = await loadAgentSdkExtension();

const sessions = new Map();
const scheduledSessionPersists = new Map();
const pendingWorkspaceWrites = new Set();
const piGateway = new ProtaPiGateway({ workspaceRoot: getWorkspaceRoot, configDirectory });
try { await hydratePersistedSessions(); await pruneCheckpoints(); }
catch (error) { console.warn('[agent-gateway] 工作区暂不可用，可在设置中重新定位。', error.message); }

function logInfo(message, extra = '') {
    const suffix = extra ? ` ${extra}` : '';
    console.log(`[agent-gateway] ${message}${suffix}`);
}

function createDefaultRunState() {
    return {
        status: 'disconnected',
        active: false,
        runId: null,
        descriptor: null,
        currentTool: null,
        startedAt: null,
        finishedAt: null,
        lastActivityAt: null,
        stageMessage: '尚未建立会话',
        lastError: null,
        lastSummary: null,
        lastDescriptor: null,
        lastTaskDescriptor: null,
        partialAssistantText: '',
        partialAssistantEventId: null
    };
}

function getSessionFilePath(sessionId) {
    return path.join(path.join(getWorkspaceRoot(), 'data', 'agent-sessions'), `${sessionId}.json`);
}

function getCheckpointDir(sessionId, runId) {
    return path.join(path.join(getWorkspaceRoot(), 'data', 'agent-checkpoints'), sessionId, runId);
}

function getCheckpointFilePath(sessionId, runId) {
    return path.join(getCheckpointDir(sessionId, runId), 'checkpoint.json');
}

function getRestoreSnapshotFilePath(sessionId, runId, mode = 'single') {
    return path.join(getCheckpointDir(sessionId, runId), `restore-${mode}.json`);
}

function toPosixRelativePath(absolutePath) {
    return path.relative(getWorkspaceRoot(), absolutePath).split(path.sep).join('/');
}

function resolveWorkspacePath(relativePath) {
    const normalized = path.posix.normalize(String(relativePath || '').replace(/\\/g, '/'));
    if (!normalized || normalized === '.' || normalized.startsWith('../') || path.isAbsolute(normalized)) {
        throw createClassifiedError(`非法文件路径：${relativePath}`, 'invalid_path', 400);
    }
    const absolutePath = path.resolve(getWorkspaceRoot(), normalized);
    if (!absolutePath.startsWith(getWorkspaceRoot() + path.sep) && absolutePath !== getWorkspaceRoot()) {
        throw createClassifiedError(`文件路径超出工作区：${relativePath}`, 'invalid_path', 400);
    }
    return { relativePath: normalized, absolutePath };
}

function hashBuffer(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

function isCheckpointExcludedRelative(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/');
    return CHECKPOINT_EXCLUDED_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

function isCheckpointEligibleFile(relativePath, stat) {
    if (!relativePath || isCheckpointExcludedRelative(relativePath)) return false;
    if (!stat?.isFile?.()) return false;
    if (stat.size > CHECKPOINT_MAX_FILE_BYTES) return false;
    const baseName = path.posix.basename(relativePath);
    const ext = path.posix.extname(relativePath).toLowerCase();
    return CHECKPOINT_TEXT_EXTENSIONS.has(ext) || CHECKPOINT_TEXT_EXTENSIONS.has(baseName);
}

async function walkCheckpointFiles(dir = getWorkspaceRoot(), output = []) {
    let entries = [];
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return output;
    }

    for (const entry of entries) {
        const absolutePath = path.join(dir, entry.name);
        const relativePath = toPosixRelativePath(absolutePath);
        if (entry.isDirectory()) {
            if (CHECKPOINT_EXCLUDED_DIRS.has(entry.name) || isCheckpointExcludedRelative(`${relativePath}/`)) {
                continue;
            }
            await walkCheckpointFiles(absolutePath, output);
            continue;
        }
        if (!entry.isFile()) continue;
        let stat = null;
        try {
            stat = await fs.stat(absolutePath);
        } catch {
            continue;
        }
        if (isCheckpointEligibleFile(relativePath, stat)) {
            output.push({ relativePath, absolutePath, stat });
        }
    }
    return output;
}

function createCheckpointScope(session) {
    const context = session?.context || {};
    if (context.globalContext || inferSessionScope(session) === 'global') {
        return {
            kind: 'workspace',
            roots: [
                'src',
                'server',
                'scripts',
                'tests',
                'tools',
                'docs',
                'data/projects.json',
                'data/templates.json',
                'portal/shell.js',
                'portal/shell.css',
                'portal/index.html',
                'package.json',
                'package-lock.json',
                'README.md',
                'AGENTS.md'
            ]
        };
    }
    return {
        kind: 'page',
        roots: [
            path.posix.join('src', 'pages', context.projectId || 'readify', context.pageId || ''),
            'data/projects.json',
            'portal/shell.js',
            'portal/shell.css',
            'portal/index.html'
        ]
    };
}

async function collectCheckpointFiles(scope = null) {
    if (!scope?.roots?.length) return walkCheckpointFiles();
    const output = [];
    const seen = new Set();
    for (const relativeRoot of scope.roots) {
        let resolved;
        try {
            resolved = resolveWorkspacePath(relativeRoot);
        } catch {
            continue;
        }
        let stat;
        try {
            stat = await fs.stat(resolved.absolutePath);
        } catch (error) {
            if (error?.code === 'ENOENT') continue;
            throw error;
        }
        const candidates = stat.isDirectory()
            ? await walkCheckpointFiles(resolved.absolutePath, [])
            : [{ relativePath: resolved.relativePath, absolutePath: resolved.absolutePath, stat }];
        for (const candidate of candidates) {
            if (seen.has(candidate.relativePath) || !isCheckpointEligibleFile(candidate.relativePath, candidate.stat)) continue;
            seen.add(candidate.relativePath);
            output.push(candidate);
        }
    }
    return output;
}

async function readCheckpointFileRecord(relativePath, absolutePath, stat = null, { includeContent = false } = {}) {
    const effectiveStat = stat || await fs.stat(absolutePath);
    const content = await fs.readFile(absolutePath);
    return {
        path: relativePath,
        size: effectiveStat.size,
        mtimeMs: Math.round(effectiveStat.mtimeMs),
        sha256: hashBuffer(content),
        ...(includeContent ? { contentBase64: content.toString('base64') } : {})
    };
}

async function createRunCheckpoint(session, runId, descriptor) {
    if (session.activeRun) {
        session.activeRun.canvasPersistence = { root: getWorkspaceRoot(), context: { ...session.context } };
        await canvasPersistence('begin', getWorkspaceRoot(), session.context, runId);
    }
    const checkpointDir = getCheckpointDir(session.id, runId);
    await fs.mkdir(checkpointDir, { recursive: true });
    const scope = createCheckpointScope(session);
    const files = await collectCheckpointFiles(scope);
    const records = {};
    for (const file of files) {
        try {
            records[file.relativePath] = await readCheckpointFileRecord(
                file.relativePath,
                file.absolutePath,
                file.stat,
                { includeContent: true }
            );
        } catch (error) {
            console.warn(`[agent-gateway] Failed to checkpoint ${file.relativePath}:`, error?.message || error);
        }
    }
    const checkpoint = {
        version: 2,
        sessionId: session.id,
        runId,
        checkpointId: runId,
        createdAt: new Date().toISOString(),
        descriptor: {
            kind: descriptor?.kind || '',
            title: descriptor?.title || '',
            summary: descriptor?.summary || ''
        },
        rootDir: getWorkspaceRoot(),
        scope,
        fileCount: Object.keys(records).length,
        files: records
    };
    await fs.writeFile(getCheckpointFilePath(session.id, runId), JSON.stringify(checkpoint, null, 2));
    return checkpoint;
}

async function readRunCheckpoint(sessionId, runId) {
    const raw = await fs.readFile(getCheckpointFilePath(sessionId, runId), 'utf8');
    return JSON.parse(raw);
}

async function getDirectorySize(dir) {
    let total = 0;
    let entries = [];
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return 0;
    }
    for (const entry of entries) {
        const target = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            total += await getDirectorySize(target);
        } else if (entry.isFile()) {
            try {
                total += (await fs.stat(target)).size;
            } catch { /* ignore files removed during cleanup */ }
        }
    }
    return total;
}

async function listStoredCheckpoints() {
    let sessionEntries = [];
    try {
        sessionEntries = await fs.readdir(path.join(getWorkspaceRoot(), 'data', 'agent-checkpoints'), { withFileTypes: true });
    } catch {
        return [];
    }
    const records = [];
    for (const sessionEntry of sessionEntries) {
        if (!sessionEntry.isDirectory()) continue;
        const sessionId = sessionEntry.name;
        let runEntries = [];
        try {
            runEntries = await fs.readdir(path.join(path.join(getWorkspaceRoot(), 'data', 'agent-checkpoints'), sessionId), { withFileTypes: true });
        } catch {
            continue;
        }
        for (const runEntry of runEntries) {
            if (!runEntry.isDirectory()) continue;
            const runId = runEntry.name;
            const dir = getCheckpointDir(sessionId, runId);
            try {
                const stat = await fs.stat(getCheckpointFilePath(sessionId, runId));
                records.push({
                    sessionId,
                    runId,
                    dir,
                    createdAtMs: stat.mtimeMs,
                    size: await getDirectorySize(dir)
                });
            } catch { /* ignore incomplete checkpoint directories */ }
        }
    }
    return records;
}

async function removeStoredCheckpoint(record) {
    if (!record?.sessionId || !record?.runId) return;
    const target = getCheckpointDir(record.sessionId, record.runId);
    if (!target.startsWith(path.join(getWorkspaceRoot(), 'data', 'agent-checkpoints') + path.sep)) return;
    await fs.rm(target, { recursive: true, force: true });
}

async function pruneCheckpoints() {
    const records = await listStoredCheckpoints();
    if (!records.length) return { removed: 0, bytesFreed: 0, remainingBytes: 0 };

    const recentSessionIds = new Set(
        Array.from(sessions.values())
            .map((session) => createSessionListItem(session))
            .sort(compareSessionListItems)
            .slice(0, CHECKPOINT_RECENT_SESSION_LIMIT)
            .map((item) => item.id)
    );
    const activeKeys = new Set(
        Array.from(sessions.values())
            .filter((session) => !session._summaryOnly && session.activeRun?.id)
            .map((session) => `${session.id}/${session.activeRun.id}`)
    );
    const grouped = new Map();
    records.forEach((record) => {
        const group = grouped.get(record.sessionId) || [];
        group.push(record);
        grouped.set(record.sessionId, group);
    });

    const now = Date.now();
    const keep = [];
    const remove = [];
    for (const [sessionId, group] of grouped.entries()) {
        group.sort((left, right) => right.createdAtMs - left.createdAtMs);
        group.forEach((record, index) => {
            const key = `${record.sessionId}/${record.runId}`;
            const retained = activeKeys.has(key) || (
                recentSessionIds.has(sessionId)
                && index < CHECKPOINTS_PER_SESSION_LIMIT
                && now - record.createdAtMs <= CHECKPOINT_RETENTION_MS
            );
            (retained ? keep : remove).push(record);
        });
    }

    keep.sort((left, right) => right.createdAtMs - left.createdAtMs);
    let remainingBytes = keep.reduce((sum, record) => sum + record.size, 0);
    for (let index = keep.length - 1; index >= 0 && remainingBytes > CHECKPOINT_STORAGE_LIMIT_BYTES; index -= 1) {
        const record = keep[index];
        if (activeKeys.has(`${record.sessionId}/${record.runId}`)) continue;
        remove.push(record);
        remainingBytes -= record.size;
        keep.splice(index, 1);
    }

    let bytesFreed = 0;
    for (const record of remove) {
        await removeStoredCheckpoint(record);
        bytesFreed += record.size;
    }
    try {
        const sessionDirs = await fs.readdir(path.join(getWorkspaceRoot(), 'data', 'agent-checkpoints'), { withFileTypes: true });
        for (const entry of sessionDirs) {
            if (!entry.isDirectory()) continue;
            try {
                await fs.rmdir(path.join(path.join(getWorkspaceRoot(), 'data', 'agent-checkpoints'), entry.name));
            } catch { /* directory still contains retained checkpoints */ }
        }
    } catch { /* storage directory may not exist yet */ }
    return { removed: remove.length, bytesFreed, remainingBytes };
}

async function finalizeRunCheckpoint(session, runId) {
    const changes = getRunChangesPayload(session, runId);
    if (!changes?.files?.length) {
        await removeStoredCheckpoint({ sessionId: session.id, runId });
    }
    await pruneCheckpoints();
}

async function readRestoreSnapshot(sessionId, runId, mode = 'single') {
    const raw = await fs.readFile(getRestoreSnapshotFilePath(sessionId, runId, mode), 'utf8');
    return JSON.parse(raw);
}

async function scanCurrentCheckpointState(scope = null) {
    const files = await collectCheckpointFiles(scope);
    const records = {};
    for (const file of files) {
        try {
            records[file.relativePath] = await readCheckpointFileRecord(file.relativePath, file.absolutePath, file.stat);
        } catch {
            // File may have changed between readdir and read; ignore this scan entry.
        }
    }
    return records;
}

function summarizeRunChanges(files = []) {
    const counts = files.reduce((acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1;
        return acc;
    }, {});
    const parts = [
        counts.modified ? `修改 ${counts.modified} 个` : '',
        counts.added ? `新增 ${counts.added} 个` : '',
        counts.deleted ? `删除 ${counts.deleted} 个` : ''
    ].filter(Boolean);
    return parts.length ? `本轮${parts.join('，')}文件` : '本轮未检测到文件修改';
}

function decodeCheckpointContent(record) {
    if (!record?.contentBase64) return '';
    return Buffer.from(record.contentBase64, 'base64').toString('utf8');
}

function countTextLines(text = '') {
    const value = String(text || '');
    if (!value) return 0;
    return value.endsWith('\n') ? value.slice(0, -1).split('\n').length : value.split('\n').length;
}

function computeLineChangeStats(beforeText = '', afterText = '') {
    if (!beforeText && !afterText) {
        return { additions: 0, deletions: 0 };
    }
    if (!beforeText) {
        return { additions: countTextLines(afterText), deletions: 0 };
    }
    if (!afterText) {
        return { additions: 0, deletions: countTextLines(beforeText) };
    }

    const beforeLines = String(beforeText).split('\n');
    const afterLines = String(afterText).split('\n');
    let prefix = 0;
    while (
        prefix < beforeLines.length
        && prefix < afterLines.length
        && beforeLines[prefix] === afterLines[prefix]
    ) {
        prefix += 1;
    }

    let suffix = 0;
    while (
        suffix + prefix < beforeLines.length
        && suffix + prefix < afterLines.length
        && beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
    ) {
        suffix += 1;
    }

    return {
        additions: Math.max(0, afterLines.length - prefix - suffix),
        deletions: Math.max(0, beforeLines.length - prefix - suffix)
    };
}

function sumLineChangeStats(files = []) {
    return files.reduce((acc, file) => {
        acc.additions += Number(file.additions || 0);
        acc.deletions += Number(file.deletions || 0);
        return acc;
    }, { additions: 0, deletions: 0 });
}

async function detectRunChanges(session, runId) {
    let checkpoint = null;
    try {
        checkpoint = await readRunCheckpoint(session.id, runId);
    } catch (error) {
        return {
            runId,
            checkpointId: runId,
            status: 'unavailable',
            rollbackStatus: 'unavailable',
            summary: '未找到本轮检查点，无法生成变更摘要',
            files: []
        };
    }

    const before = checkpoint.files || {};
    const after = await scanCurrentCheckpointState(checkpoint.scope || null);
    const paths = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
    const files = [];
    for (const relativePath of paths) {
        const previous = before[relativePath] || null;
        const current = after[relativePath] || null;
        if (previous && current && previous.sha256 === current.sha256) continue;
        const status = previous && current ? 'modified' : previous ? 'deleted' : 'added';
        const currentSnapshot = current ? await readCurrentFileSnapshot(relativePath).catch(() => null) : null;
        const lineStats = computeLineChangeStats(
            decodeCheckpointContent(previous),
            currentSnapshot?.unsupported ? '' : decodeCheckpointContent(currentSnapshot)
        );
        files.push({
            path: relativePath,
            status,
            additions: lineStats.additions,
            deletions: lineStats.deletions,
            beforeSha256: previous?.sha256 || null,
            afterSha256: current?.sha256 || null,
            beforeSize: previous?.size ?? null,
            afterSize: current?.size ?? null
        });
    }

    const stats = {
        files: files.length,
        ...sumLineChangeStats(files)
    };
    return {
        runId,
        checkpointId: checkpoint.checkpointId || runId,
        status: 'available',
        rollbackStatus: files.length ? 'available' : 'unavailable',
        summary: summarizeRunChanges(files),
        stats,
        files
    };
}

async function emitRunChanges(session, runId, activeRun = null) {
    if (!runId || activeRun?.changesEmitted) return null;
    if (activeRun) {
        activeRun.changesEmitted = true;
    }
    const persistence = activeRun?.canvasPersistence;
    if (persistence) await canvasPersistence('finish', persistence.root, persistence.context, runId);
    const changes = await detectRunChanges(session, runId);
    emitEvent(session, 'run_changes', changes);
    return changes;
}

async function emitLiveRunChanges(session, runId, activeRun = null) {
    if (!runId || !activeRun || activeRun.changesEmitted) return null;
    if (activeRun.checkpointStatus !== 'available') return null;

    const changes = await detectRunChanges(session, runId);
    if (!Array.isArray(changes.files) || changes.files.length === 0) return null;

    const signature = stableStringify(changes.files.map((file) => ({
        path: file.path,
        status: file.status,
        afterSha256: file.afterSha256 || null,
        afterSize: file.afterSize ?? null
    })));
    if (signature === activeRun.liveChangesSignature) return null;

    activeRun.liveChangesSignature = signature;
    emitEvent(session, 'run_live_changes', {
        ...changes,
        live: true
    }, { persist: false });
    return changes;
}

function getRunChangeEvents(session, fromRunId = null, { includeSelf = true } = {}) {
    const events = Array.isArray(session.timeline) ? session.timeline : [];
    if (!fromRunId) {
        return events.filter((event) => event.type === 'run_changes');
    }
    const startIndex = events.findIndex((event) => event.type === 'run_started' && event.runId === fromRunId);
    if (startIndex < 0) return [];
    return events
        .slice(startIndex)
        .filter((event) => (
            event.type === 'run_changes'
            && event.payload?.runId
            && (includeSelf || event.payload.runId !== fromRunId)
        ));
}

function getRunChangesPayload(session, runId) {
    const event = [...(session.timeline || [])]
        .reverse()
        .find((item) => item.type === 'run_changes' && item.payload?.runId === runId);
    return event?.payload || null;
}

function getLatestAvailableRunChange(session) {
    const events = Array.isArray(session.timeline) ? session.timeline : [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (
            event.type === 'run_changes'
            && event.payload?.runId
            && event.payload?.rollbackStatus === 'available'
            && Array.isArray(event.payload.files)
            && event.payload.files.length
        ) {
            return event;
        }
    }
    return null;
}

function getRollbackCandidatePaths(session, runId, mode, beforeRun = false) {
    if (mode === 'single') {
        const changes = getRunChangesPayload(session, runId);
        return new Set((changes?.files || []).map((file) => file.path).filter(Boolean));
    }
    const paths = new Set();
    for (const event of getRunChangeEvents(session, runId, { includeSelf: beforeRun })) {
        for (const file of event.payload?.files || []) {
            if (file.path) paths.add(file.path);
        }
    }
    return paths;
}

function getLatestKnownAfterHash(session, relativePath, runId, mode, beforeRun = false) {
    const events = mode === 'single'
        ? (getRunChangesPayload(session, runId) ? [{ payload: getRunChangesPayload(session, runId) }] : [])
        : getRunChangeEvents(session, runId, { includeSelf: beforeRun });
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const file = (events[index].payload?.files || []).find((item) => item.path === relativePath);
        if (file) return file.afterSha256 || null;
    }
    return null;
}

async function readCurrentFileHash(relativePath) {
    const { absolutePath } = resolveWorkspacePath(relativePath);
    try {
        const content = await fs.readFile(absolutePath);
        return hashBuffer(content);
    } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
    }
}

async function readCurrentFileSnapshot(relativePath) {
    const { absolutePath } = resolveWorkspacePath(relativePath);
    try {
        const stat = await fs.stat(absolutePath);
        if (!isCheckpointEligibleFile(relativePath, stat)) {
            return {
                path: relativePath,
                exists: true,
                unsupported: true,
                sha256: null,
                contentBase64: null
            };
        }
        return {
            exists: true,
            ...await readCheckpointFileRecord(relativePath, absolutePath, stat, { includeContent: true })
        };
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return {
                path: relativePath,
                exists: false,
                sha256: null,
                contentBase64: null
            };
        }
        throw error;
    }
}

function getCheckpointTargetHash(checkpoint, relativePath) {
    return checkpoint.files?.[relativePath]?.sha256 || null;
}

async function getRollbackTargetCheckpoint(session, runId, mode, fallbackCheckpoint) {
    if (mode === 'single') return fallbackCheckpoint;
    const nextChange = getRunChangeEvents(session, runId, { includeSelf: false }).find(event => event.payload?.files?.length) || null;
    if (!nextChange?.payload?.runId) return fallbackCheckpoint;
    return readRunCheckpoint(session.id, nextChange.payload.runId);
}

async function createRestoreSnapshot(session, runId, mode, candidatePaths, checkpoint) {
    const files = {};
    for (const relativePath of candidatePaths) {
        files[relativePath] = await readCurrentFileSnapshot(relativePath);
    }
    const snapshot = {
        version: 1,
        sessionId: session.id,
        runId,
        mode,
        createdAt: new Date().toISOString(),
        files,
        rollbackTargetHashes: Object.fromEntries(
            Array.from(candidatePaths).map((relativePath) => [
                relativePath,
                getCheckpointTargetHash(checkpoint, relativePath)
            ])
        )
    };
    await fs.mkdir(getCheckpointDir(session.id, runId), { recursive: true });
    await fs.writeFile(getRestoreSnapshotFilePath(session.id, runId, mode), JSON.stringify(snapshot, null, 2));
    return snapshot;
}

async function rollbackRunToCheckpoint(session, runId, { mode = 'to_checkpoint', force = false, dryRun = false, beforeRun = false } = {}) {
    const normalizedMode = mode === 'single' ? 'single' : 'to_checkpoint';
    if (normalizedMode === 'single') {
        const latestChange = getLatestAvailableRunChange(session);
        if (latestChange?.payload?.runId !== runId) {
            return {
                ok: false,
                status: 'unavailable',
                runId,
                mode: normalizedMode,
                summary: '只能撤销最新一轮。历史记录请使用“回到这里”。',
                files: [],
                conflicts: []
            };
        }
    }
    const checkpoint = await readRunCheckpoint(session.id, runId);
    const targetCheckpoint = beforeRun ? checkpoint : await getRollbackTargetCheckpoint(session, runId, normalizedMode, checkpoint);
    const candidatePaths = getRollbackCandidatePaths(session, runId, normalizedMode, beforeRun);
    if (!candidatePaths.size) {
        return {
            ok: false,
            status: 'unavailable',
            runId,
            mode: normalizedMode,
            summary: normalizedMode === 'single' ? '没有可撤销的文件变更' : '已经停在这里',
            files: [],
            conflicts: []
        };
    }

    const conflicts = [];
    for (const relativePath of candidatePaths) {
        const latestAfterHash = getLatestKnownAfterHash(session, relativePath, runId, normalizedMode, beforeRun);
        const currentHash = await readCurrentFileHash(relativePath);
        if (!force && latestAfterHash !== currentHash) {
            conflicts.push({
                path: relativePath,
                expectedSha256: latestAfterHash,
                currentSha256: currentHash
            });
        }
    }

    if (conflicts.length) {
        if (!dryRun) markRunRollbackStatus(session, runId, normalizedMode, 'conflict');
        return {
            ok: false,
            status: 'conflict',
            runId,
            mode: normalizedMode,
            summary: `检测到 ${conflicts.length} 个文件已被后续手动修改，未执行撤销`,
            files: [],
            conflicts
        };
    }

    if (dryRun) return { ok: true, status: 'preview', runId, files: await Promise.all([...candidatePaths].sort().map(async path => ({
        path, currentSha256: await readCurrentFileHash(path), targetSha256: getCheckpointTargetHash(targetCheckpoint, path)
    }))), conflicts: [] };

    const restoreSnapshot = await createRestoreSnapshot(session, runId, normalizedMode, candidatePaths, targetCheckpoint);
    const restored = [];
    for (const relativePath of candidatePaths) {
        const snapshot = targetCheckpoint.files?.[relativePath] || null;
        const { absolutePath } = resolveWorkspacePath(relativePath);
        if (snapshot?.contentBase64) {
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            await fs.writeFile(absolutePath, Buffer.from(snapshot.contentBase64, 'base64'));
            restored.push({ path: relativePath, status: 'restored' });
        } else {
            await fs.rm(absolutePath, { force: true });
            restored.push({ path: relativePath, status: 'removed' });
        }
    }

    markRunRollbackStatus(session, runId, normalizedMode, 'reverted', {
        restoreMode: normalizedMode,
        restoreSnapshotCreatedAt: restoreSnapshot.createdAt
    });
    if (beforeRun) {
        const selected = getRunChangesPayload(session, runId);
        if (selected) selected.rollbackStatus = 'reverted';
    }
    await persistSession(session);
    return {
        ok: true,
        status: 'reverted',
        runId,
        mode: normalizedMode,
        summary: normalizedMode === 'single'
            ? `已撤销本轮 ${restored.length} 个文件变更`
            : `已回到这里，处理 ${restored.length} 个文件`,
        files: restored,
        conflicts: []
    };
}

async function restoreRunFromSnapshot(session, runId, { mode = 'single', force = false } = {}) {
    const normalizedMode = mode === 'to_checkpoint' ? 'to_checkpoint' : 'single';
    if (normalizedMode === 'to_checkpoint') {
        return {
            ok: false,
            status: 'unavailable',
            runId,
            mode: normalizedMode,
            summary: '回到这里后，后续轮次只作为历史记录保留，不能再恢复。',
            files: [],
            conflicts: []
        };
    }
    const snapshot = await readRestoreSnapshot(session.id, runId, normalizedMode);
    const entries = Object.entries(snapshot.files || {});
    if (!entries.length) {
        return {
            ok: false,
            status: 'unavailable',
            runId,
            mode: normalizedMode,
            summary: '没有可恢复的文件变更',
            files: [],
            conflicts: []
        };
    }

    const conflicts = [];
    for (const [relativePath] of entries) {
        const expectedHash = snapshot.rollbackTargetHashes?.[relativePath] || null;
        const currentHash = await readCurrentFileHash(relativePath);
        if (!force && currentHash !== expectedHash) {
            conflicts.push({
                path: relativePath,
                expectedSha256: expectedHash,
                currentSha256: currentHash
            });
        }
    }

    if (conflicts.length) {
        markRunRollbackStatus(session, runId, normalizedMode, 'restore_conflict');
        return {
            ok: false,
            status: 'conflict',
            runId,
            mode: normalizedMode,
            summary: `检测到 ${conflicts.length} 个文件已被再次修改，未执行恢复`,
            files: [],
            conflicts
        };
    }

    const restored = [];
    for (const [relativePath, record] of entries) {
        const { absolutePath } = resolveWorkspacePath(relativePath);
        if (record.exists && record.contentBase64) {
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            await fs.writeFile(absolutePath, Buffer.from(record.contentBase64, 'base64'));
            restored.push({ path: relativePath, status: 'restored' });
        } else {
            await fs.rm(absolutePath, { force: true });
            restored.push({ path: relativePath, status: 'removed' });
        }
    }

    markRunRollbackStatus(session, runId, normalizedMode, 'available', {
        restoredAt: new Date().toISOString()
    });
    await persistSession(session);
    return {
        ok: true,
        status: 'restored',
        runId,
        mode: normalizedMode,
        summary: normalizedMode === 'single'
            ? `已恢复本轮 ${restored.length} 个文件变更`
            : `已恢复到回退前状态，处理 ${restored.length} 个文件`,
        files: restored,
        conflicts: []
    };
}

function markRunRollbackStatus(session, runId, mode, rollbackStatus, extraPayload = {}) {
    const targetRunIds = mode === 'single'
        ? new Set([runId])
        : new Set(getRunChangeEvents(session, runId, { includeSelf: false }).map((event) => event.payload?.runId).filter(Boolean));
    for (const event of session.timeline || []) {
        if (event.type !== 'run_changes' || !targetRunIds.has(event.payload?.runId)) continue;
        event.payload = {
            ...(event.payload || {}),
            rollbackStatus,
            ...extraPayload,
            revertedAt: rollbackStatus === 'reverted' ? new Date().toISOString() : event.payload?.revertedAt || null
        };
    }
}

function trimToSessionTitleLength(value) {
    return Array.from(String(value || '')).slice(0, MAX_SESSION_TITLE_CHARS).join('');
}

function normalizeSessionTitle(value, fallback = SESSION_TITLE_FALLBACK) {
    const cleaned = String(value || '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[“”"‘'`]/g, '')
        .replace(/^(会话)?标题\s*[:：]\s*/i, '')
        .replace(/^(主题|话题)\s*[:：]\s*/i, '')
        .replace(/\s+/g, '')
        .replace(/^[#\-*·:：，。,.!?！？、；;]+|[#\-*·:：，。,.!?！？、；;]+$/g, '')
        .trim();
    const safeFallback = fallback === ''
        ? ''
        : (String(fallback || SESSION_TITLE_FALLBACK).trim() || SESSION_TITLE_FALLBACK);
    return trimToSessionTitleLength(cleaned || safeFallback) || SESSION_TITLE_FALLBACK;
}

function createSessionTitle(context, summary = '') {
    const hint = normalizeSessionTitle(summary, '');
    return hint || SESSION_TITLE_FALLBACK;
}

function inferSessionScope(snapshot = {}) {
    if (snapshot.sessionScope === 'global' || snapshot.sessionScope === 'page') {
        return snapshot.sessionScope;
    }
    const title = String(snapshot.title || '').trim();
    if (title === '新增页面') {
        return 'global';
    }
    const lastDescriptor = snapshot.runState?.lastDescriptor || snapshot.runState?.descriptor || null;
    if (lastDescriptor?.skillId === 'create-new-page' || lastDescriptor?.commandId === 'new-page') {
        return 'global';
    }
    return 'page';
}

function sessionSecrets(session) {
    const secrets = knownSecrets({ ...(piGateway.manager.get(session.id)?.config.env || {}),
        PROTA_PI_API_KEY: session.providerConfig?.apiKey || '' });
    // Idle collection removes the child environment. Keep redacting configured
    // MCP credentials when snapshots and history are subsequently serialized.
    secrets.push(...configuredMcpSecrets(session.providerConfig?.sdkOptions?.mcpServers));
    return [...new Set(secrets)];
}

function createSessionSnapshot(session) {
    return redactSecrets({
        id: session.id,
        title: session.engineInfo?.sessionName || normalizeSessionTitle(session.title || createSessionTitle(session.context)),
        sessionScope: inferSessionScope(session),
        sdkSessionId: session.sdkSessionId || session.id,
        engineInfo: session.engineInfo || null,
        parentSession: session.parentSession || null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        archivedAt: session.archivedAt || null,
        context: session.context,
        providerSummary: sanitizeProviderConfig(session.providerConfig),
        timeline: session.timeline,
        runState: session.runState,
        pendingApproval: session.pendingApproval
            ? {
                id: session.pendingApproval.id,
                toolName: session.pendingApproval.toolName,
                createdAt: session.pendingApproval.createdAt,
                inputPreview: session.pendingApproval.inputPreview,
                options: session.pendingApproval.options
            }
            : null,
        pendingQuestion: session.pendingQuestion
            ? {
                id: session.pendingQuestion.id,
                question: session.pendingQuestion.question,
                options: session.pendingQuestion.options
            }
            : null
    }, sessionSecrets(session));
}

function createSessionListItem(session) {
    if (session?._summaryOnly && session._listItem) {
        return { ...session._listItem };
    }
    const sessionScope = inferSessionScope(session);
    const hasHistory = (session.timeline || []).some((event) => {
        if (!event) return false;
        if (event.type === 'session_ready' || event.type === 'heartbeat') return false;
        if (event.type === 'run_status' && !event.payload?.summary) return false;
        return true;
    });
    return redactSecrets({
        id: session.id,
        title: session.engineInfo?.sessionName || normalizeSessionTitle(session.title || createSessionTitle(session.context)),
        sessionScope,
        projectId: session.context.projectId || 'readify',
        pageId: session.context.pageId,
        version: session.context.version,
        contextLabel: sessionScope === 'global'
            ? ''
            : `${session.context.projectId} / ${session.context.pageId} / ${session.context.version}`,
        status: session.runState?.status || 'ready',
        canvasTargetIds: (session.runState?.descriptor?.context?.canvasSelection || session.context.canvasSelection || []).map(node => node.id),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        archived: Boolean(session.archivedAt),
        lastSummary: session.runState?.lastSummary
            || session.runState?.stageMessage
            || session.runState?.lastError
            || '',
        hasHistory
    }, sessionSecrets(session));
}

async function ensureSessionStorageDir() {
    await fs.mkdir(path.join(getWorkspaceRoot(), 'data', 'agent-sessions'), { recursive: true });
}

async function ensureAgentUploadDir(sessionId = '') {
    const targetDir = sessionId
        ? path.join(path.join(getWorkspaceRoot(), 'data', 'agent-uploads'), sessionId)
        : path.join(getWorkspaceRoot(), 'data', 'agent-uploads');
    await fs.mkdir(targetDir, { recursive: true });
    return targetDir;
}

function sanitizeUploadName(value = 'image') {
    return String(value || 'image')
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, '-')
        .slice(0, 80)
        || 'image';
}

function extensionForImageMimeType(mimeType) {
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/webp') return 'webp';
    return 'png';
}

function parseAgentImageDataUrl(dataUrl = '', fallbackMimeType = '') {
    const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) {
        throw createClassifiedError('图片数据格式无效。', 'invalid_attachment', 400);
    }

    const mimeType = match[1] === 'image/jpg'
        ? 'image/jpeg'
        : match[1];
    const resolvedMimeType = fallbackMimeType === 'image/jpg'
        ? 'image/jpeg'
        : (fallbackMimeType || mimeType);
    if (resolvedMimeType !== mimeType || !SUPPORTED_AGENT_IMAGE_MIME_TYPES.has(mimeType)) {
        throw createClassifiedError('目前仅支持 PNG、JPG、WebP 图片。', 'invalid_attachment', 400);
    }

    const encoded = match[2].replace(/\s/g, '');
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length) {
        throw createClassifiedError('图片内容为空。', 'invalid_attachment', 400);
    }
    if (bytes.length > MAX_AGENT_IMAGE_BYTES) {
        throw createClassifiedError('图片不能超过 8MB。', 'invalid_attachment', 400);
    }

    return { mimeType, encoded, bytes };
}

async function persistAgentImageAttachments(sessionId, attachments = []) {
    const incoming = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
    if (!incoming.length) return [];
    if (incoming.length > MAX_AGENT_IMAGE_ATTACHMENTS) {
        throw createClassifiedError(`一次最多上传 ${MAX_AGENT_IMAGE_ATTACHMENTS} 张图片。`, 'invalid_attachment', 400);
    }

    const uploadDir = await ensureAgentUploadDir(sessionId);
    const stored = [];

    for (const [index, attachment] of incoming.entries()) {
        const { mimeType, bytes } = parseAgentImageDataUrl(
            attachment.dataUrl,
            attachment.mimeType || attachment.type || attachment.contentType || ''
        );
        const extension = extensionForImageMimeType(mimeType);
        const safeName = sanitizeUploadName(attachment.name || `image-${index + 1}`);
        const baseName = safeName.replace(/\.(png|jpe?g|webp)$/i, '') || `image-${index + 1}`;
        const filename = `${Date.now()}-${randomUUID()}-${baseName}.${extension}`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, bytes);

        stored.push({
            id: attachment.id || randomUUID(),
            name: safeName,
            mimeType,
            size: bytes.length,
            path: path.relative(getWorkspaceRoot(), filePath).split(path.sep).join(path.posix.sep)
        });
    }

    return stored;
}

function getRunAttachments(input = {}) {
    return Array.isArray(input.attachments)
        ? input.attachments
            .filter((item) => item?.path && item?.mimeType)
            .map((item) => ({
                id: item.id || randomUUID(),
                name: item.name || 'image',
                mimeType: item.mimeType,
                size: Number(item.size || 0) || 0,
                path: item.path
            }))
        : [];
}

async function buildAttachmentContentBlocks(attachments = []) {
    const blocks = [];
    for (const attachment of attachments) {
        const filePath = path.resolve(getWorkspaceRoot(), attachment.path);
        const relativePath = path.relative(getWorkspaceRoot(), filePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw createClassifiedError('图片附件路径无效。', 'invalid_attachment', 400);
        }
        const bytes = await fs.readFile(filePath);
        if (bytes.length > MAX_AGENT_IMAGE_BYTES) {
            throw createClassifiedError('图片不能超过 8MB。', 'invalid_attachment', 400);
        }
        if (!SUPPORTED_AGENT_IMAGE_MIME_TYPES.has(attachment.mimeType)) {
            throw createClassifiedError('目前仅支持 PNG、JPG、WebP 图片。', 'invalid_attachment', 400);
        }
        blocks.push({
            type: 'image',
            source: {
                type: 'base64',
                media_type: attachment.mimeType,
                data: bytes.toString('base64')
            }
        });
    }
    return blocks;
}

function attachmentDisplayPath(attachment) {
    const filePath = path.resolve(getWorkspaceRoot(), attachment.path || '');
    const relativePath = path.relative(getWorkspaceRoot(), filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return attachment.path || attachment.name || 'image';
    }
    return relativePath.split(path.sep).join(path.posix.sep);
}

async function buildPromptWithAttachments(descriptor, text) {
    const attachments = getRunAttachments(descriptor);
    if (!attachments.length) return text;

    const imageBlocks = await buildAttachmentContentBlocks(attachments);
    const attachmentLines = attachments
        .map((item, index) => `- 图片 #${index + 1}: ${item.name} (${item.mimeType}, ${Math.round(item.size / 1024)} KB, path: ${attachmentDisplayPath(item)})`)
        .join('\n');
    const promptText = String(text || '').trim()
        || '请基于上传图片生成或调整当前 Readify 原型。';
    return [
        ...imageBlocks,
        {
            type: 'text',
            text: [
                promptText,
                '',
                '## 上传图片',
                '请把本轮图片作为原型参考图、截图或线框图理解，提取界面结构、关键状态、视觉层级与交互意图，并按项目规约落地代码。',
                attachmentLines
            ].join('\n')
        }
    ];
}

async function writeSessionIndex() {
    await ensureSessionStorageDir();
    const items = Array.from(sessions.values())
        .map((session) => createSessionListItem(session))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    await fs.writeFile(path.join(getWorkspaceRoot(), 'data', 'agent-sessions', 'index.json'), JSON.stringify({ sessions: items }, null, 2));
}

async function persistSession(session) {
    if (!session || session.closed || session._summaryOnly) return;
    const operation = (async () => {
        session.updatedAt = new Date().toISOString();
        await ensureSessionStorageDir();
        await fs.writeFile(getSessionFilePath(session.id), JSON.stringify(createSessionSnapshot(session), null, 2));
        await writeSessionIndex();
    })();
    pendingWorkspaceWrites.add(operation);
    try { await operation; } finally { pendingWorkspaceWrites.delete(operation); }
}

function schedulePersistSession(session, delay = SESSION_PERSIST_DEBOUNCE_MS) {
    if (!session || session.closed) return;
    const existing = scheduledSessionPersists.get(session.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
        scheduledSessionPersists.delete(session.id);
        persistSession(session).catch((error) => {
            console.warn('[agent-gateway] Failed to persist session event:', error);
        });
    }, delay);
    scheduledSessionPersists.set(session.id, timer);
}

async function removePersistedSession(sessionId) {
    const scheduled = scheduledSessionPersists.get(sessionId);
    if (scheduled) {
        clearTimeout(scheduled);
        scheduledSessionPersists.delete(sessionId);
    }
    try {
        await fs.unlink(getSessionFilePath(sessionId));
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }
    await writeSessionIndex();
}

async function hydratePersistedSessions() {
    await ensureSessionStorageDir();
    let sessionIds = [];
    try {
        const raw = await fs.readFile(path.join(getWorkspaceRoot(), 'data', 'agent-sessions', 'index.json'), 'utf8');
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed.sessions) ? parsed.sessions : [];
        items.forEach((item) => {
            if (!item?.id) return;
            const summary = ['running', 'awaiting_approval', 'waiting_for_user'].includes(item.status)
                ? {
                    ...item,
                    status: 'interrupted',
                    lastSummary: '上一次运行已中断'
                }
                : item;
            sessions.set(item.id, {
                id: item.id,
                _summaryOnly: true,
                _listItem: { ...summary }
            });
        });
        sessionIds = items.map((item) => item?.id).filter(Boolean);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            console.warn('[agent-gateway] Failed to read session index:', error);
        }
    }

    logInfo(`Loaded ${sessionIds.length} session summaries; histories will hydrate on demand.`);
}

async function getHydratedSession(sessionId) {
    const cached = sessions.get(sessionId);
    if (cached && !cached._summaryOnly) return cached;
    if (!cached) return null;

    try {
        const raw = await fs.readFile(getSessionFilePath(sessionId), 'utf8');
        const snapshot = JSON.parse(raw);
        if (!snapshot.engineInfo) {
            const backupDir = path.join(getWorkspaceRoot(), 'data/agent-sessions/legacy-backups', sessionId);
            await fs.mkdir(backupDir, { recursive: true });
            await fs.writeFile(path.join(backupDir, 'snapshot.json'), raw, { flag: 'wx', mode: 0o600 })
                .catch(error => { if (error.code !== 'EEXIST') throw error; });
        }
        const normalizedContext = normalizeContext(snapshot.context);
        const session = {
            id: snapshot.id,
            title: snapshot.engineInfo?.sessionName || normalizeSessionTitle(
                snapshot.title || createSessionTitle(normalizedContext, snapshot.runState?.lastSummary)
            ),
            sessionScope: inferSessionScope(snapshot),
            sdkSessionId: snapshot.sdkSessionId || snapshot.id,
            engineInfo: snapshot.engineInfo || null,
            parentSession: snapshot.parentSession || null,
            createdAt: snapshot.createdAt || new Date().toISOString(),
            updatedAt: snapshot.updatedAt || snapshot.createdAt || new Date().toISOString(),
            archivedAt: snapshot.archivedAt || null,
            context: normalizedContext,
            providerConfig: resolveProviderConfig(snapshot.providerSummary || {}),
            agent: null,
            timeline: Array.isArray(snapshot.timeline) ? snapshot.timeline : [],
            runState: {
                ...createDefaultRunState(),
                ...(snapshot.runState || {}),
                partialAssistantText: '',
                partialAssistantEventId: null
            },
            pendingApproval: null,
            pendingQuestion: null,
            subscribers: new Set(),
            activeRun: null,
            closed: false
        };
        normalizeHydratedRunState(session);
        ensureEngineInfo(session, { legacy: !snapshot.engineInfo });
        sessions.set(session.id, session);
        if (JSON.stringify(snapshot.context || {}) !== JSON.stringify(normalizedContext)) {
            await persistSession(session);
        }
        return session;
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            console.warn(`[agent-gateway] Failed to hydrate session ${sessionId}:`, error);
        }
        return null;
    }
}

function normalizeHydratedRunState(session) {
    if (!session?.runState?.active) return;
    const timeline = Array.isArray(session.timeline) ? session.timeline : [];
    const lastTerminal = [...timeline].reverse().find((event) => event.type === 'run_finished' || event.type === 'run_failed');
    const lastRunStarted = [...timeline].reverse().find((event) => event.type === 'run_started');
    if (!lastTerminal || (lastRunStarted && new Date(lastRunStarted.createdAt || 0) > new Date(lastTerminal.createdAt || 0))) {
        session.runState = {
            ...session.runState,
            active: false,
            status: 'interrupted',
            finishedAt: new Date().toISOString(),
            currentTool: null,
            stageMessage: '上一次运行在服务重启或连接中断后失去活动状态，已标记为中断。',
            lastSummary: '上一次运行已中断',
            partialAssistantText: '',
            partialAssistantEventId: null
        };
        return;
    }

    const payload = lastTerminal.payload || {};
    session.runState = {
        ...session.runState,
        active: false,
        status: lastTerminal.type === 'run_failed' ? 'failed' : (payload.status || 'succeeded'),
        finishedAt: lastTerminal.createdAt || session.runState.finishedAt || new Date().toISOString(),
        currentTool: null,
        stageMessage: payload.reason || payload.summary || session.runState.stageMessage || '任务已结束',
        lastError: lastTerminal.type === 'run_failed' ? (payload.reason || session.runState.lastError || '任务失败') : session.runState.lastError,
        lastSummary: lastTerminal.type === 'run_finished' ? (payload.summary || session.runState.lastSummary || '任务已完成') : session.runState.lastSummary,
        partialAssistantText: '',
        partialAssistantEventId: null
    };
}

function createSession({ context, providerConfig, sessionScope = 'page' }) {
    const id = randomUUID();
    const normalizedContext = normalizeContext({
        ...context,
        globalContext: sessionScope === 'global'
    });
    const createdAt = new Date().toISOString();
    const session = {
        id,
        title: createSessionTitle(normalizedContext),
        sessionScope,
        sdkSessionId: id,
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
        context: normalizedContext,
        providerConfig: resolveProviderConfig(providerConfig),
        agent: null,
        timeline: [],
        runState: {
            ...createDefaultRunState(),
            status: 'ready',
            stageMessage: '已连接，等待新的任务'
        },
        pendingApproval: null,
        pendingQuestion: null,
        subscribers: new Set(),
        activeRun: null,
        closed: false
    };

    ensureEngineInfo(session);
    sessions.set(id, session);
    emitEvent(session, 'session_ready', {
        sessionId: session.id,
        sessionScope: inferSessionScope(session),
        context: session.context,
        providerConfig: sanitizeProviderConfig(session.providerConfig),
        runState: session.runState
    });
    queueMicrotask(() => persistSession(session).catch((error) => {
        console.warn('[agent-gateway] Failed to persist new session:', error);
    }));
    return session;
}

function normalizeContext(input = {}) {
    let projectId = String(input.projectId || 'readify').trim() || 'readify';
    if (input.globalContext || input.sessionScope === 'global' || input.pageId === '__global__') {
        const relativePageDir = path.posix.join('src', 'pages');
        return {
            projectId,
            pageId: '__global__',
            version: 'workspace',
            cwd: getWorkspaceRoot(),
            relativePageDir,
            pageDir: path.join(getWorkspaceRoot(), relativePageDir),
            globalContext: true
        };
    }
    const pageId = String(input.pageId || 'reader').trim() || 'reader';
    const version = String(input.version || 'v1').trim() || 'v1';
    projectId = resolveProjectIdForPage(projectId, pageId, version);
    const relativePageDir = path.posix.join('src', 'pages', projectId, pageId, version);
    return {
        projectId,
        pageId,
        version,
        cwd: getWorkspaceRoot(),
        relativePageDir,
        pageDir: path.join(getWorkspaceRoot(), relativePageDir),
        canvasSelection: Array.isArray(input.canvasSelection) ? input.canvasSelection.slice(0, 100).map(n => ({ id: String(n.id || '').slice(0, 80), name: String(n.name || '').slice(0, 160), type: String(n.type || ''), src: String(n.src || '').slice(0, 200), parentId: String(n.parentId || '').slice(0, 80),
            bounds: n.bounds && ['x','y','width','height'].every(key => Number.isFinite(n.bounds[key])) ? { x:n.bounds.x,y:n.bounds.y,width:n.bounds.width,height:n.bounds.height } : undefined,
            attributes: n.attributes ? { text:String(n.attributes.text || '').slice(0,1000),color:String(n.attributes.color || '').slice(0,32),fontSize:Number(n.attributes.fontSize) || 20,locked:Boolean(n.attributes.locked) } : undefined })) : [],
        pageMode: input.pageMode === 'infinite-canvas' ? 'infinite-canvas' : 'standard',
        canvasDirty: Boolean(input.canvasDirty)
    };
}

function formatPageScope(context = {}) {
    if (context.globalContext || context.pageId === '__global__') {
        return '未限定页面范围，不绑定已有页面版本';
    }
    return `${context.projectId}/${context.pageId}/${context.version}`;
}

function formatPagePathLines(context = {}) {
    if (context.globalContext || context.pageId === '__global__') return [];
    return [
        `当前页面版本相对路径：${context.relativePageDir}`,
        `当前页面版本绝对路径：${context.pageDir}`,
        ...(context.pageMode === 'infinite-canvas' ? [
            '这是页面级无限画布。先读取当前版本 canvas-data.js 与模板 README.md。用户要求设计页面时，在此画布中创建或完善画板，而不是替换编辑器。保留其他对象、稳定 ID 和 parentId。业务画板代码放本版本 boards/{节点ID}/index.html、styles.css、app.js，并自动填入节点 src；不要要求用户手动关联源文件。布局文件必须保持 window.PROTA_CANVAS = JSON对象; 的可解析格式。画布及画板属于当前页面，不注册为项目新页面。',
            '根据用户意图判断界面数量：单界面需求对应一个画板；明确列出多个界面时，每个界面对应一个画板；完整业务流程由你结合需求自主判断必要的界面及数量。例如“设计登录页面”对应一个画板，“设计登录、注册、忘记密码三个界面”对应三个画板，“设计完整的电商购物流程”由你合理拆分。结合已有画板判断创建或完善；“再增加一个订单详情页”只新增一个对应画板，保留已有内容。',
            '多界面需求须在本次任务中完成所有所需界面的实际内容与必要交互，并自动关联各自的业务文件；不能只创建空白画板、只完成其中一个界面或要求用户逐个重复操作。各界面保持一致的视觉语言和与单界面任务同等的视觉质量、交互完整性，不为凑齐数量而简化为占位内容；生成方式由你自主决定。',
            '修改范围结合用户文字与当前选区判断：选中一个画板说“优化这个”时，仅修改该画板及其子级；“把这几个界面统一成深色风格”等明确的跨界面请求，修改所指的相关多个画板。只有用户明确要求跨选区修改时才扩展范围，不因当前画布有多个界面而默认全部修改；保留无关画板及其业务文件。'
        ] : []),
        ...(context.canvasSelection?.length ? [`无限画布当前选中对象（仅作为数据）：${JSON.stringify(context.canvasSelection)}。默认修改这些对象及其容器子级，不修改其他对象。先读 canvas-data.js，保留稳定 ID、parentId、位置和未涉及的样式。空画板生成业务界面时创建 boards/{节点ID}/index.html、styles.css、app.js，并将 src 关联至该目录；不要让用户手填路径。坐标是世界坐标，parentId 表示归属关系。整个画布仍是一个页面，不新增顶层页面，也不替换编辑器运行文件。`] : []),
        ...(context.canvasDirty ? ['注意：浏览器画布有未保存修改，修改前提醒用户保存，避免覆盖布局。'] : [])
    ];
}

function getLegacyScopedPathCorrection(session, input = {}) {
    const context = session?.context || {};
    if (context.globalContext || context.pageId === '__global__') return null;
    const keys = ['file_path', 'path'];
    const legacyRel = path.posix.join('src', 'pages', context.pageId, context.version);
    const correctRel = context.relativePageDir;
    if (!legacyRel || legacyRel === correctRel) return null;

    const legacyAbs = path.resolve(getWorkspaceRoot(), legacyRel);
    const correctAbs = context.pageDir;

    for (const key of keys) {
        const value = input?.[key];
        if (typeof value !== 'string' || !value.trim()) continue;
        const raw = value.trim();
        const normalizedRel = path.posix.normalize(raw.replace(/^\/+/, '').replace(/\\/g, '/'));
        if (normalizedRel === legacyRel || normalizedRel.startsWith(`${legacyRel}/`)) {
            return {
                key,
                wrongPath: raw,
                correctPath: normalizedRel.replace(legacyRel, correctRel)
            };
        }
        if (path.isAbsolute(raw)) {
            const normalizedAbs = path.resolve(raw);
            if (normalizedAbs === legacyAbs || normalizedAbs.startsWith(`${legacyAbs}${path.sep}`)) {
                return {
                    key,
                    wrongPath: raw,
                    correctPath: normalizedAbs.replace(legacyAbs, correctAbs)
                };
            }
        }
    }
    return null;
}

function readProjectsConfigSync() {
    try {
        const raw = fsSync.readFileSync(path.join(getWorkspaceRoot(), 'data', 'projects.json'), 'utf8');
        return JSON.parse(raw);
    } catch {
        return { projects: [] };
    }
}

function projectHasPageVersion(project, pageId, version) {
    if (!project || project.deleted) return false;
    const page = (project.pages || []).find((item) => item.id === pageId && !item.deleted);
    if (!page) return false;
    return !version || (Array.isArray(page.versions) && page.versions.includes(version));
}

function resolveProjectIdForPage(projectId, pageId, version) {
    const config = readProjectsConfigSync();
    const projects = Array.isArray(config.projects) ? config.projects : [];
    const preferredProject = projects.find((project) => project.id === projectId);
    if (projectHasPageVersion(preferredProject, pageId, version)) {
        return projectId;
    }
    const matchedProject = projects.find((project) => projectHasPageVersion(project, pageId, version));
    return matchedProject?.id || projectId;
}

async function readProjectsConfig() {
    try {
        const raw = await fs.readFile(path.join(getWorkspaceRoot(), 'data', 'projects.json'), 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        return { projects: [] };
    }
}

async function getContextAvailability(context, descriptor = null) {
    if (context?.globalContext) {
        return { blocked: false, reason: '' };
    }
    const config = await readProjectsConfig();
    const projectId = context.projectId || 'readify';
    const project = (config.projects || []).find((p) => p.id === projectId);

    const skillId = descriptor?.kind === 'skill'
        ? descriptor.skillId
        : descriptor?.kind === 'command'
            ? getLocalCommand(descriptor.commandId)?.skillId
            : null;
    const isGlobalSkill = skillId === 'create-new-page';

    if (!project) {
        if (!isGlobalSkill) {
            return {
                blocked: true,
                reason: `项目 ${projectId} 不存在，相关对话已禁用。`
            };
        }
        return { blocked: false, reason: '' };
    }

    if (project.deleted && !isGlobalSkill) {
        return {
            blocked: true,
            reason: `项目 ${projectId} 已删除，相关对话已禁用。`
        };
    }

    const page = (project.pages || []).find((item) => item.id === context.pageId);

    if (!page) {
        return { blocked: false, reason: '' };
    }
    if (page.deleted && !isGlobalSkill) {
        return {
            blocked: true,
            reason: `页面 ${context.pageId} 在项目 ${projectId} 中已删除，相关对话已禁用。`
        };
    }
    if (page.versionStates?.[context.version]?.deleted && !isGlobalSkill) {
        return {
            blocked: true,
            reason: `版本 ${context.pageId}/${context.version} 在项目 ${projectId} 中已删除，相关对话已禁用。`
        };
    }
    return { blocked: false, reason: '' };
}

function loadEnvValue(...keys) {
    for (const key of keys) {
        if (process.env[key]) return process.env[key];
    }
    return '';
}

function inferApiType(model = '') {
    const normalized = String(model).toLowerCase();
    if (
        normalized.includes('claude') ||
        normalized.includes('anthropic')
    ) {
        return 'anthropic-messages';
    }
    return 'openai-completions';
}

function normalizeProviderId(providerId) {
    const raw = String(providerId || '').trim();
    if (!raw) return providerPresets.defaultProvider;
    const lowered = raw.toLowerCase();
    const preset = providerPresets.providers.find((item) => {
        const aliases = Array.isArray(item.aliases) ? item.aliases : [];
        return item.id === raw
            || item.label === raw
            || item.id.toLowerCase() === lowered
            || String(item.label || '').toLowerCase() === lowered
            || aliases.some((alias) => String(alias).trim().toLowerCase() === lowered);
    });
    return preset?.id || raw;
}

function resolveProviderConfig(input = {}) {
    const sdkOptions = resolveSdkOptions(input);
    const provider = normalizeProviderId(input.provider || providerPresets.defaultProvider);
    const preset = getProviderPreset(provider);
    const apiType = input.apiType || sdkOptions.apiType || preset?.apiType || inferApiType(input.model || sdkOptions.model || preset?.defaultModel);
    const model =
        String(input.model || '').trim() ||
        String(sdkOptions.model || '').trim() ||
        preset?.defaultModel ||
        loadEnvValue('CODEANY_MODEL') ||
        'glm-4.7';
    const baseURL =
        String(input.baseURL || '').trim() ||
        String(sdkOptions.baseURL || '').trim() ||
        preset?.baseURL ||
        loadEnvValue('CODEANY_BASE_URL');
    const apiKey =
        String(input.apiKey || '').trim() ||
        String(sdkOptions.apiKey || '').trim() ||
        loadEnvValue('CODEANY_API_KEY', 'CODEANY_AUTH_TOKEN');

    return {
        provider,
        modelCapabilities: input.modelCapabilities || {},
        label: preset?.label || provider,
        apiType,
        model,
        baseURL,
        apiKey,
        models: Array.isArray(input.models) ? input.models : Array.isArray(preset?.models) ? preset.models : [],
        hint: preset?.hint || '',
        hasApiKey: Boolean(apiKey),
        sdkOptions
    };
}

function sanitizeProviderConfig(config) {
    return {
        provider: config.provider,
        label: config.label,
        apiType: config.apiType,
        model: config.model,
        baseURL: config.baseURL,
        models: config.models,
        modelCapabilities: config.modelCapabilities || {},
        hint: config.hint,
        hasApiKey: Boolean(config.apiKey),
        sdkOptions: sanitizeSdkOptionsForSnapshot(config.sdkOptions || {}),
        sdkExtension: getAgentSdkExtensionStatus()
    };
}

function getProviderPreset(providerId) {
    const normalizedId = normalizeProviderId(providerId);
    return providerPresets.providers.find((item) => item.id === normalizedId) || null;
}

function createSseHeaders() {
    return {
        ...SESSION_STREAM_HEADERS,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
    };
}

function writeSseEvent(res, eventName, payload) {
    try {
        if (res.writableEnded || res.finished) return;
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        if (typeof res.flush === 'function') {
            res.flush();
        }
    } catch (error) {
        console.warn('[agent-gateway] Failed to write SSE event:', error.message);
    }
}

function attachSubscriber(session, res, mode = 'session', runId = null) {
    const subscriber = { res, mode, runId };
    session.subscribers.add(subscriber);
    res.on('close', () => {
        session.subscribers.delete(subscriber);
    });
    res.on('error', (err) => {
        console.warn('[agent-gateway] Subscriber stream error:', err.message);
    });
    try {
        if (res.socket) {
            res.socket.setNoDelay(true);
        }
        res.write(': connected\n\n');
        if (typeof res.flush === 'function') {
            res.flush();
        }
    } catch (err) {
        console.warn('[agent-gateway] Failed to write initial SSE connection message:', err.message);
    }
    return subscriber;
}

function closeSubscriber(subscriber) {
    if (!subscriber || subscriber.res.writableEnded) return;
    subscriber.res.end();
}

function emitEvent(session, type, payload = {}, options = {}) {
    payload = redactSecrets(payload, sessionSecrets(session));
    // Preview is passive infrastructure: failures must never enter the Agent path.
    try {
        if (type === 'run_started') {
            session.previewObserver?.stop(); session.previewObserver = null;
            const observer = ensureRunPreview(session, {
                configDirectory, getWorkspaceRoot, workspaceLocked,
                runId: payload.runId, descriptor: payload.descriptor,
                emit: (name, data) => emitEvent(session, name, data, { persist: false })
            });
            if (observer) payload = { ...payload, progressivePreview: true };
        } else if (['run_live_changes', 'heartbeat', 'run_status'].includes(type) && session.runState?.active) {
            const observer = ensureRunPreview(session, {
                configDirectory, getWorkspaceRoot, workspaceLocked, announce: true,
                emit: (name, data) => emitEvent(session, name, data, { persist: false })
            });
            if (type === 'run_live_changes') observer?.trigger();
            else payload = { ...payload, ...previewRunMetadata(session), context: session.context };
        }
        else if (type === 'run_finished' || type === 'run_failed') {
            session.previewObserver?.stop(); session.previewObserver = null;
        }
    } catch (error) { console.warn('[preview]', error.message); }

    const event = {
        id: options.id || randomUUID(),
        type,
        runId: payload.runId || session.runState.runId || null,
        createdAt: options.createdAt || new Date().toISOString(),
        payload
    };

    if (options.replaceId) {
        const index = session.timeline.findIndex((item) => item.id === options.replaceId);
        if (index >= 0) {
            session.timeline[index] = event;
        } else {
            session.timeline.push(event);
        }
    } else if (options.persist !== false) {
        session.timeline.push(event);
    }

    session.subscribers.forEach((subscriber) => {
        if (subscriber.res.writableEnded) return;
        if (subscriber.mode === 'run' && !subscriber.runId && type === 'run_started') {
            subscriber.runId = event.runId;
        }
        writeSseEvent(subscriber.res, type, event);
        if (
            subscriber.mode === 'run' &&
            subscriber.runId &&
            subscriber.runId === event.runId &&
            (type === 'run_finished' || type === 'run_failed')
        ) {
            closeSubscriber(subscriber);
            session.subscribers.delete(subscriber);
        }
    });

    if (options.persist !== false) {
        schedulePersistSession(session);
    }

    return event;
}

function setRunState(session, patch, eventName = 'run_status') {
    const hasStatusChanged = patch.status !== undefined && patch.status !== session.runState.status;
    const hasToolChanged = patch.currentTool !== undefined && patch.currentTool !== session.runState.currentTool;
    const hasMessageChanged = patch.stageMessage !== undefined && patch.stageMessage !== session.runState.stageMessage;
    const hasActiveChanged = patch.active !== undefined && patch.active !== session.runState.active;

    session.runState = {
        ...session.runState,
        ...patch,
        lastActivityAt: patch.lastActivityAt || new Date().toISOString()
    };

    if (eventName !== 'run_status' || hasStatusChanged || hasToolChanged || hasMessageChanged || hasActiveChanged) {
        emitEvent(session, eventName, {
            runState: session.runState,
            summary: patch.stageMessage || session.runState.stageMessage
        }, { persist: eventName !== 'run_status' ? true : false });
    }
}

function summarizeText(value, maxLength = 240) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function safeJson(value, maxLength = 3200) {
    try {
        const text = JSON.stringify(value, null, 2);
        if (!text) return '';
        return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
    } catch (error) {
        return summarizeText(String(value || ''), maxLength);
    }
}

function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function pickSdkOptions(input = {}, allowedKeys = SDK_JSON_OPTION_KEYS) {
    if (!isPlainObject(input)) return {};
    const output = {};
    for (const [key, value] of Object.entries(input)) {
        if (allowedKeys.has(key) && value !== undefined) {
            output[key] = value;
        }
    }
    return output;
}

function mergeSdkOptions(...items) {
    const output = {};
    for (const item of items) {
        if (!isPlainObject(item)) continue;
        for (const [key, value] of Object.entries(item)) {
            if (value === undefined) continue;
            if (
                isPlainObject(value)
                && isPlainObject(output[key])
                && ['env', 'mcpServers', 'agents', 'sandbox', 'toolConfig', 'extraArgs', 'outputFormat', 'jsonSchema'].includes(key)
            ) {
                output[key] = {
                    ...output[key],
                    ...value
                };
            } else {
                output[key] = value;
            }
        }
    }
    return output;
}

function stripReadifyRuntimeOptions(options = {}) {
    for (const key of READIFY_RUNTIME_OPTION_KEYS) {
        delete options[key];
    }
    return options;
}

function normalizeAgentRequestTimeoutMs(value, fallback = DEFAULT_AGENT_REQUEST_TIMEOUT_MS) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return Math.min(Math.max(fallback, MIN_AGENT_REQUEST_TIMEOUT_MS), MAX_AGENT_REQUEST_TIMEOUT_MS);
    }
    return Math.min(Math.max(Math.round(numeric), MIN_AGENT_REQUEST_TIMEOUT_MS), MAX_AGENT_REQUEST_TIMEOUT_MS);
}

function getAgentRequestTimeoutMs(session) {
    return getProviderRequestTimeoutMs(session?.providerConfig);
}

function getProviderRequestTimeoutMs(providerConfig) {
    const sdkOptions = providerConfig?.sdkOptions || {};
    for (const key of READIFY_RUNTIME_OPTION_KEYS) {
        if (sdkOptions[key] !== undefined) {
            return normalizeAgentRequestTimeoutMs(sdkOptions[key]);
        }
    }
    return normalizeAgentRequestTimeoutMs(DEFAULT_AGENT_REQUEST_TIMEOUT_MS);
}

function normalizeAgentMaxTurns(value, fallback = DEFAULT_AGENT_MAX_TURNS) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return Math.min(Math.max(fallback, MIN_AGENT_MAX_TURNS), MAX_AGENT_MAX_TURNS);
    }
    return Math.min(Math.max(Math.round(numeric), MIN_AGENT_MAX_TURNS), MAX_AGENT_MAX_TURNS);
}

function getProviderMaxTurns(providerConfig) {
    return normalizeAgentMaxTurns(providerConfig?.sdkOptions?.maxTurns);
}

function formatDurationMs(value) {
    const ms = normalizeAgentRequestTimeoutMs(value);
    const minutes = ms / 60000;
    if (Number.isInteger(minutes)) return `${minutes} 分钟`;
    return `${Math.round(ms / 1000)} 秒`;
}

function resolveSdkOptions(input = {}, allowedKeys = SDK_JSON_OPTION_KEYS) {
    for (const source of [input.sdkOptions, input.agentOptions, input.options]) {
        if (!isPlainObject(source)) continue;
        for (const [key, value] of Object.entries(source)) {
            if (value !== undefined && value !== null && !allowedKeys.has(key)) {
                throw createClassifiedError(`Agent option ${key} has no supported Pi mapping.`, 'config_error', 400);
            }
        }
    }
    const options = mergeSdkOptions(
        pickSdkOptions(input.sdkOptions, allowedKeys),
        pickSdkOptions(input.agentOptions, allowedKeys),
        pickSdkOptions(input.options, allowedKeys)
    );
    if (options.permissionMode === 'plan') options.permissionMode = 'default';
    return options;
}

function redactSensitiveSdkOptions(value) {
    if (Array.isArray(value)) {
        return value.map((item) => redactSensitiveSdkOptions(item));
    }
    if (!isPlainObject(value)) {
        return value;
    }
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
        const loweredKey = key.toLowerCase();
        const sensitiveKey =
            loweredKey === 'apikey' ||
            loweredKey === 'api_key' ||
            loweredKey === 'authorization' ||
            loweredKey.endsWith('token') ||
            loweredKey.includes('auth_token') ||
            loweredKey.includes('secret') ||
            loweredKey.includes('password');
        if (sensitiveKey) {
            output[key] = entry ? '***' : entry;
        } else {
            output[key] = redactSensitiveSdkOptions(entry);
        }
    }
    return output;
}

function sanitizeSdkOptionsForSnapshot(options = {}) {
    const snapshot = redactSensitiveSdkOptions(pickSdkOptions(options, SDK_JSON_OPTION_KEYS));
    delete snapshot.apiKey;
    if (snapshot.env && isPlainObject(snapshot.env)) {
        for (const key of Object.keys(snapshot.env)) {
            if (/key|token|secret|password|authorization/i.test(key)) {
                delete snapshot.env[key];
            }
        }
    }
    return snapshot;
}

function stableStringify(value) {
    const seen = new WeakSet();
    const normalize = (entry) => {
        if (Array.isArray(entry)) return entry.map((item) => normalize(item));
        if (!isPlainObject(entry)) return entry;
        if (seen.has(entry)) return '[Circular]';
        seen.add(entry);
        return Object.keys(entry).sort().reduce((acc, key) => {
            const normalized = normalize(entry[key]);
            if (normalized !== undefined) {
                acc[key] = normalized;
            }
            return acc;
        }, {});
    };
    return JSON.stringify(normalize(value));
}

async function loadAgentSdkExtension() {
    try {
        await fs.access(AGENT_SDK_EXTENSION_PATH);
    } catch {
        return {};
    }

    try {
        const extensionUrl = `${pathToFileURL(AGENT_SDK_EXTENSION_PATH).href}?t=${Date.now()}`;
        const module = await import(extensionUrl);
        const extension = isPlainObject(module.default)
            ? { ...module.default, ...module }
            : { ...module };
        logInfo('Loaded Agent extension', path.relative(ROOT_DIR, AGENT_SDK_EXTENSION_PATH));
        return extension;
    } catch (error) {
        console.warn('[agent-gateway] Failed to load Agent extension:', error);
        return {
            loadError: summarizeText(error?.message || String(error), 500)
        };
    }
}

function getAgentSdkExtensionStatus() {
    return {
        path: path.relative(ROOT_DIR, AGENT_SDK_EXTENSION_PATH),
        loaded: Boolean(agentSdkExtension && !agentSdkExtension.loadError && Object.keys(agentSdkExtension).length),
        error: agentSdkExtension?.loadError || ''
    };
}

function getExtensionOptions(...keys) {
    return mergeSdkOptions(...keys.map((key) => {
        const value = agentSdkExtension?.[key];
        return isPlainObject(value) ? value : {};
    }));
}

function getExtensionTools() {
    const directTools = Array.isArray(agentSdkExtension?.tools) ? agentSdkExtension.tools : [];
    return directTools.filter(Boolean);
}

function combineToolOptionWithExtensions(toolsOption) {
    if (getExtensionTools().length) throw new Error('旧 Agent 自定义工具需要迁移到 integrations/pi/prota-extension.ts。');
    return toolsOption;
}

function combineSystemPrompts(...parts) {
    return parts
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join('\n\n');
}

function composeQueryOptions(session, descriptor) {
    const extensionQueryOptions = getExtensionOptions('options', 'createAgentOptions', 'queryOptions');
    if (typeof agentSdkExtension?.canUseTool === 'function' && agentSdkExtension.canUseTool.protaPlaceholder !== true) {
        throw new Error('旧 Agent canUseTool 回调需要迁移到 integrations/pi/prota-extension.ts 的 tool_call Hook。');
    }
    for (const [key, value] of Object.entries(extensionQueryOptions)) {
        if (value !== undefined && value !== null && !SDK_QUERY_OPTION_KEYS.has(key)) {
            throw new Error(`Agent extension option ${key} has no supported Pi mapping.`);
        }
    }
    if (isPlainObject(agentSdkExtension?.hooks) && Object.keys(agentSdkExtension.hooks).length) {
        extensionQueryOptions.hooks = agentSdkExtension.hooks;
    }
    if (getExtensionTools().length) throw new Error('旧 Agent 自定义工具需要迁移到 integrations/pi/prota-extension.ts。');
    extensionQueryOptions.mcpServers = mergeSdkOptions(
        agentSdkExtension?.mcpServers || {}, agentSdkExtension?.createAgentOptions?.mcpServers || {},
        extensionQueryOptions.mcpServers || {});
    if (isPlainObject(agentSdkExtension?.agents) && Object.keys(agentSdkExtension.agents).length) {
        extensionQueryOptions.agents = mergeSdkOptions(extensionQueryOptions.agents || {}, agentSdkExtension.agents);
    }
    const sessionSdkOptions = pickSdkOptions(session.providerConfig.sdkOptions || {}, SDK_QUERY_OPTION_KEYS);
    const descriptorSdkOptions = pickSdkOptions(descriptor.sdkOptions || {}, SDK_QUERY_OPTION_KEYS);
    const queryOptions = mergeSdkOptions(
        pickSdkOptions(extensionQueryOptions, SDK_QUERY_OPTION_KEYS),
        sessionSdkOptions,
        descriptorSdkOptions
    );
    stripReadifyRuntimeOptions(queryOptions);

    queryOptions.cwd = getWorkspaceRoot();
    queryOptions.includePartialMessages = queryOptions.includePartialMessages ?? true;
    queryOptions.maxTurns = normalizeAgentMaxTurns(queryOptions.maxTurns);
    if (isSkillBackedDescriptor(descriptor)) {
        queryOptions.maxTurns = normalizeAgentMaxTurns(
            Math.max(queryOptions.maxTurns, MIN_SKILL_AGENT_MAX_TURNS)
        );
    }
    if (!Array.isArray(queryOptions.allowedTools)) {
        queryOptions.allowedTools = [...getAllowedToolsForRun(descriptor), ...enabledMcpTools(queryOptions.mcpServers)];
    }
    queryOptions.appendSystemPrompt = combineSystemPrompts(
        queryOptions.appendSystemPrompt,
        getSharedSystemPrompt(session, descriptor)
    );
    if (queryOptions.tools) {
        queryOptions.tools = combineToolOptionWithExtensions(queryOptions.tools);
    }
    return queryOptions;
}


function registerLocalSkill(definition) {
    localSkills.set(definition.id, {
        ...definition,
        source: definition.kind === 'skill' ? 'skill' : 'prota',
        action: definition.localOnly ? 'client' : 'gateway',
        availability: 'available',
        advanced: ['messages', 'api-type', 'config', 'delete-session', 'runtime'].includes(definition.id),
        ...definition,
        aliases: Array.isArray(definition.aliases) ? definition.aliases : []
    });
}

function getLocalSkill(skillId) {
    return resolveExecutionSkill(localSkills, skillId);
}

function findLocalSkillRecord(skillId) {
    const raw = String(skillId || '').trim();
    if (!raw) return null;
    const lowered = raw.toLowerCase();
    return Array.from(localSkills.values()).find((skill) => {
        if (skill.id === raw) return true;
        if (String(skill.label || '').toLowerCase() === lowered) return true;
        return (skill.aliases || []).some((alias) => String(alias).trim().toLowerCase() === lowered);
    }) || null;
}

function listUserInvocableSkills({ includeDisabled = false } = {}) {
    return Array.from(localSkills.values())
        .filter((skill) => skill.userInvocable !== false)
        .filter((skill) => includeDisabled || skill.enabled !== false)
        .map((skill) => ({
            id: skill.id,
            label: skill.label,
            description: skill.description,
            kind: skill.kind,
            icon: skill.icon,
            placeholder: skill.placeholder,
            defaultStarter: skill.defaultStarter,
            requiresMessage: Boolean(skill.requiresMessage),
            supportsFollowups: skill.supportsFollowups !== false,
            globalContext: Boolean(skill.globalContext),
            enabled: skill.enabled !== false,
            skillPath: skill.skillPath ? toPosixRelativePath(skill.skillPath) : null
        }));
}

async function getProjectSkillDetail(skillId) {
    await refreshProjectSkills({ force: true });
    const normalizedSkillId = normalizeCommandId(skillId);
    const skill = findLocalSkillRecord(normalizedSkillId);
    if (!skill?.skillPath) {
        throw createClassifiedError('未找到项目 .claude/skills 中的 Skill。', 'skill_not_found', 404);
    }
    const markdown = await fs.readFile(skill.skillPath, 'utf8');
    return {
        id: skill.id,
        label: skill.label,
        description: skill.description,
        kind: skill.kind,
        enabled: skill.enabled !== false,
        globalContext: Boolean(skill.globalContext),
        skillPath: toPosixRelativePath(skill.skillPath),
        markdown
    };
}

async function readProjectSkillState() {
    try {
        const parsed = JSON.parse(await fs.readFile(PROJECT_SKILL_STATE_PATH, 'utf8'));
        const disabled = Array.isArray(parsed.disabled)
            ? parsed.disabled.map(normalizeCommandId).filter(Boolean)
            : [];
        return { disabled };
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            logInfo('读取 Skill 状态失败', error.message);
        }
        return { disabled: [] };
    }
}

async function writeProjectSkillState(state) {
    const disabled = Array.from(new Set((state.disabled || []).map(normalizeCommandId).filter(Boolean))).sort();
    await fs.mkdir(PROJECT_SKILLS_DIR, { recursive: true });
    await fs.writeFile(PROJECT_SKILL_STATE_PATH, `${JSON.stringify({ disabled }, null, 2)}\n`, 'utf8');
    return { disabled };
}

async function setProjectSkillEnabled(skillId, enabled) {
    const normalizedSkillId = normalizeCommandId(skillId);
    if (!normalizedSkillId) {
        throw createClassifiedError('Skill ID 不能为空。', 'invalid_skill', 400);
    }
    await refreshProjectSkills({ force: true });
    const skill = Array.from(localSkills.values()).find((item) => item.id === normalizedSkillId && item.autoDiscovered);
    if (!skill) {
        throw createClassifiedError('未找到项目 .claude/skills 中的 Skill。', 'skill_not_found', 404);
    }
    const state = await readProjectSkillState();
    const disabled = new Set(state.disabled);
    if (enabled) {
        disabled.delete(normalizedSkillId);
    } else {
        disabled.add(normalizedSkillId);
    }
    await writeProjectSkillState({ disabled: Array.from(disabled) });
    await refreshProjectSkills({ force: true });
    return listUserInvocableSkills({ includeDisabled: true }).find((item) => item.id === normalizedSkillId);
}

async function deleteProjectSkill(skillId) {
    const normalizedSkillId = normalizeCommandId(skillId);
    if (!normalizedSkillId) {
        throw createClassifiedError('Skill ID 不能为空。', 'invalid_skill', 400);
    }
    await refreshProjectSkills({ force: true });
    const skill = Array.from(localSkills.values()).find((item) => (
        item.id === normalizedSkillId
        && item.autoDiscovered
        && item.skillPath
    ));
    if (!skill) {
        throw createClassifiedError('未找到要删除的 Skill 文件夹。', 'skill_not_found', 404);
    }

    // Skill ID comes from frontmatter.name and does not have to match the
    // containing directory name. Always delete the directory discovered from
    // SKILL.md instead of rebuilding a path from the ID.
    const targetDir = path.dirname(skill.skillPath);
    const relativeTargetDir = path.relative(PROJECT_SKILLS_DIR, targetDir);
    if (!relativeTargetDir || relativeTargetDir.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTargetDir)) {
        throw createClassifiedError('Skill 文件夹路径无效。', 'invalid_skill', 400);
    }
    let stat;
    try {
        stat = await fs.stat(targetDir);
    } catch {
        throw createClassifiedError('未找到要删除的 Skill 文件夹。', 'skill_not_found', 404);
    }
    if (!stat.isDirectory()) {
        throw createClassifiedError('目标路径不是 Skill 文件夹。', 'invalid_skill', 400);
    }
    await fs.rm(targetDir, { recursive: true, force: true });
    const state = await readProjectSkillState();
    const disabled = new Set(state.disabled);
    disabled.delete(normalizedSkillId);
    await writeProjectSkillState({ disabled: Array.from(disabled) });
    await refreshProjectSkills({ force: true });
    return { id: normalizedSkillId };
}

async function readTemplateState() {
    try {
        const parsed = JSON.parse(await fs.readFile(TEMPLATE_STATE_PATH, 'utf8'));
        const disabled = Array.isArray(parsed.disabled)
            ? parsed.disabled.map(normalizeCommandId).filter(Boolean)
            : [];
        return { disabled };
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            logInfo('读取模板状态失败', error.message);
        }
        return { disabled: [] };
    }
}

async function writeTemplateState(state) {
    const disabled = Array.from(new Set((state.disabled || []).map(normalizeCommandId).filter(Boolean))).sort();
    await fs.mkdir(path.dirname(TEMPLATE_STATE_PATH), { recursive: true });
    await fs.writeFile(TEMPLATE_STATE_PATH, `${JSON.stringify({ disabled }, null, 2)}\n`, 'utf8');
    return { disabled };
}

async function setTemplateEnabled(templateId, enabled) {
    const normalizedTemplateId = normalizeCommandId(templateId);
    if (!normalizedTemplateId) {
        throw createClassifiedError('模板 ID 不能为空。', 'invalid_template', 400);
    }
    const data = await listTemplateSystems({ includeDisabled: true });
    let frameworkExists = false;
    try {
        frameworkExists = (await fs.stat(path.join(TEMPLATE_FRAMEWORK_SKILLS_DIR, normalizedTemplateId))).isDirectory();
    } catch {}
    if (!data.templates.some((template) => template.id === normalizedTemplateId) && !frameworkExists) {
        throw createClassifiedError(`未找到模板：${templateId}`, 'template_not_found', 404);
    }
    const state = await readTemplateState();
    const disabled = new Set(state.disabled);
    if (enabled) {
        disabled.delete(normalizedTemplateId);
    } else {
        disabled.add(normalizedTemplateId);
    }
    await writeTemplateState({ disabled: Array.from(disabled) });
    return (await listTemplateSystems({ includeDisabled: true })).templates
        .find((template) => template.id === normalizedTemplateId)
        || { id: normalizedTemplateId, enabled };
}

async function deleteTemplateSystem(templateId) {
    const normalizedTemplateId = normalizeCommandId(templateId);
    if (!normalizedTemplateId) {
        throw createClassifiedError('模板 ID 不能为空。', 'invalid_template', 400);
    }
    const targetDir = path.join(TEMPLATE_SYSTEMS_DIR, normalizedTemplateId);
    let stat;
    try {
        stat = await fs.stat(targetDir);
    } catch {
        throw createClassifiedError('未找到要删除的模板文件夹。', 'template_not_found', 404);
    }
    if (!stat.isDirectory()) {
        throw createClassifiedError('目标路径不是模板文件夹。', 'invalid_template', 400);
    }
    await fs.rm(targetDir, { recursive: true, force: true });
    const state = await readTemplateState();
    const disabled = new Set(state.disabled);
    disabled.delete(normalizedTemplateId);
    await writeTemplateState({ disabled: Array.from(disabled) });
    return { id: normalizedTemplateId };
}

async function listTemplateSystems({ includeDisabled = true } = {}) {
    const state = await readTemplateState();
    const disabled = new Set(state.disabled);
    const legacyTemplates = await loadLegacyTemplatesMap();
    const templates = [];
    let entries = [];
    try {
        entries = await fs.readdir(TEMPLATE_SYSTEMS_DIR, { withFileTypes: true });
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const template = await readTemplateSystem(entry.name, legacyTemplates.get(entry.name));
        if (!template) continue;
        template.enabled = !disabled.has(template.id);
        if (includeDisabled || template.enabled) templates.push(template);
    }

    templates.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'zh-CN'));
    return {
        version: 2,
        source: 'src/templates/design-systems',
        root: toPosixRelativePath(TEMPLATE_SYSTEMS_DIR),
        supportedFormats: [
            'manifest.json',
            'DESIGN.md',
            'design-tokens.json',
            'tokens.css',
            'tailwind-v4.css',
            'components.html',
            'components.manifest.json',
            'USAGE.md'
        ],
        disabled: Array.from(disabled).sort(),
        templates
    };
}

async function loadLegacyTemplatesMap() {
    try {
        const parsed = JSON.parse(await fs.readFile(LEGACY_TEMPLATE_DATA_PATH, 'utf8'));
        const map = new Map();
        for (const template of parsed.templates || []) {
            if (template?.id) map.set(String(template.id), template);
        }
        return map;
    } catch {
        return new Map();
    }
}

async function readTemplateSystem(dirName, legacyTemplate = null) {
    const dir = path.join(TEMPLATE_SYSTEMS_DIR, dirName);
    const manifestPath = path.join(dir, 'manifest.json');
    let manifest = null;
    try {
        manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            logInfo('跳过模板 manifest', `${dirName} · ${error.message}`);
        }
    }

    const id = normalizeCommandId(manifest?.id || legacyTemplate?.id || dirName);
    if (!id) return null;
    const fileNames = {
        design: manifest?.files?.design || 'DESIGN.md',
        tokens: manifest?.files?.tokens || 'tokens.css',
        designTokens: manifest?.files?.designTokens || 'design-tokens.json',
        tailwind: manifest?.files?.tailwind || 'tailwind-v4.css',
        components: manifest?.files?.components || 'components.html',
        usage: manifest?.usage || 'USAGE.md',
        componentsManifest: manifest?.componentsManifest || 'components.manifest.json'
    };
    const files = {};
    for (const [key, fileName] of Object.entries(fileNames)) {
        const absoluteFile = path.join(dir, fileName);
        try {
            await fs.access(absoluteFile);
            files[key] = toPosixRelativePath(absoluteFile);
        } catch {
            files[key] = null;
        }
    }

    const designTokens = await readDesignTokens(path.join(dir, fileNames.designTokens));
    const preview = {
        ...(legacyTemplate?.preview || {}),
        ...buildTemplatePreview(designTokens, legacyTemplate?.preview || {})
    };
    const tags = Array.from(new Set([
        ...(Array.isArray(legacyTemplate?.tags) ? legacyTemplate.tags : []),
        ...(Array.isArray(manifest?.craft?.suggested) ? manifest.craft.suggested : []),
        manifest?.source?.type
    ].filter(Boolean)));

    return {
        id,
        name: manifest?.name || legacyTemplate?.name || startCaseFromId(id),
        category: manifest?.category || legacyTemplate?.category || 'style',
        description: manifest?.description || legacyTemplate?.description || '',
        tags,
        preview,
        filePath: files.design || legacyTemplate?.filePath || null,
        files,
        manifestPath: manifest ? toPosixRelativePath(manifestPath) : null,
        schemaVersion: manifest?.schemaVersion || null,
        importMode: manifest?.importMode || null
    };
}

async function readDesignTokens(filePath) {
    try {
        const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
        return Array.isArray(parsed.tokens) ? parsed.tokens : [];
    } catch {
        return [];
    }
}

function buildTemplatePreview(tokens, fallback = {}) {
    const value = (...names) => findTokenValue(tokens, names);
    return {
        background: value('--bg', '--background', '--color-bg') || fallback.background || '#ffffff',
        surface: value('--surface', '--surface-warm', '--color-surface') || fallback.surface || '#ffffff',
        accent: value('--accent', '--primary', '--brand', '--color-accent') || fallback.accent || '#6366f1',
        accentSecondary: value('--accent-2', '--accent-secondary', '--secondary') || fallback.accentSecondary || fallback.accent,
        text: value('--fg', '--text', '--color-text') || fallback.text || '#0f172a',
        muted: value('--muted', '--fg-2', '--meta', '--color-muted') || fallback.muted || '#64748b',
        border: value('--border', '--line', '--color-border') || fallback.border || '#e2e8f0',
        fontHeading: value('--font-heading', '--font-display') || fallback.fontHeading || 'Inter',
        fontBody: value('--font-body', '--font-sans') || fallback.fontBody || 'Inter',
        radius: parseTemplateRadius(value('--radius', '--radius-md')) ?? fallback.radius ?? 10
    };
}

function findTokenValue(tokens, names) {
    const wanted = new Set(names);
    const token = tokens.find((item) => wanted.has(item?.name));
    return token?.value || null;
}

function parseTemplateRadius(value) {
    if (value == null || value === '') return null;
    const number = Number.parseFloat(String(value));
    return Number.isFinite(number) ? number : null;
}

function startCaseFromId(id) {
    return String(id || '')
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Template';
}

function escapeSkillFrontmatterValue(value = '') {
    return JSON.stringify(String(value || '').replace(/\r?\n/g, ' ').trim());
}

function buildImportedSkillMarkdown({ id, label, description, body }) {
    const cleanDescription = String(description || `自定义 Skill: ${label}`).trim();
    const cleanBody = String(body || '').trim() || `Use this skill when the user asks to run ${label}.\n\nFollow the user's current task and apply this skill's domain guidance.`;
    return [
        '---',
        `name: ${id}`,
        `label: ${escapeSkillFrontmatterValue(label)}`,
        `description: ${escapeSkillFrontmatterValue(cleanDescription)}`,
        'kind: custom-skill',
        'userInvocable: true',
        '---',
        '',
        cleanBody,
        ''
    ].join('\n');
}

function normalizeImportedFolderPath(value = '') {
    let folderPath = String(value || '').trim();
    if ((folderPath.startsWith('"') && folderPath.endsWith('"'))
        || (folderPath.startsWith("'") && folderPath.endsWith("'"))) {
        folderPath = folderPath.slice(1, -1).trim();
    }
    return path.resolve(folderPath.replace(/^~(?=$|\/|\\)/, process.env.HOME || '~'));
}

function isPathInside(childPath, parentPath) {
    const relative = path.relative(parentPath, childPath);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function importProjectSkill(body = {}) {
    const sourceFolder = String(body.sourceFolder || body.folderPath || body.path || '').trim();
    if (sourceFolder) {
        const sourceDir = normalizeImportedFolderPath(sourceFolder);
        const sourceSkillPath = path.join(sourceDir, 'SKILL.md');
        let sourceStat;
        try {
            sourceStat = await fs.stat(sourceDir);
            await fs.access(sourceSkillPath);
        } catch {
            throw createClassifiedError('导入失败：请选择一个包含 SKILL.md 的文件夹。', 'invalid_skill_folder', 400);
        }
        if (!sourceStat.isDirectory()) {
            throw createClassifiedError('导入失败：来源路径不是文件夹。', 'invalid_skill_folder', 400);
        }
        const skillText = await fs.readFile(sourceSkillPath, 'utf8');
        const frontmatter = parseSkillFrontmatter(skillText);
        const id = normalizeCommandId(body.id || frontmatter.name || path.basename(sourceDir));
        if (!id) {
            throw createClassifiedError('导入失败：无法从文件夹名或 SKILL.md frontmatter 解析 Skill ID。', 'invalid_skill', 400);
        }
        const targetDir = path.join(PROJECT_SKILLS_DIR, id);
        const targetSkillPath = path.join(targetDir, 'SKILL.md');
        if (path.resolve(sourceDir) !== path.resolve(targetDir)) {
            if (isPathInside(sourceDir, targetDir)) {
                throw createClassifiedError('导入失败：来源文件夹不能位于同名目标 Skill 目录内部。', 'invalid_skill_folder', 400);
            }
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.mkdir(PROJECT_SKILLS_DIR, { recursive: true });
            await fs.cp(sourceDir, targetDir, { recursive: true, force: true });
        }
        await refreshProjectSkills({ force: true });
        const imported = getLocalSkill(id);
        return {
            id,
            label: imported?.label || String(frontmatter.label || deriveSkillLabel(id)).trim(),
            description: imported?.description || String(frontmatter.description || '').trim(),
            skillPath: toPosixRelativePath(targetSkillPath)
        };
    }

    if (Array.isArray(body.files) && body.files.length > 0) {
        const normalized = normalizeImportedFileList(body.files);
        const skillMd = normalized.find((file) => file.relativePath === 'SKILL.md');
        if (!skillMd) {
            throw createClassifiedError('导入失败：未在所选文件夹中找到 SKILL.md。', 'invalid_skill_folder', 400);
        }
        const skillText = String(skillMd.content || '');
        const frontmatter = parseSkillFrontmatter(skillText);
        const id = normalizeCommandId(body.id || frontmatter.name || 'imported-skill');
        if (!id) {
            throw createClassifiedError('导入失败：无法从 SKILL.md frontmatter 解析 Skill ID。', 'invalid_skill', 400);
        }
        const targetDir = path.join(PROJECT_SKILLS_DIR, id);
        const targetSkillPath = path.join(targetDir, 'SKILL.md');
        await fs.rm(targetDir, { recursive: true, force: true });
        await fs.mkdir(targetDir, { recursive: true });
        for (const file of normalized) {
            if (!isPathInside(path.resolve(targetDir, file.relativePath), targetDir)) continue;
            const targetPath = path.join(targetDir, file.relativePath);
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.writeFile(targetPath, String(file.content || ''), 'utf8');
        }
        await refreshProjectSkills({ force: true });
        const imported = getLocalSkill(id);
        return {
            id,
            label: imported?.label || String(frontmatter.label || deriveSkillLabel(id)).trim(),
            description: imported?.description || String(frontmatter.description || '').trim(),
            skillPath: toPosixRelativePath(targetSkillPath)
        };
    }

    const id = normalizeCommandId(body.id || body.name || body.label);
    const label = String(body.label || body.name || deriveSkillLabel(id)).trim();
    const description = String(body.description || '').trim();
    const skillBody = String(body.body || '').trim();
    if (!id || !label) {
        throw createClassifiedError('Skill ID 和显示名称不能为空。', 'invalid_skill', 400);
    }
    const skillDir = path.join(PROJECT_SKILLS_DIR, id);
    const skillPath = path.join(skillDir, 'SKILL.md');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(skillPath, buildImportedSkillMarkdown({ id, label, description, body: skillBody }), 'utf8');
    await refreshProjectSkills({ force: true });
    return {
        id,
        label,
        description: description || `自定义 Skill: ${label}`,
        skillPath: toPosixRelativePath(skillPath)
    };
}

function normalizeImportedFileList(files) {
    const cleaned = [];
    for (const file of files) {
        const raw = String(file?.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
        if (!raw) continue;
        cleaned.push({ relativePath: raw, content: String(file?.content ?? '') });
    }
    if (cleaned.length === 0) return [];
    const withSlash = cleaned.filter((file) => file.relativePath.includes('/'));
    if (cleaned.length > 1 && withSlash.length === cleaned.length) {
        const topFolders = new Set(withSlash.map((file) => file.relativePath.slice(0, file.relativePath.indexOf('/'))));
        if (topFolders.size === 1) {
            const prefix = `${[...topFolders][0]}/`;
            return cleaned.map((file) => ({
                relativePath: file.relativePath.slice(prefix.length),
                content: file.content
            }));
        }
    }
    return cleaned;
}

function registerLocalCommand(definition) {
    localCommands.set(definition.id, {
        source: definition.kind === 'skill' ? 'skill' : 'prota',
        action: definition.localOnly ? 'client' : 'gateway',
        availability: 'available',
        advanced: ['messages', 'api-type', 'config', 'delete-session', 'runtime'].includes(definition.id),
        ...definition,
        aliases: Array.isArray(definition.aliases) ? definition.aliases : []
    });
}

function parseSkillFrontmatter(text = '') {
    if (!text.startsWith('---')) return {};
    const endIndex = text.indexOf('\n---', 3);
    if (endIndex === -1) return {};
    const raw = text.slice(3, endIndex).trim();
    const result = {};
    let currentKey = null;
    for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const listMatch = line.match(/^\s*-\s+(.+)$/);
        if (currentKey && listMatch) {
            const current = Array.isArray(result[currentKey]) ? result[currentKey] : [];
            current.push(cleanFrontmatterValue(listMatch[1]));
            result[currentKey] = current;
            continue;
        }
        const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (!match) continue;
        currentKey = match[1];
        const value = match[2].trim();
        result[currentKey] = value ? parseFrontmatterValue(value) : [];
    }
    return result;
}

function cleanFrontmatterValue(value = '') {
    return String(value)
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .trim();
}

function parseFrontmatterValue(value = '') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed
            .slice(1, -1)
            .split(',')
            .map(cleanFrontmatterValue)
            .filter(Boolean);
    }
    return cleanFrontmatterValue(trimmed);
}

function normalizeFrontmatterList(value) {
    if (Array.isArray(value)) return value.map(cleanFrontmatterValue).filter(Boolean);
    if (typeof value === 'string') {
        return value
            .split(',')
            .map(cleanFrontmatterValue)
            .filter(Boolean);
    }
    return [];
}

function deriveSkillLabel(skillId) {
    return String(skillId || 'Skill')
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1))
        .join(' ');
}

function deriveSkillIcon(skillId) {
    return String(skillId || 'SKL')
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 3)
        .toUpperCase() || 'SKL';
}

function normalizeCommandId(value) {
    return String(value || '')
        .trim()
        .replace(/^\//, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function findProjectSkillFiles() {
    const entries = await fs.readdir(PROJECT_SKILLS_DIR, { withFileTypes: true }).catch(() => []);
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(PROJECT_SKILLS_DIR, entry.name, 'SKILL.md'));
}

function removeAutoDiscoveredSkillRegistration(cacheKey, record) {
    if (!record || record.builtIn) {
        autoDiscoveredSkills.delete(cacheKey);
        return;
    }

    const skill = localSkills.get(record.id);
    if (skill?.autoDiscovered && skill.skillPath === cacheKey) {
        localSkills.delete(record.id);
    }

    const command = localCommands.get(record.commandId);
    if (command?.autoDiscovered && command.skillId === record.id) {
        localCommands.delete(record.commandId);
    }

    autoDiscoveredSkills.delete(cacheKey);
}

async function refreshProjectSkills({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastProjectSkillRefreshAt < 1000) return;
    lastProjectSkillRefreshAt = now;

    const skillState = await readProjectSkillState();
    const disabledSkillIds = new Set(skillState.disabled);
    const files = await findProjectSkillFiles();
    const currentFiles = new Set(files);
    for (const [cacheKey, record] of autoDiscoveredSkills.entries()) {
        if (!currentFiles.has(cacheKey)) {
            removeAutoDiscoveredSkillRegistration(cacheKey, record);
        }
    }

    for (const skillPath of files) {
        let stat;
        try {
            stat = await fs.stat(skillPath);
        } catch {
            continue;
        }
        const cacheKey = skillPath;
        const previous = autoDiscoveredSkills.get(cacheKey);
        if (!force && previous?.mtimeMs === stat.mtimeMs) continue;
        removeAutoDiscoveredSkillRegistration(cacheKey, previous);

        try {
            const skillText = await fs.readFile(skillPath, 'utf8');
            const frontmatter = parseSkillFrontmatter(skillText);
            const skillId = normalizeCommandId(frontmatter.name || path.basename(path.dirname(skillPath)));
            if (!skillId) continue;
            const existingLocalSkill = localSkills.get(skillId);
            if (existingLocalSkill && !existingLocalSkill.autoDiscovered) {
                autoDiscoveredSkills.set(cacheKey, {
                    id: skillId,
                    commandId: normalizeCommandId(frontmatter.command || skillId),
                    mtimeMs: stat.mtimeMs,
                    builtIn: true
                });
                continue;
            }
            const aliases = normalizeFrontmatterList(frontmatter.aliases);
            const description = String(frontmatter.description || `运行 ${skillId} skill。`).trim();
            const label = String(frontmatter.label || deriveSkillLabel(skillId)).trim();
            const icon = String(frontmatter.icon || deriveSkillIcon(skillId)).trim();
            const allowedTools = normalizeFrontmatterList(frontmatter.allowedTools);
            const userInvocable = frontmatter.userInvocable !== false;
            const commandId = normalizeCommandId(frontmatter.command || skillId);
            const enabled = !disabledSkillIds.has(skillId);
            const commandAliases = [
                commandId,
                `/${commandId}`,
                skillId,
                `/${skillId}`,
                ...aliases,
                ...aliases.map((alias) => `/${String(alias).replace(/^\//, '')}`)
            ].filter(Boolean);

            registerLocalSkill({
                id: skillId,
                label,
                description,
                kind: String(frontmatter.kind || 'custom-skill'),
                icon,
                placeholder: String(frontmatter.placeholder || `输入 ${label} 的执行范围或补充要求。`),
                defaultStarter: String(frontmatter.defaultStarter || `请严格按照 ${skillId} skill 说明执行。`),
                requiresMessage: frontmatter.requiresMessage === true,
                supportsFollowups: frontmatter.supportsFollowups !== false,
                executionPrompt: String(frontmatter.executionPrompt || `请严格遵循 ${skillId} skill 的说明。`),
                systemHint: String(frontmatter.systemHint || `当前任务由 ${skillId} skill 驱动。`),
                allowedTools: allowedTools.length ? allowedTools : ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash', 'AskUserQuestion', 'Skill'],
                aliases,
                userInvocable,
                globalContext: frontmatter.globalContext === true,
                enabled,
                autoDiscovered: true,
                skillPath
            });

            const existingCommand = localCommands.get(commandId);

            if (enabled && userInvocable && commandId && (!existingCommand || existingCommand.autoDiscovered)) {
                registerLocalCommand({
                    id: commandId,
                    label,
                    aliases: commandAliases,
                    description,
                    category: 'Skills',
                    kind: 'skill',
                    icon,
                    usage: `/${commandId} [需求]`,
                    examples: [`/${commandId}`],
                    argumentMode: frontmatter.requiresMessage === true ? 'required-text' : 'optional-text',
                    supportsSession: true,
                    dangerous: false,
                    skillId,
                    autoDiscovered: true
                });
            }

            autoDiscoveredSkills.set(cacheKey, {
                id: skillId,
                commandId,
                mtimeMs: stat.mtimeMs
            });
        } catch (error) {
            logInfo('跳过无效 Skill', `${path.relative(ROOT_DIR, skillPath)} · ${error.message}`);
        }
    }
}

function getLocalCommand(commandId, session = null) {
    const raw = String(commandId || '').trim();
    if (!raw) return null;
    const normalized = raw.startsWith('/') ? raw.slice(1) : raw;
    const lowered = normalized.toLowerCase();
    return [...localCommands.values(), ...(session?._piCommands || [])].find((command) => {
        if (command.id === normalized) return true;
        if (String(command.label || '').toLowerCase() === lowered) return true;
        return (command.aliases || []).some((alias) => String(alias).replace(/^\//, '').trim().toLowerCase() === lowered);
    }) || null;
}

function listUserInvocableCommands() {
    return Array.from(localCommands.values()).map((command) => ({
        id: command.id,
        label: command.label,
        aliases: command.aliases,
        description: command.description,
        category: command.category,
        kind: command.kind,
        icon: command.icon,
        usage: command.usage,
        examples: command.examples || [],
        argumentMode: command.argumentMode || 'optional-text',
        supportsSession: command.supportsSession !== false,
        dangerous: Boolean(command.dangerous),
        localOnly: Boolean(command.localOnly),
        skillId: command.skillId || null,
        source: command.source, action: command.action, availability: command.availability, advanced: command.advanced,
        requiresConfirmation: Boolean(command.requiresConfirmation)
    }));
}

function isSkillDescriptor(descriptor, skillId) {
    return descriptor?.kind === 'skill' && descriptor?.skillId === skillId;
}

function isProductDocDescriptor(descriptor, command = null) {
    const resolvedCommand = command || (descriptor?.kind === 'command' ? getLocalCommand(descriptor.commandId) : null);
    return isSkillDescriptor(descriptor, 'generate-product-doc')
        || (descriptor?.kind === 'command' && resolvedCommand?.skillId === 'generate-product-doc');
}

function isAiReadyPrdDescriptor(descriptor, command = null) {
    const resolvedCommand = command || (descriptor?.kind === 'command' ? getLocalCommand(descriptor.commandId) : null);
    return isSkillDescriptor(descriptor, 'generate-ai-ready-prd')
        || (descriptor?.kind === 'command' && resolvedCommand?.skillId === 'generate-ai-ready-prd');
}

function isBusinessPrdDescriptor(descriptor, command = null) {
    const resolvedCommand = command || (descriptor?.kind === 'command' ? getLocalCommand(descriptor.commandId) : null);
    return isSkillDescriptor(descriptor, 'generate-business-prd')
        || (descriptor?.kind === 'command' && resolvedCommand?.skillId === 'generate-business-prd');
}

function isAnyPrdDescriptor(descriptor, command = null) {
    return isProductDocDescriptor(descriptor, command)
        || isAiReadyPrdDescriptor(descriptor, command)
        || isBusinessPrdDescriptor(descriptor, command);
}

function getDescriptorSkill(descriptor) {
    if (!descriptor) return null;
    if (descriptor.kind === 'skill') return getLocalSkill(descriptor.skillId);
    if (descriptor.kind === 'command') {
        const command = getLocalCommand(descriptor.commandId);
        return command?.skillId ? getLocalSkill(command.skillId) : null;
    }
    return null;
}

function isSkillBackedDescriptor(descriptor) {
    return Boolean(getDescriptorSkill(descriptor));
}

function getDescriptorUserIntent(descriptor) {
    if (!descriptor) return '';
    if (descriptor.kind === 'message' || descriptor.kind === 'skill') {
        return descriptor.message || descriptor.summary || '';
    }
    if (descriptor.kind === 'command') {
        return descriptor.arguments || descriptor.message || descriptor.summary || '';
    }
    if (descriptor.kind === 'dev-simulate') {
        return descriptor.scenario || descriptor.summary || '';
    }
    return descriptor.summary || '';
}

function isGlobalRunRequest(kind, body = {}, session = null) {
    const hasExplicitPageContext = body.pageId
        && body.version
        && body.pageId !== '__global__'
        && body.sessionScope !== 'global'
        && !body.globalContext;
    if (hasExplicitPageContext) return false;
    if (body.sessionScope === 'global' || body.globalContext) return true;
    if (kind === 'skill') {
        return Boolean(getLocalSkill(body.skillId)?.globalContext);
    }
    if (kind === 'command') {
        const command = getLocalCommand(body.commandId);
        return Boolean(command?.skillId && getLocalSkill(command.skillId)?.globalContext);
    }
    return session?.sessionScope === 'global';
}

function getSessionTaskDescriptor(session) {
    const candidate = session.runState?.lastTaskDescriptor || session.runState?.lastDescriptor || session.runState?.descriptor || null;
    if (candidate && candidate.kind !== 'message') return candidate;

    const timeline = Array.isArray(session.timeline) ? session.timeline : [];
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
        const descriptor = timeline[i]?.payload?.descriptor;
        if (descriptor && descriptor.kind && descriptor.kind !== 'message') {
            return descriptor;
        }
    }
    return null;
}

function buildFollowUpContextPrompt(session, descriptor) {
    if (descriptor.kind !== 'message') return '';
    const previousDescriptor = session.activeRun?.previousTaskDescriptor || getSessionTaskDescriptor(session);
    if (!previousDescriptor) return '';

    const previousSkill = getDescriptorSkill(previousDescriptor);
    const previousIntent = getDescriptorUserIntent(previousDescriptor);
    const followUp = descriptor.message || '';
    const lines = [
        '这是同一 Prota 终端会话中的多轮跟进消息，不要当成一个全新的闲聊请求。',
        '',
        '请先读取当前仓库状态和上一轮已产生的文件，再基于用户本轮补充继续推进；如果上一轮失败或未完成，请定位原因并继续完成，不要只回复简短总结。',
        '',
        `当前页面范围：${formatPageScope(session.context)}`,
        ...formatPagePathLines(session.context),
        `上一轮任务类型：${previousDescriptor.kind}${previousDescriptor.skillId ? ` · ${previousDescriptor.skillId}` : ''}${previousDescriptor.commandId ? ` · /${previousDescriptor.commandId}` : ''}`,
        previousIntent ? `上一轮用户意图：${previousIntent}` : '',
        session.runState?.lastSummary ? `上一轮结果摘要：${session.runState.lastSummary}` : '',
        session.runState?.lastError ? `上一轮错误：${session.runState.lastError}` : '',
        '',
        `本轮用户跟进：${followUp}`,
        ''
    ].filter(Boolean);

    if (previousSkill?.executionPrompt) {
        lines.push('上一轮相关 Skill 的执行要求仍然适用：', previousSkill.executionPrompt);
    }

    if (previousSkill?.id) {
        lines.push(`请继续按 ${previousSkill.id} 的任务边界执行，必要时直接修改文件并给出完成结果。`);
    }

    return lines.join('\n');
}

function createRunDescriptor(kind, context, input = {}) {
    const attachments = getRunAttachments(input);
    const sdkOptions = resolveSdkOptions(input, SDK_QUERY_OPTION_KEYS);
    const attachmentSummary = attachments.length ? ` · ${attachments.length} 张图片` : '';
    if (kind === 'message') {
        return {
            kind,
            title: '对话消息',
            summary: summarizeText((input.message || '新的对话消息') + attachmentSummary),
            message: input.message || '',
            attachments,
            sdkOptions,
            continuation: Boolean(input.continuation),
            context
        };
    }

    if (kind === 'skill') {
        const skill = getLocalSkill(input.skillId);
        const skillLabel = skill?.label || input.skillId || 'Skill';
        const message = String(input.message || skill?.defaultStarter || '').trim();
        return {
            kind,
            skillId: skill?.id || input.skillId,
            skillLabel,
            title: skillLabel,
            summary: summarizeText(
                (message
                    || skill?.description
                    || `运行 ${skillLabel}`) + attachmentSummary,
                240
            ),
            message,
            attachments,
            sdkOptions,
            context
        };
    }

    if (kind === 'command') {
        const command = getLocalCommand(input.commandId);
        const commandLabel = command?.label || input.commandId || 'Command';
        const argumentsText = String(input.arguments || '').trim();
        return {
            kind,
            commandId: command?.id || input.commandId,
            commandLabel,
            title: `/${command?.id || input.commandId || 'command'}`,
            summary: summarizeText(
                ([commandLabel, argumentsText].filter(Boolean).join(' · ') || `执行 ${commandLabel}`) + attachmentSummary,
                240
            ),
            message: input.message || '',
            arguments: argumentsText,
            attachments,
            sdkOptions,
            context
        };
    }

    if (kind === 'dev-simulate') {
        const scenario = input.scenario || 'full_flow';
        const labels = {
            full_flow: '全流程模拟',
            interruptible: '可中断模拟',
            failure: '失败态模拟'
        };
        return {
            kind,
            scenario,
            title: `开发模拟 · ${labels[scenario] || scenario}`,
            summary: `验证 ${labels[scenario] || scenario} 场景的状态流与恢复能力`,
            sdkOptions,
            context
        };
    }

    return {
        kind,
        title: '生成 PRD',
        summary: `为 ${context.pageId}/${context.version} 生成产品文档`,
        attachments,
        sdkOptions,
        context
    };
}

function getDescriptorTitleSource(descriptor = {}) {
    return [
        descriptor.message,
        descriptor.arguments,
        descriptor.summary,
        descriptor.skillLabel,
        descriptor.commandLabel,
        descriptor.title
    ].filter(Boolean).map((item) => String(item).trim()).find(Boolean) || '';
}

function createLocalSessionTitle(context, descriptor = {}) {
    const source = getDescriptorTitleSource(descriptor)
        .replace(/^\/[a-z0-9_-]+\s*/i, '')
        .replace(/^请(根据|基于|帮我|帮忙|继续)?/u, '')
        .replace(/^(我想|我要|希望|需要|请你)/u, '')
        .replace(/^(做一个|做个|新增|优化|生成)/u, '')
        .trim();
    return normalizeSessionTitle(source, `${context.pageId}${context.version}`);
}

function isGenericSessionTitle(value = '') {
    const title = normalizeSessionTitle(value, '');
    if (!title) return true;
    if (title.endsWith('新会话')) return true;
    return new Set([
        SESSION_TITLE_FALLBACK,
        '对话消息',
        '新增页面',
        '生成原型',
        '生成PRD',
        'AIPRD',
        '页面分析',
        '迭代版本',
        '开发模拟'
    ]).has(title) || title.startsWith('/');
}

function shouldRefreshSessionTitle(session, descriptor) {
    if (!session || !descriptor || session.engineInfo?.sessionName) return false;
    const hasPriorRun = (session.timeline || []).some((event) => event.type === 'run_started');
    return !hasPriorRun || isGenericSessionTitle(session.title);
}

function buildSessionTitlePrompt(session, descriptor) {
    const source = summarizeText(getDescriptorTitleSource(descriptor), 1200);
    const kindCopy = {
        message: '普通对话',
        skill: descriptor.skillLabel || descriptor.skillId || 'Skill',
        command: descriptor.commandLabel || descriptor.commandId || 'Command',
        'dev-simulate': '开发模拟'
    }[descriptor.kind] || descriptor.kind || '任务';
    return [
        '请为下面 Prota 终端会话生成一个中文短标题。',
        '要求：10个字以内；只输出标题本身；不要引号、标点、换行、编号；不要使用“对话消息”“新会话”等泛称。',
        '',
        `页面范围：${session.context?.globalContext ? '未限定页面范围' : `${session.context.pageId}/${session.context.version}`}`,
        `任务类型：${kindCopy}`,
        `用户需求：${source || descriptor.title || descriptor.kind || ''}`
    ].join('\n');
}

async function generateAiSessionTitle(session, descriptor, fallbackTitle) {
    if (!session?.providerConfig?.apiKey) return '';
    const titleSession = {
        id: `title-${randomUUID()}`, _transient: true, context: session.context,
        providerConfig: { ...session.providerConfig, model: SESSION_TITLE_MODEL,
            sdkOptions: { maxTokens: SESSION_TITLE_MAX_TOKENS, maxTurns: 1, permissionMode: 'bypassPermissions' } }
    };
    try {
        const result = await piGateway.run(titleSession, {
            prompt: buildSessionTitlePrompt(session, descriptor), runId: randomUUID(),
            options: { allowedTools: [], maxTurns: 1, maxTokens: SESSION_TITLE_MAX_TOKENS,
                permissionMode: 'bypassPermissions', requestTimeoutMs: 12000,
                appendSystemPrompt: '只输出10个字以内的中文会话标题，不解释。' },
            signal: AbortSignal.timeout(12000), emit: () => {}, setRunState: () => {},
            approval: async () => 'deny', question: async () => { throw new Error('Title generation cannot ask questions'); }
        });
        return normalizeSessionTitle(result.result, fallbackTitle);
    } catch (error) {
        console.warn('[agent-gateway] Failed to generate AI session title:', error.message);
        return '';
    } finally {
        await piGateway.dispose(titleSession.id);
        const paths = sessionPaths(titleSession, getWorkspaceRoot(), configDirectory);
        await fs.rm(paths.config, { recursive: true, force: true });
        await fs.rm(paths.sessions, { recursive: true, force: true });
    }
}

function emitSessionTitleUpdated(session, source = 'local') {
    emitEvent(session, 'session_updated', {
        sessionId: session.id,
        title: session.engineInfo?.sessionName || normalizeSessionTitle(session.title),
        source,
        context: session.context
    }, { persist: false });
}

async function refreshSessionTitle(session, descriptor) {
    if (!shouldRefreshSessionTitle(session, descriptor)) return;
    const fallbackTitle = createLocalSessionTitle(session.context, descriptor);
    const previousTitle = normalizeSessionTitle(session.title, '');
    if (fallbackTitle && fallbackTitle !== previousTitle) {
        session.title = fallbackTitle;
        emitSessionTitleUpdated(session, 'local');
    }
    const aiTitle = await generateAiSessionTitle(session, descriptor, fallbackTitle);
    if (aiTitle && aiTitle !== normalizeSessionTitle(session.title, '')) {
        session.title = aiTitle;
        emitSessionTitleUpdated(session, 'ai');
    }
}

async function buildActionPrompt(session, descriptor, internalInstructions = '') {
    if (descriptor.kind === 'message') {
        const followUpPrompt = buildFollowUpContextPrompt(session, descriptor);
        const messagePrompt = [
            followUpPrompt || descriptor.message,
            internalInstructions,
            followUpPrompt ? (session._skillPromptText || '') : ''
        ].filter(Boolean).join('\n\n');
        return buildPromptWithAttachments(descriptor, messagePrompt);
    }

    if (descriptor.kind === 'dev-simulate') {
        return `开发模拟场景：${descriptor.scenario || 'full_flow'}`;
    }

    if (descriptor.kind === 'command') {
        const command = getLocalCommand(descriptor.commandId);
        if (command?.skillId) {
            const skill = getLocalSkill(command.skillId);
            const leadMessage = descriptor.arguments || skill?.defaultStarter || '';
            const commandSkillPrompt = [
                leadMessage,
                skill?.executionPrompt || '',
                session._skillPromptText || ''
            ].filter(Boolean).join('\n\n');
            return buildPromptWithAttachments(descriptor, commandSkillPrompt);
        }
        const commandPrompt = [
            command?.systemPrompt || '',
            descriptor.arguments || descriptor.message || ''
        ].filter(Boolean).join('\n\n');
        return buildPromptWithAttachments(descriptor, commandPrompt);
    }

    const skill = getLocalSkill(descriptor.skillId);
    const skillPrompt = session._skillPromptText || '';
    const leadMessage = descriptor.message || skill?.defaultStarter || '';
    const skillPromptText = [
        leadMessage,
        internalInstructions,
        skill?.executionPrompt || '',
        skillPrompt
    ].filter(Boolean).join('\n\n');
    return buildPromptWithAttachments(descriptor, skillPromptText);
}

function getAllowedToolsForRun(descriptor) {
    if (descriptor.kind === 'dev-simulate') {
        return [];
    }
    if (descriptor.kind === 'command') {
        const command = getLocalCommand(descriptor.commandId);
        if (command?.skillId) {
            if (Array.isArray(command.allowedTools) && command.allowedTools.length) {
                return command.allowedTools;
            }
            return getLocalSkill(command.skillId)?.allowedTools
                || ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'AskUserQuestion', 'Skill'];
        }
        return command?.allowedTools || [];
    }
    if (descriptor.kind === 'skill') {
        return getLocalSkill(descriptor.skillId)?.allowedTools
            || ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'AskUserQuestion', 'Skill'];
    }
    return ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash', 'AskUserQuestion', 'Skill'];
}

async function ensureSessionAgent(session, nextProviderConfig = null) {
    if (nextProviderConfig) {
        if (session.activeRun || session._piOperation) throw new Error('当前任务执行中，不能切换 Provider。');
        if (piGateway.manager.get(session.id)?.busy) throw new Error('当前任务执行中，不能切换 Provider。');
        session.providerConfig = resolveProviderConfig(nextProviderConfig);
    }
    return (await piGateway.ensure(session)).runtime;
}


async function persistSdkAgentHistory(session) {
    const runtime = piGateway.manager.get(session.id);
    if (runtime && !runtime.rpc.closed) {
        await synchronizeEngineInfo(session, runtime).catch(error => {
            console.warn('[agent-gateway] Pi session metadata sync failed:', error.message);
        });
    }
}


function getSharedSystemPrompt(session, descriptor) {
    const skill = descriptor.kind === 'skill' ? getLocalSkill(descriptor.skillId) : null;
    const command = descriptor.kind === 'command' ? getLocalCommand(descriptor.commandId, session) : null;
    const commandSkill = command?.skillId ? getLocalSkill(command.skillId) : null;
    const isGlobalContext = Boolean(session.context?.globalContext || skill?.globalContext || commandSkill?.globalContext);
    return [
        isGlobalContext
            ? `你当前工作在 Readify Shell 的内嵌 Agent Workbench 中，这是工作区级任务，不绑定任何已有页面版本；Portal 当前活动项目 ID 是 ${session.context.projectId}，涉及新增页面或项目内操作时必须以它为准。`
            : `你当前工作在 Readify Shell 的内嵌 Agent Workbench 中，当前页面范围是 ${formatPageScope(session.context)}；除非用户明确要求跨页面或工作区任务，请优先围绕这个页面版本开展。`,
        `项目工作区是 ${getWorkspaceRoot()}，程序安装目录是 ${ROOT_DIR}。内置模板与 Skill 从程序目录读取，项目资产写入工作区。`,
        `内置工具应使用安装目录绝对路径调用，例如 node ${ROOT_DIR}/tools/capture/prd-evidence.mjs；不要在工作区寻找 tools、scripts 或 node_modules。`,
        `模板源必须使用程序绝对路径 ${ROOT_DIR}/src/templates/；不要假设工作区存在 src/templates。内置 Skill 位于 ${PROJECT_SKILLS_DIR}。`,
        `所有 Demo 页面都必须遵守目录规约：src/pages/{project_id}/{page_id}/{version}/，且每个版本目录必须自包含 index.html、styles.css、app.js。`,
        ...formatPagePathLines(session.context),
        isGlobalContext ? '' : `当前页面只能使用 ${session.context.relativePageDir} 作为版本目录；不要使用缺少项目名的旧路径 src/pages/${session.context.pageId}/${session.context.version}/。`,
        '门户 Shell 文件在 portal/shell.js；项目根目录没有 shell.js，不要读取或修改根目录 shell.js。',
        '不要跨版本引用 CSS 或 JS。',
        '页面配置 data/projects.json 中每个 page 的 targetDevice 保存实际呈现方式：mobile 使用 src/templates/mobile-frame/ 并保留手机框，web 使用 src/templates/web-frame/，canvas 使用 src/templates/canvas-frame/；web 和 canvas 不强制手机外框。历史页面或缺失 targetDevice 的页面仍按 mobile 处理。',
        '无限画布是页面模式：targetDevice=canvas、pageMode=infinite-canvas，完整复制 src/templates/infinite-canvas/；内部画板放本版本 boards/，不注册为项目页面。编辑前读取 canvas-data.js，保持对象 ID，整页迭代。',
        '新增页面默认智能判断（auto 仅为创建模式，不得保存到 targetDevice）：用户明确文字要求优先，其次是本次手动选择；普通移动端页面优先 mobile，完整网页采用 web，独立组件、场景或配置预览等需要自由空间时可采用 canvas。先判断再加载对应 Skill，不凭单个关键词切换；没有框架绑定时 web 可自主设计。历史工作区说明若仍要求所有新页面默认 mobile，此项新建规则取代该旧默认；不改变历史页面。创建后保存实际 targetDevice 并同步工作区配置，迭代沿用已保存方式。运行时仍只引用页面自己目录内的 CSS/JS。',
        '模板风格包已经复制在 src/templates/design-systems/{style_id}/；用户选择风格时，优先读 DESIGN.md 和 USAGE.md，再按需使用 manifest.json、design-tokens.json、tokens.css、tailwind-v4.css、components.manifest.json、components.html。',
        isGlobalContext ? '新增页面任务必须创建全新的 page_id/v1，不要把当前打开的 reader 或其它已有页面当作目标页面，也不要直接修改已有页面版本目录。' : '',
        '如果用户明确要求“迭代版本”，需要复制当前版本目录到下一个版本，并同步更新当前工作区的 data/projects.json 与 portal/shell.js 中的 defaultData。外部工作区的 portal/shell.js 是元数据快照，不要修改程序安装目录中的同名源码文件。',
        '如果没有明确要求迭代版本，请优先在当前版本目录内工作。',
        isProductDocDescriptor(descriptor, command)
            ? '当前目标是生成中文产品文档，重点描述产品行为、规则、边界条件与影响面。'
            : isAiReadyPrdDescriptor(descriptor, command)
                ? '当前目标是生成 AI-Ready PRD：必须结合原型源码、标注、DOM 证据和截图，输出可直接交给开发 AI 使用的图文需求上下文。'
            : isSkillDescriptor(descriptor, 'generate-page-prototype')
                ? '当前目标是基于 skill 规范推进页面原型。优先分析当前版本和注解，再做克制且有方向的改动。'
                : command?.systemHint
                    || skill?.systemHint
                    || '请保持持续状态反馈：在思考、工具执行、等待用户补充时，都明确表达当前进展。'
    ].filter(Boolean).join('\n');
}


async function waitForApproval(session, toolName, input, rpcRequest = null) {
    const approvalId = randomUUID();
    const runId = session.runState.runId;
    const createdAt = new Date().toISOString();

    emitEvent(session, 'approval_request', {
        runId: session.runState.runId,
        approval: {
            id: approvalId,
            createdAt,
            toolName,
            input,
            inputPreview: safeJson(input, 1000),
            options: ['allow_once', 'allow_session', 'deny']
        }
    });
    setRunState(session, {
        status: 'waiting_approval',
        currentTool: toolName,
        stageMessage: `等待你批准 ${toolName} 操作`
    });

    const decision = await new Promise((resolve) => {
        session.pendingApproval = {
            id: approvalId,
            rpcId: rpcRequest?.id || null,
            runId,
            toolName,
            createdAt,
            inputPreview: safeJson(input, 1000),
            options: ['allow_once', 'allow_session', 'deny'],
            resolve
        };
    });

    if (session.pendingApproval?.id === approvalId) session.pendingApproval = null;

    emitEvent(session, 'approval_resolved', {
        runId: session.runState.runId,
        approval: {
            id: approvalId,
            toolName,
            decision
        }
    });

    if (decision !== 'deny' && session.activeRun?.id === runId && !session.activeRun.interrupted) {
        setRunState(session, {
            status: 'running',
            currentTool: toolName,
            stageMessage: `${toolName} 审批通过，继续执行中`
        });
    }

    return decision;
}

async function waitForQuestionResponse(session, question, options = [], rpcRequest = null) {
    const questionId = randomUUID();
    const runId = session.runState.runId;
    emitEvent(session, 'question_request', {
        runId: session.runState.runId,
        question: {
            id: questionId,
            question,
            options
        }
    });
    setRunState(session, {
        status: 'waiting_user_answer',
        currentTool: null,
        stageMessage: '正在等待你的补充回答'
    });

    const answer = await new Promise((resolve, reject) => {
        session.pendingQuestion = {
            id: questionId,
            rpcId: rpcRequest?.id || null,
            runId,
            question,
            options,
            resolve,
            reject
        };
    });

    if (session.pendingQuestion?.id === questionId) session.pendingQuestion = null;
    emitEvent(session, 'question_resolved', {
        runId: session.runState.runId,
        question: {
            id: questionId,
            answer
        }
    });
    if (session.activeRun?.id === runId && !session.activeRun.interrupted) setRunState(session, {
        status: 'running',
        currentTool: null,
        stageMessage: '已收到你的回答，继续执行中'
    });
    return answer;
}

async function prepareSkillPrompt(session, skillId) {
    const skill = getLocalSkill(skillId);
    if (!skill?.skillPath) return '';
    const text = await fs.readFile(skill.skillPath, 'utf8');
    return `${text}\n\n当前目标或补充要求：${session.context.pageId} ${session.context.version}`;
}

async function getPrdPrerequisiteResult(session) {
    const annotationsPath = path.join(session.context.pageDir, 'annotations.json');
    try {
        const raw = await fs.readFile(annotationsPath, 'utf8');
        const annotations = JSON.parse(raw);
        if (!Array.isArray(annotations) || annotations.length === 0) {
            return {
                ok: false,
                message: '当前页面版本没有注解数据。请先在原型门户中点击“编写文档”进入注解模式，补充产品逻辑描述后再生成 PRD。'
            };
        }
        return {
            ok: true,
            annotations
        };
    } catch (error) {
        return {
            ok: false,
            message: '当前页面版本没有注解数据。请先在原型门户中点击“编写文档”进入注解模式，补充产品逻辑描述后再生成 PRD。'
        };
    }
}

function extractAssistantText(message) {
    const content = Array.isArray(message?.message?.content) ? message.message.content : [];
    return content
        .filter((block) => block.type === 'text' && block.text)
        .map((block) => block.text)
        .join('\n')
        .trim();
}

function extractAssistantParts(message) {
    const content = Array.isArray(message?.message?.content) ? message.message.content : [];
    return {
        text: content
            .filter((block) => block.type === 'text' && block.text)
            .map((block) => block.text)
            .join('\n')
            .trim(),
        thinking: content
            .filter((block) => block.type === 'thinking' && block.thinking)
            .map((block) => block.thinking),
        toolUses: content
            .filter((block) => block.type === 'tool_use')
            .map((block) => ({
                id: block.id || randomUUID(),
                name: block.name || 'Tool',
                input: block.input ?? {}
            }))
    };
}

function upsertPartialAssistant(session, textDelta) {
    const nextText = `${session.runState.partialAssistantText || ''}${textDelta || ''}`;
    const eventId = session.runState.partialAssistantEventId || randomUUID();
    session.runState.partialAssistantText = nextText;
    session.runState.partialAssistantEventId = eventId;
    emitEvent(session, 'assistant_message', {
        runId: session.runState.runId,
        partial: true,
        text: nextText
    }, {
        id: eventId,
        replaceId: eventId,
        persist: false
    });
    emitEvent(session, 'assistant_delta', {
        runId: session.runState.runId,
        text: textDelta || ''
    }, { persist: false });
}

function finalizeAssistantMessage(session, text) {
    const normalized = String(text || '').trim();
    if (!normalized) return;
    const eventId = session.runState.partialAssistantEventId || randomUUID();
    session.runState.partialAssistantText = '';
    session.runState.partialAssistantEventId = null;
    emitEvent(session, 'assistant_message', {
        runId: session.runState.runId,
        partial: false,
        text: normalized
    }, {
        id: eventId,
        replaceId: eventId
    });
    setRunState(session, {
        status: 'running',
        currentTool: null,
        stageMessage: '模型已返回新的分析，继续处理中'
    });
}

function resetTransientWaiters(session) {
    if (session.pendingApproval?.resolve) {
        session.pendingApproval.resolve('deny');
    }
    if (session.pendingQuestion?.reject) {
        session.pendingQuestion.reject(new Error('任务已中断'));
    }
    session.pendingApproval = null;
    session.pendingQuestion = null;
}

async function inspectPrdArtifact(session) {
    const outputPath = path.join(session.context.pageDir, 'product-doc.md');
    try {
        const [docRaw, annotationsRaw] = await Promise.all([
            fs.readFile(outputPath, 'utf8'),
            fs.readFile(path.join(session.context.pageDir, 'annotations.json'), 'utf8')
        ]);
        const annotations = JSON.parse(annotationsRaw);
        const moduleCount = (docRaw.match(/^### 2\.\d+/gm) || []).length;
        return {
            ok: true,
            path: path.posix.join(session.context.relativePageDir, 'product-doc.md'),
            outputUrl: `http://localhost:8080/${path.posix.join(session.context.relativePageDir, 'product-doc.md')}`,
            annotationCount: Array.isArray(annotations) ? annotations.length : 0,
            moduleCount,
            summary: `处理了 ${Array.isArray(annotations) ? annotations.length : 0} 条注解，整理出 ${moduleCount} 个功能模块`
        };
    } catch (error) {
        return {
            ok: false
        };
    }
}

async function inspectAiReadyPrdArtifact(session) {
    const outputPath = path.join(session.context.pageDir, 'ai-ready-prd.md');
    try {
        const [docRaw, annotationsRaw] = await Promise.all([
            fs.readFile(outputPath, 'utf8'),
            fs.readFile(path.join(session.context.pageDir, 'annotations.json'), 'utf8').catch(() => '[]')
        ]);
        const annotations = JSON.parse(annotationsRaw);
        const moduleCount = (docRaw.match(/^### 4\.\d+/gm) || []).length
            || (docRaw.match(/^###\s+/gm) || []).length;
        const evidencePath = path.join(session.context.pageDir, 'prd-assets', 'annotation-evidence.json');
        let hasEvidence = false;
        try {
            await fs.access(evidencePath);
            hasEvidence = true;
        } catch {
            hasEvidence = false;
        }
        return {
            ok: true,
            path: path.posix.join(session.context.relativePageDir, 'ai-ready-prd.md'),
            outputUrl: `http://localhost:8080/${path.posix.join(session.context.relativePageDir, 'ai-ready-prd.md')}`,
            annotationCount: Array.isArray(annotations) ? annotations.length : 0,
            moduleCount,
            summary: `生成 AI-Ready PRD，处理 ${Array.isArray(annotations) ? annotations.length : 0} 条注解，${hasEvidence ? '已生成标注证据包' : '未检测到标注证据包'}`
        };
    } catch (error) {
        return {
            ok: false
        };
    }
}

async function inspectBusinessPrdArtifact(session) {
    const projectId = session.context.projectId || 'readify';
    const docsDir = path.join(getWorkspaceRoot(), 'src', 'pages', projectId, session.context.pageId, 'docs');
    const relativeDocsDir = path.posix.join('src', 'pages', projectId, session.context.pageId, 'docs');
    const outputPath = path.join(docsDir, 'ai-ready-prd.md');
    try {
        const [docRaw, annotationsRaw] = await Promise.all([
            fs.readFile(outputPath, 'utf8'),
            fs.readFile(path.join(session.context.pageDir, 'annotations.json'), 'utf8').catch(() => '[]')
        ]);
        const annotations = JSON.parse(annotationsRaw);
        const useCaseCount = (docRaw.match(/^###\s+需求用例\s*\d+/gm) || []).length
            || (docRaw.match(/^###\s+/gm) || []).length;
        const evidencePath = path.join(docsDir, 'prd-assets', 'annotation-evidence.json');
        let hasEvidence = false;
        try {
            await fs.access(evidencePath);
            hasEvidence = true;
        } catch {
            hasEvidence = false;
        }
        return {
            ok: true,
            path: path.posix.join(relativeDocsDir, 'ai-ready-prd.md'),
            outputUrl: `http://localhost:8080/${path.posix.join(relativeDocsDir, 'ai-ready-prd.md')}`,
            annotationCount: Array.isArray(annotations) ? annotations.length : 0,
            moduleCount: useCaseCount,
            summary: `生成业务 AI-Ready PRD，整理 ${useCaseCount} 个需求用例，${hasEvidence ? '已生成截图证据包' : '未检测到截图证据包'}`
        };
    } catch (error) {
        return {
            ok: false
        };
    }
}

async function runSessionTask(session, descriptor, { internalInstructions = '' } = {}) {
    if (session.activeRun || session._piOperation) {
        throw new Error('当前会话已有任务在执行，请先等待完成或手动中断。');
    }

    const skill = descriptor.kind === 'skill'
        ? getLocalSkill(descriptor.skillId)
        : descriptor.kind === 'command'
            ? getLocalSkill(getLocalCommand(descriptor.commandId)?.skillId)
            : null;
    const command = descriptor.kind === 'command' ? getLocalCommand(descriptor.commandId, session) : null;
    if (descriptor.kind === 'skill' && !skill) {
        throw createClassifiedError('指定的 Skill 不存在或暂不可用。', 'config_error');
    }
    if (descriptor.kind === 'command' && !command) {
        throw createClassifiedError('指定的命令不存在或暂不可用。', 'config_error');
    }

    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const previousTaskDescriptor = getSessionTaskDescriptor(session);
    session.activeRun = {
        id: runId,
        descriptor,
        previousTaskDescriptor,
        interrupted: false,
        checkpointId: runId,
        checkpointStatus: 'pending',
        abortController: new AbortController(),
        heartbeatTimer: setInterval(() => {
            emitEvent(session, 'heartbeat', {
                runId,
                runState: session.runState
            }, { persist: false });
        }, HEARTBEAT_INTERVAL_MS)
    };
    const activeRun = session.activeRun;
    try {
        await createRunCheckpoint(session, runId, descriptor);
        activeRun.checkpointStatus = 'available';
    } catch (error) {
        activeRun.checkpointStatus = 'unavailable';
        activeRun.checkpointError = summarizeText(error?.message || String(error), 500);
        console.warn('[agent-gateway] Failed to create run checkpoint:', error);
    }

    session.runState = {
        ...createDefaultRunState(),
        status: 'running',
        active: true,
        runId,
        descriptor,
        startedAt,
        lastActivityAt: startedAt,
        stageMessage: isProductDocDescriptor(descriptor, command)
            ? '正在检查 PRD 生成前置条件'
            : isAiReadyPrdDescriptor(descriptor, command)
                ? '正在收集 AI-Ready PRD 证据'
            : descriptor.kind === 'skill'
                ? `正在启动 ${skill?.label || 'Skill'}`
            : descriptor.kind === 'command'
                ? `正在执行 /${command?.id || 'command'}`
            : descriptor.kind === 'dev-simulate'
                ? `正在启动开发模拟：${descriptor.scenario || 'full_flow'}`
                : 'Agent 已接管任务，正在思考下一步',
        lastDescriptor: descriptor,
        lastTaskDescriptor: descriptor.kind === 'message'
            ? previousTaskDescriptor
            : descriptor
    };

    emitEvent(session, 'run_started', {
        runId,
        checkpointId: runId,
        checkpointStatus: activeRun.checkpointStatus,
        checkpointError: activeRun.checkpointError || null,
        descriptor,
        sessionScope: inferSessionScope(session),
        context: session.context,
        providerConfig: sanitizeProviderConfig(session.providerConfig)
    });

    session._skillPromptText = '';

    if (isProductDocDescriptor(descriptor, command)) {
        const prerequisite = await getPrdPrerequisiteResult(session);
        if (!prerequisite.ok) {
            emitEvent(session, 'run_failed', {
                runId,
                reason: prerequisite.message,
                classification: 'missing_annotations'
            });
            session.runState = {
                ...session.runState,
                status: 'failed',
                active: false,
                finishedAt: new Date().toISOString(),
                stageMessage: prerequisite.message,
                lastError: prerequisite.message
            };
            if (activeRun.heartbeatTimer) {
                clearInterval(activeRun.heartbeatTimer);
            }
            session._skillPromptText = '';
            await emitRunChanges(session, runId, activeRun);
            if (session.activeRun?.id === runId) {
                session.activeRun = null;
            }
            queueMicrotask(() => finalizeRunCheckpoint(session, runId).catch((error) => {
                console.warn('[agent-gateway] Failed to finalize checkpoint retention:', error);
            }));
            return;
        }
    }

    if (descriptor.kind === 'skill') {
        session._skillPromptText = await prepareSkillPrompt(session, descriptor.skillId);
    }

    if (descriptor.kind === 'command' && command?.skillId) {
        session._skillPromptText = await prepareSkillPrompt(session, command.skillId);
    }

    if (descriptor.kind === 'message') {
        const previousSkill = getDescriptorSkill(activeRun.previousTaskDescriptor || getSessionTaskDescriptor(session));
        if (previousSkill?.id) {
            session._skillPromptText = await prepareSkillPrompt(session, previousSkill.id);
        }
    }

    try {
        if (
            descriptor.kind !== 'dev-simulate'
            && !(descriptor.kind === 'command' && !command?.skillId)
            && !command?.localOnly
            && !session.providerConfig.apiKey
        ) {
            throw new Error('当前 Provider 还没有可用的 API Key。请先在配置面板填写 API Key，或使用"测试连接"确认配置。');
        }

        let finalResult = null;
        let artifact = null;

        if (descriptor.kind === 'dev-simulate') {
            artifact = await runDevSimulation(session, descriptor);
        } else if (descriptor.kind === 'command' && !command?.skillId) {
            finalResult = await runBuiltinCommand(session, descriptor, command);
        } else {
            const prompt = await buildActionPrompt(session, descriptor, internalInstructions);
            const queryOptions = composeQueryOptions(session, descriptor);
            queryOptions.requestTimeoutMs = getProviderRequestTimeoutMs(session.providerConfig);
            activeRun.maxTurns = queryOptions.maxTurns;
            finalResult = await piGateway.run(session, {
                prompt, options: queryOptions, runId,
                signal: activeRun.abortController.signal,
                emit: (type, payload, options) => {
                    if (!isRunInterrupted(session, activeRun)) emitEvent(session, type, payload, options);
                },
                setRunState: next => {
                    if (!isRunInterrupted(session, activeRun)) setRunState(session, next);
                },
                approval: (tool, input, record) => waitForApproval(session, tool, input, record),
                question: (question, options, record) => waitForQuestionResponse(session, question, options, record),
                onToolResult: () => isRunInterrupted(session, activeRun) ? undefined : emitLiveRunChanges(session, runId, activeRun)
            });
            emitEvent(session, 'sdk_result', {
                runId, subtype: 'success', isError: false, numTurns: finalResult.num_turns,
                totalCostUsd: finalResult.total_cost_usd, durationMs: finalResult.duration_ms,
                usage: finalResult.usage, stopReason: finalResult.stop_reason
            });

            if (isProductDocDescriptor(descriptor, command)) {
                artifact = await inspectPrdArtifact(session);
            } else if (isAiReadyPrdDescriptor(descriptor, command)) {
                artifact = await inspectAiReadyPrdArtifact(session);
            } else if (isBusinessPrdDescriptor(descriptor, command)) {
                artifact = await inspectBusinessPrdArtifact(session);
            }
        }


        if (isRunInterrupted(session, activeRun)) {
            await finishInterruptedRun(session, activeRun, runId);
            return;
        }

        if (artifact?.ok) {
            emitEvent(session, 'artifact_ready', {
                runId,
                artifact
            });
        }

        const finalSummary = summarizeText(
            finalResult?.result ||
            (isAnyPrdDescriptor(descriptor, command)
                ? 'PRD 任务已完成'
                : command?.successSummary || '任务已完成'),
            320
        );
        const finishedAt = new Date().toISOString();

        session.runState = {
            ...session.runState,
            status: 'succeeded',
            active: false,
            finishedAt,
            currentTool: null,
            stageMessage: '任务已完成',
            lastSummary: finalSummary,
            partialAssistantText: '',
            partialAssistantEventId: null
        };
        await persistSdkAgentHistory(session);
        await emitRunChanges(session, runId, activeRun);

        emitEvent(session, 'run_finished', {
            runId,
            status: 'succeeded',
            summary: finalSummary,
            result: finalResult?.result || '',
            numTurns: finalResult?.num_turns || null,
            totalCostUsd: finalResult?.total_cost_usd ?? finalResult?.cost ?? null,
            usage: finalResult?.usage || null,
            durationMs: finalResult?.duration_ms ?? null,
            durationApiMs: finalResult?.duration_api_ms ?? null,
            stopReason: finalResult?.stop_reason || null
        });
    } catch (error) {
            if (isRunInterrupted(session, activeRun)) {
            await finishInterruptedRun(session, activeRun, runId);
            return;
        }
        const finishedAt = new Date().toISOString();
        const failure = classifyRuntimeError(error, session.providerConfig);

        session.runState = {
            ...session.runState,
            status: 'failed',
            active: false,
            finishedAt,
            currentTool: null,
            stageMessage: failure.message,
            lastError: failure.message,
            partialAssistantText: '',
            partialAssistantEventId: null
        };
        await persistSdkAgentHistory(session);
        await emitRunChanges(session, runId, activeRun);

        emitEvent(session, 'run_failed', {
            runId,
            reason: failure.message,
            classification: failure.classification,
            httpStatus: failure.httpStatus || null
        });
    } finally {
        resetTransientWaiters(session);
        session._skillPromptText = '';
        if (activeRun.heartbeatTimer) {
            clearInterval(activeRun.heartbeatTimer);
            activeRun.heartbeatTimer = null;
        }
        if (session.activeRun?.id === runId) {
            session.activeRun = null;
        }
        session.interruptedRunIds?.delete(runId);
        queueMicrotask(() => finalizeRunCheckpoint(session, runId).catch((error) => {
            console.warn('[agent-gateway] Failed to finalize checkpoint retention:', error);
        }));
    }
}

function classifyRuntimeError(error, providerConfig) {
    if (error?.classification) {
        return {
            classification: error.classification,
            message: error.message || 'Agent 执行失败',
            httpStatus: Number(error.status || error.statusCode || 0) || null
        };
    }
    const message = summarizeText(error?.message || String(error || '未知错误'), 500);
    const status = Number(error?.status || error?.statusCode || 0) || null;
    const classification = classifyProviderError({
        status,
        message,
        providerConfig
    });
    return {
        classification,
        message: buildActionableFailureMessage(classification, message, providerConfig),
        httpStatus: status
    };
}

function isSdkResultFailure(result) {
    if (!result) return false;
    const subtype = String(result.subtype || '').toLowerCase();
    return Boolean(result.is_error)
        || subtype === 'error'
        || subtype.startsWith('error_');
}

function buildSdkResultFailureMessage(result, session) {
    const providerError = session._lastProviderError;
    const rawError = providerError?.message
        || (Array.isArray(result?.errors) && result.errors.length ? result.errors.join('\n') : '');
    if (rawError) {
        return buildActionableFailureMessage(
            classifyProviderError({
                status: Number(providerError?.status || providerError?.statusCode || 0) || null,
                message: rawError,
                providerConfig: session.providerConfig
            }),
            rawError,
            session.providerConfig
        );
    }

    if (String(result?.subtype || '').toLowerCase() === 'error_max_turns') {
        const maxTurns = session.activeRun?.maxTurns || getProviderMaxTurns(session.providerConfig);
        return [
            `Agent 已跑满本轮最大调用轮数：${result?.num_turns || maxTurns}/${maxTurns}。`,
            '这通常不是 Provider 连接失败，而是任务需要更多“模型调用 -> 工具执行 -> 模型调用”的循环才能完成。',
            `Provider：${session.providerConfig.label || session.providerConfig.provider}`,
            `Model：${session.providerConfig.model}`,
            '可以在 Prota Provider 的 Agent Options 里调高 maxTurns，例如 {"maxTurns": 60}；也可以把任务拆小，或先执行 /compact 后继续。'
        ].join('\n');
    }

    return [
        `Agent 在第 ${result?.num_turns || 1} 轮模型调用时返回 ${result?.subtype || 'error'}，但当前 Pi Runtime 没有暴露上游错误详情。`,
        `Provider：${session.providerConfig.label || session.providerConfig.provider}`,
        `Model：${session.providerConfig.model}`,
        `Base URL：${session.providerConfig.baseURL || '未配置'}`,
        '请先在 Prota 配置里点“测试连接”，或切换到该 Provider 可用模型后重试。'
    ].join('\n');
}

function createClassifiedError(message, classification = 'unknown_error', status = null) {
    const error = new Error(message);
    error.classification = classification;
    if (status != null) {
        error.status = status;
    }
    return error;
}

function markRunInterrupted(session, runId) {
    if (!runId) return;
    if (!session.interruptedRunIds) {
        session.interruptedRunIds = new Set();
    }
    session.interruptedRunIds.add(runId);
}

function isRunInterrupted(session, activeRunOrRunId) {
    const runId = typeof activeRunOrRunId === 'string'
        ? activeRunOrRunId
        : activeRunOrRunId?.id;
    return Boolean(
        activeRunOrRunId?.interrupted ||
        (runId && session.interruptedRunIds?.has(runId))
    );
}

async function finishInterruptedRun(session, activeRun, runId, options = {}) {
    if (activeRun) {
        activeRun.interrupted = true;
    }
    markRunInterrupted(session, runId);

    const finishedAt = new Date().toISOString();
    const stageMessage = options.stageMessage || '任务已中断';
    const summary = options.summary || '用户已中断当前任务';

    if (session.runState?.runId === runId) {
        session.runState = {
            ...session.runState,
            status: 'interrupted',
            active: false,
            finishedAt,
            currentTool: null,
            stageMessage,
            lastSummary: summary,
            partialAssistantText: '',
            partialAssistantEventId: null
        };
        await persistSdkAgentHistory(session);
        await emitRunChanges(session, runId, activeRun);
    }

    if (activeRun && !activeRun.finishEmitted) {
        activeRun.finishEmitted = true;
        emitEvent(session, 'run_finished', {
            runId,
            status: 'interrupted',
            summary
        });
    }
}

async function waitForInterruptAwareDelay(session, durationMs, runId = session.activeRun?.id) {
    const deadline = Date.now() + durationMs;
    while (Date.now() < deadline) {
        if (isRunInterrupted(session, runId)) {
            return false;
        }
        const step = Math.min(120, deadline - Date.now());
        if (step > 0) {
            await new Promise((resolve) => setTimeout(resolve, step));
        }
    }
    return !isRunInterrupted(session, runId);
}

async function runDevSimulation(session, descriptor) {
    const scenario = descriptor.scenario || 'full_flow';
    const runId = session.runState?.runId;

    const delay = async (ms = SIMULATION_STEP_DELAY_MS) => {
        const completed = await waitForInterruptAwareDelay(session, ms, runId);
        if (!completed) {
            return false;
        }
        session.runState.lastActivityAt = new Date().toISOString();
        return true;
    };

    if (scenario === 'failure') {
        upsertPartialAssistant(session, '正在模拟失败态，准备回放错误上下文…');
        if (!(await delay())) return null;
        finalizeAssistantMessage(session, '开发模拟已进入失败路径，用于验证错误卡片和顶部状态。');
        if (!(await delay())) return null;
        throw createClassifiedError('开发模拟：用于验证失败态展示与恢复操作。', 'simulated_failure');
    }

    upsertPartialAssistant(session, '正在模拟 Claude Code 风格的状态流…');
    if (!(await delay())) return null;
    finalizeAssistantMessage(session, '我会依次触发工具、审批、追问、产物和最终完成态，帮助你验证整条交互链路。');
    if (!(await delay())) return null;

    emitEvent(session, 'tool_started', {
        runId: session.runState.runId,
        toolName: 'Read',
        input: {
            file_path: path.posix.join(session.context.relativePageDir, 'annotations.json')
        },
        summary: '正在读取注解文件'
    });
    setRunState(session, {
        status: 'running',
        currentTool: 'Read',
        stageMessage: '模拟读取注解文件中'
    });
    if (!(await delay())) return null;
    emitEvent(session, 'tool_finished', {
        runId: session.runState.runId,
        toolName: 'Read',
        output: '开发模拟：成功读取注解元数据。',
        ok: true
    });
    setRunState(session, {
        status: 'running',
        currentTool: null,
        stageMessage: '模拟工具执行完成，继续处理中…'
    });
    if (!(await delay())) return null;

    if (scenario === 'interruptible') {
        upsertPartialAssistant(session, '进入可中断阶段，等待你点击“停止”…');
        setRunState(session, {
            status: 'running',
            currentTool: null,
            stageMessage: '开发模拟正在等待中断，用于验证 interrupt 与 retry'
        });
        await waitForInterruptAwareDelay(session, 30000, runId);
        return null;
    }

    const approvalDecision = await waitForApproval(session, 'Write', {
        file_path: path.posix.join(session.context.relativePageDir, 'product-doc.md'),
        content_preview: '开发模拟：将写入 PRD 文档'
    });
    if (approvalDecision === 'deny') {
        throw createClassifiedError('开发模拟：你拒绝了写入权限，本次模拟已停止。', 'simulated_failure');
    }
    if (!(await delay())) return null;

    const answer = await waitForQuestionResponse(
        session,
        '如果这是一次真实原型迭代，你希望优先补哪一部分？',
        ['视觉 polish', '交互细节', '状态反馈']
    );
    if (!(await delay())) return null;

    emitEvent(session, 'artifact_ready', {
        runId: session.runState.runId,
        artifact: {
            ok: true,
            path: path.posix.join(session.context.relativePageDir, 'product-doc.md'),
            outputUrl: `http://localhost:8080/${path.posix.join(session.context.relativePageDir, 'product-doc.md')}`,
            annotationCount: 3,
            moduleCount: 5,
            summary: `开发模拟已根据你的偏好“${answer}”生成一条示例产物事件。`
        }
    });
    if (!(await delay())) return null;

    return {
        ok: false
    };
}

function buildAgentSdkInfo() {
    return {
        ok: true, packageName: '@earendil-works/pi-coding-agent', version: piVersion.version,
        upstreamCommit: piVersion.commit, engine: 'pi', transport: 'rpc',
        options: Array.from(SDK_JSON_OPTION_KEYS).sort(), queryOptions: Array.from(SDK_QUERY_OPTION_KEYS).sort(),
        topLevelApis: ['prompt', 'abort', 'get_messages', 'compact', 'set_model', 'new_session', 'clone', 'get_tree', 'fork', 'get_entries', 'get_fork_messages', 'set_session_name', 'get_session_stats', 'set_auto_compaction', 'set_thinking_level', 'export_html', 'get_last_assistant_text', 'get_commands'],
        agentMethods: ['prompt', 'abort', 'get_messages', 'compact', 'set_model', 'new_session', 'clone'],
        baseTools: ['read', 'write', 'edit', 'find', 'grep', 'ls', process.platform === 'win32' ? 'powershell' : 'bash']
            .map(name => ({ name, description: `Pi native ${name}` })),
        extensionTools: [{ name: 'ask_user', description: 'Prota 主动提问' }],
        skills: listUserInvocableSkills().map(skill => ({ name: skill.id, description: skill.description })),
        extension: { loaded: true, path: 'runtime/pi/extensions/prota-extension.mjs', error: '' }
    };
}

async function listPiSessions() {
    const items = [];
    for (const id of sessions.keys()) {
        const session = await getHydratedSession(id);
        if (session) items.push({ id: session.id, engineInfo: session.engineInfo, cwd: getWorkspaceRoot(),
            model: session.providerConfig.model, createdAt: session.createdAt, updatedAt: session.updatedAt,
            summary: session.runState.lastSummary || '' });
    }
    return items;
}

async function runBuiltinCommand(session, descriptor, command) {
    const normalizedArgs = String(descriptor.arguments || '').trim();
    if (command.source === 'pi-extension') {
        const { commands } = await piGateway.sessionCommand(session, 'commands');
        if (!mergePiCommands(listUserInvocableCommands(), commands).some(item => item.id === command.id && item.source === 'pi-extension')) {
            throw new Error('该 Pi 扩展命令已不可用。');
        }
        return piGateway.run(session, {
            prompt: `/${command.id}${normalizedArgs ? ` ${normalizedArgs}` : ''}`,
            options: composeQueryOptions(session, descriptor), runId: session.runState.runId,
            signal: session.activeRun.abortController.signal,
            emit: (type, payload, options) => emitEvent(session, type, payload, options),
            setRunState: patch => setRunState(session, patch),
            approval: (...args) => waitForApproval(session, ...args),
            question: (...args) => waitForQuestionResponse(session, ...args)
        });
    }

    if (command.id === 'help') {
        const commands = [...listUserInvocableCommands(), ...(session._piCommands || [])];
        const commandSummary = commands
            .filter((item) => item.category !== 'Skills')
            .map((item) => `/${item.id}`)
            .join(', ');
        const skills = commands
            .filter((item) => item.category === 'Skills')
            .map((item) => `/${item.id} - ${item.description}`)
            .join('\n');
        return {
            result: [
                '可用命令：',
                commandSummary,
                '',
                'Skill 命令：',
                skills || '当前 .claude/skills 目录没有可用 Skill 命令。'
            ].join('\n')
        };
    }

    if (command.id === 'runtime') {
        const info = buildAgentSdkInfo();
        return {
            result: [
                `Pi ${piVersion.version} RPC 集成状态：`,
                'Provider 配置通过显式适配，未支持的参数会返回配置错误。',
                `Agent methods：${info.agentMethods.join(', ')}`,
                `Top-level APIs：${info.topLevelApis.join(', ')}`,
                `Base tools：${info.baseTools.length} 个`,
                `Extension：${info.extension.loaded ? '已加载' : '未加载'} (${info.extension.path})${info.extension.error ? `\nExtension error：${info.extension.error}` : ''}`
            ].join('\n')
        };
    }

    if (command.id === 'tools') {
        const info = buildAgentSdkInfo();
        const tools = [
            ...info.baseTools.map((toolDef) => `- ${toolDef.name}${toolDef.description ? `：${toolDef.description}` : ''}`),
            ...info.extensionTools.map((toolDef) => `- ${toolDef.name}${toolDef.description ? `：${toolDef.description}` : ''} (extension)`)
        ];
        return {
            result: ['Pi Tools：', ...tools].join('\n')
        };
    }

    if (command.id === 'messages') {
        const agent = await ensureSessionAgent(session);
        return {
            result: safeJson(await piGateway.messages(session), 8000) || '[]'
        };
    }

    if (command.id === 'api-type') {
        const agent = await ensureSessionAgent(session);
        return {
            result: `当前 Agent API Type：${session.providerConfig.apiType}`
        };
    }

    if (command.id === 'usage') return { result: safeJson(await piGateway.sessionCommand(session, 'usage'), 16000) };

    if (command.id === 'config') {
        const { sdkOptions, sdkExtension, ...provider } = sanitizeProviderConfig(session.providerConfig);
        return {
            result: safeJson({
                ...provider,
                agentOptions: sdkOptions,
                extension: sdkExtension
            }, 8000)
        };
    }

    if (command.id === 'mcp') {
        const match = normalizedArgs.match(/^(enable|disable)\s+([A-Za-z0-9_-]+)$/);
        if (normalizedArgs && !match) throw new Error('使用 /mcp、/mcp enable 服务名 或 /mcp disable 服务名。');
        if (match) {
            const config = session.providerConfig.sdkOptions?.mcpServers?.[match[2]];
            if (!config) throw new Error('该 MCP Server 尚未配置。');
            config.enabled = match[1] === 'enable';
            await persistSession(session);
        }
        const status = await piGateway.mcpStatus(session);
        return { result: status.length ? safeJson(status, 16000) : '当前没有配置 MCP Server。启用后工具仍受本轮白名单和权限审批控制。' };
    }

    if (command.id === 'status') {
        return {
            result: `当前会话：${session.title}\n页面：${session.context.pageId}/${session.context.version}\nProvider：${session.providerConfig.label}\nModel：${session.providerConfig.model}\n请求超时：${formatDurationMs(getAgentRequestTimeoutMs(session))}\n最大轮数：${getProviderMaxTurns(session.providerConfig)}\n状态：${session.runState.status}`
        };
    }

        if (command.id === 'compact') {
        const sdkCompact = await piGateway.compact(session, normalizedArgs);
        emitEvent(session, 'sdk_compact', {
            runId: session.runState.runId,
            summary: sdkCompact.summary,
            previousMessageCount: sdkCompact.previousMessageCount,
            nextMessageCount: sdkCompact.nextMessageCount,
            skipped: Boolean(sdkCompact.skipped),
            ok: Boolean(sdkCompact.ok)
        });
        return {
            result: [
                sdkCompact.summary,
                sdkCompact.compactSummary ? `\n压缩摘要：\n${summarizeText(sdkCompact.compactSummary, 1600)}` : '',
                '',
                '上下文已压缩，Prota 消息、工具记录与文件回滚入口完整保留。'
            ].filter(Boolean).join('\n')
        };
    }

    throw createClassifiedError(`命令 /${command.id} 暂不支持直接在 gateway 中执行。`, 'config_error');
}

function buildActionableFailureMessage(classification, rawMessage, providerConfig) {
    if (classification === 'timeout_error') {
        const providerLabel = providerConfig.label || providerConfig.provider || '当前 Provider';
        const model = providerConfig.model || '当前模型';
        const timeoutText = formatDurationMs(getProviderRequestTimeoutMs(providerConfig));
        const suggestion = providerConfig.provider?.startsWith('zhipu')
            ? '智谱 GLM 5.1 在长上下文/工具循环下容易超时；可以先切到 glm-5-turbo 或 glm-5-air，或执行 /compact 后继续。'
            : '可以稍后重试、执行 /compact 压缩上下文，或切换到响应更稳定的模型。';
        return `${providerLabel} / ${model} 请求超时：${rawMessage || 'Request timed out.'}\n当前 Prota 请求超时上限：${timeoutText}。如果实际未达到该时长，通常是上游网关或 Provider 提前返回了 timeout。${suggestion}`;
    }
    if (classification === 'quota_error') {
        return `Provider 额度已用尽或当前时段受限：${rawMessage}`;
    }
    if (classification === 'auth_error') {
        return `认证失败，请检查 API Key 是否有效：${rawMessage}`;
    }
    if (classification === 'invalid_model') {
        return `模型不可用，请切换到该 Provider 推荐模型后重试：${rawMessage}`;
    }
    if (classification === 'config_error' && providerConfig.provider === 'zhipu-anthropic') {
        return `配置不完整或 Base URL 不正确。智谱 Anthropic 兼容地址应为 https://open.bigmodel.cn/api/anthropic。${rawMessage ? ` ${rawMessage}` : ''}`;
    }
    return rawMessage || 'Agent 执行失败';
}

function classifyProviderError({ status, message, providerConfig }) {
    const normalized = String(message || '').toLowerCase();

    if (!providerConfig.apiKey) return 'config_error';
    if (!providerConfig.baseURL || !providerConfig.model) return 'config_error';

    if (status === 401 || status === 403) return 'auth_error';
    if (status === 404 && normalized.includes('model')) return 'invalid_model';
    if (
        status === 400 &&
        (
            normalized.includes('model') ||
            normalized.includes('unknown model') ||
            normalized.includes('invalid model') ||
            normalized.includes('模型')
        )
    ) {
        return 'invalid_model';
    }
    if (
        status === 429 &&
        (
            normalized.includes('quota') ||
            normalized.includes('上限') ||
            normalized.includes('insufficient') ||
            normalized.includes('balance') ||
            normalized.includes('额度')
        )
    ) {
        return 'quota_error';
    }
    if (status === 429) return 'rate_limit';
    if (
        normalized.includes('request timed out') ||
        normalized.includes('network') ||
        normalized.includes('fetch failed') ||
        normalized.includes('econnrefused') ||
        normalized.includes('enotfound') ||
        normalized.includes('timed out')
    ) {
        return normalized.includes('timed out') ? 'timeout_error' : 'network_error';
    }
    if (
        providerConfig.provider === 'zhipu-anthropic' &&
        !providerConfig.baseURL.includes('/api/anthropic')
    ) {
        return 'config_error';
    }
    return 'unknown_error';
}

async function testConnection(providerConfigInput) {
    const providerConfig = resolveProviderConfig(providerConfigInput);
    const startedAt = Date.now();

    if (!providerConfig.apiKey || !providerConfig.baseURL || !providerConfig.model) {
        return {
            ok: false,
            classification: 'config_error',
            provider: providerConfig.provider,
            model: providerConfig.model,
            baseURL: providerConfig.baseURL,
            hasApiKey: Boolean(providerConfig.apiKey),
            httpStatus: null,
            latencyMs: Date.now() - startedAt,
            message: 'Provider、Model、Base URL 或 API Key 缺失',
            rawMessage: '',
            expectedBaseURL: providerConfig.provider === 'zhipu-anthropic'
                ? 'https://open.bigmodel.cn/api/anthropic'
                : null
        };
    }

    const request = buildConnectionProbe(providerConfig);

    try {
        const response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(request.body)
        });
        const rawText = await response.text();
        const latencyMs = Date.now() - startedAt;
        const parsed = parseMaybeJson(rawText);
        const rawMessage = extractProviderMessage(parsed, rawText);

        if (!response.ok) {
            const classification = classifyProviderError({
                status: response.status,
                message: rawMessage,
                providerConfig
            });
            return {
                ok: false,
                classification,
                provider: providerConfig.provider,
                model: providerConfig.model,
                baseURL: providerConfig.baseURL,
                hasApiKey: Boolean(providerConfig.apiKey),
                httpStatus: response.status,
                latencyMs,
                message: buildActionableFailureMessage(classification, rawMessage, providerConfig),
                rawMessage,
                expectedBaseURL: providerConfig.provider === 'zhipu-anthropic'
                    ? 'https://open.bigmodel.cn/api/anthropic'
                    : null
            };
        }

        return {
            ok: true,
            classification: 'success',
            provider: providerConfig.provider,
            model: providerConfig.model,
            baseURL: providerConfig.baseURL,
            hasApiKey: Boolean(providerConfig.apiKey),
            httpStatus: response.status,
            latencyMs,
            message: '连接测试成功，Provider 已返回有效响应。',
            rawMessage
        };
    } catch (error) {
        const latencyMs = Date.now() - startedAt;
        return {
            ok: false,
            classification: 'network_error',
            provider: providerConfig.provider,
            model: providerConfig.model,
            baseURL: providerConfig.baseURL,
            hasApiKey: Boolean(providerConfig.apiKey),
            httpStatus: null,
            latencyMs,
            message: `网络请求失败：${summarizeText(error?.message || String(error), 400)}`,
            rawMessage: summarizeText(error?.message || String(error), 400)
        };
    }
}

async function fetchProviderModels(providerConfigInput) {
    const config = resolveProviderConfig(providerConfigInput);
    return discoverProviderModels(config, getProviderPreset(config.provider) || {});
}

async function queryBalance(providerConfigInput) {
    const providerConfig = resolveProviderConfig(providerConfigInput);
    const { apiKey, baseURL } = providerConfig;
    if (!apiKey) {
        return { ok: false, message: 'API Key 缺失' };
    }
    const urlLower = (baseURL || '').toLowerCase();

    // 1. DeepSeek
    if (urlLower.includes('api.deepseek.com')) {
        try {
            const resp = await fetch('https://api.deepseek.com/user/balance', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });
            if (!resp.ok) {
                return { ok: false, message: `DeepSeek 余额查询接口返回 HTTP ${resp.status}` };
            }
            const data = await resp.json();
            const isAvailable = data.is_available !== false;
            const balanceInfos = data.balance_infos || [];
            if (balanceInfos.length > 0) {
                const info = balanceInfos[0];
                const currency = info.currency || 'CNY';
                const total = parseFloat(info.total_balance || 0);
                return {
                    ok: true,
                    balance: total,
                    unit: currency,
                    message: `账户余额: ${total.toFixed(4)} ${currency} (${isAvailable ? '可用' : '不可用'})`
                };
            }
            return { ok: false, message: '未获取到 DeepSeek 余额信息' };
        } catch (e) {
            return { ok: false, message: `DeepSeek 余额查询出错: ${e.message}` };
        }
    }

    // 2. StepFun
    if (urlLower.includes('api.stepfun.ai') || urlLower.includes('api.stepfun.com')) {
        try {
            const resp = await fetch('https://api.stepfun.com/v1/accounts', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });
            if (!resp.ok) {
                return { ok: false, message: `StepFun 余额查询接口返回 HTTP ${resp.status}` };
            }
            const data = await resp.json();
            const balance = parseFloat(data.balance || 0);
            return {
                ok: true,
                balance: balance,
                unit: 'CNY',
                message: `账户余额: ${balance.toFixed(4)} CNY`
            };
        } catch (e) {
            return { ok: false, message: `StepFun 余额查询出错: ${e.message}` };
        }
    }

    // 3. SiliconFlow
    if (urlLower.includes('api.siliconflow.cn') || urlLower.includes('api.siliconflow.com')) {
        const isCn = urlLower.includes('api.siliconflow.cn');
        const domain = isCn ? 'api.siliconflow.cn' : 'api.siliconflow.com';
        try {
            const resp = await fetch(`https://${domain}/v1/user/info`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });
            if (!resp.ok) {
                return { ok: false, message: `SiliconFlow 余额查询接口返回 HTTP ${resp.status}` };
            }
            const data = await resp.json();
            const totalBalance = parseFloat(data.data?.totalBalance || 0);
            const unit = isCn ? 'CNY' : 'USD';
            return {
                ok: true,
                balance: totalBalance,
                unit,
                message: `账户余额: ${totalBalance.toFixed(4)} ${unit}`
            };
        } catch (e) {
            return { ok: false, message: `SiliconFlow 余额查询出错: ${e.message}` };
        }
    }

    // 4. OpenRouter
    if (urlLower.includes('openrouter.ai')) {
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/credits', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });
            if (!resp.ok) {
                return { ok: false, message: `OpenRouter 额度查询接口返回 HTTP ${resp.status}` };
            }
            const data = await resp.json();
            const credits = data.data || {};
            const totalCredits = parseFloat(credits.total_credits || 0);
            const totalUsage = parseFloat(credits.total_usage || 0);
            const remaining = totalCredits - totalUsage;
            return {
                ok: true,
                balance: remaining,
                unit: 'USD',
                message: `剩余额度: ${remaining.toFixed(4)} USD / 总额度: ${totalCredits.toFixed(4)} USD`
            };
        } catch (e) {
            return { ok: false, message: `OpenRouter 额度查询出错: ${e.message}` };
        }
    }

    // 5. Novita AI
    if (urlLower.includes('api.novita.ai')) {
        try {
            const resp = await fetch('https://api.novita.ai/v3/user/balance', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });
            if (!resp.ok) {
                return { ok: false, message: `Novita AI 余额查询接口返回 HTTP ${resp.status}` };
            }
            const data = await resp.json();
            const available = parseFloat(data.availableBalance || 0) / 10000.0;
            return {
                ok: true,
                balance: available,
                unit: 'USD',
                message: `账户余额: ${available.toFixed(4)} USD`
            };
        } catch (e) {
            return { ok: false, message: `Novita AI 余额查询出错: ${e.message}` };
        }
    }

    // 6. Kimi For Coding
    if (urlLower.includes('api.kimi.com/coding') || urlLower.includes('api.kimi.com')) {
        try {
            const resp = await fetch('https://api.kimi.com/coding/v1/usages', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });
            if (!resp.ok) {
                return { ok: false, message: `Kimi 用量查询接口返回 HTTP ${resp.status}` };
            }
            const data = await resp.json();
            let msg = '';
            
            // 5小时限额
            let fiveHourPct = null;
            if (Array.isArray(data.limits)) {
                for (const limitItem of data.limits) {
                    if (limitItem.detail) {
                        const limit = parseFloat(limitItem.detail.limit || 1);
                        const remaining = parseFloat(limitItem.detail.remaining || 0);
                        fiveHourPct = Math.max(0, ((limit - remaining) / limit) * 100);
                        break;
                    }
                }
            }
            
            // 周限额
            let weeklyPct = null;
            if (data.usage) {
                const limit = parseFloat(data.usage.limit || 1);
                const remaining = parseFloat(data.usage.remaining || 0);
                weeklyPct = Math.max(0, ((limit - remaining) / limit) * 100);
            }
            
            if (fiveHourPct !== null && weeklyPct !== null) {
                msg = `用量已用：5小时桶 ${fiveHourPct.toFixed(1)}% | 每周额度 ${weeklyPct.toFixed(1)}%`;
            } else if (fiveHourPct !== null) {
                msg = `用量已用：5小时桶 ${fiveHourPct.toFixed(1)}%`;
            } else if (weeklyPct !== null) {
                msg = `用量已用：每周额度 ${weeklyPct.toFixed(1)}%`;
            } else {
                msg = '未获取到具体的 Kimi 用量限额详情';
            }
            
            return {
                ok: true,
                message: msg
            };
        } catch (e) {
            return { ok: false, message: `Kimi 用量查询出错: ${e.message}` };
        }
    }

    // 7. Zhipu GLM Coding Plan
    if (urlLower.includes('open.bigmodel.cn') || urlLower.includes('bigmodel.cn') || urlLower.includes('api.z.ai')) {
        try {
            // 使用 api.z.ai 接口
            const resp = await fetch('https://api.z.ai/api/monitor/usage/quota/limit', {
                headers: {
                    'Authorization': apiKey, // 注意：智谱不加 Bearer 前缀
                    'Content-Type': 'application/json',
                    'Accept-Language': 'en-US,en'
                }
            });
            if (!resp.ok) {
                return { ok: false, message: `智谱用量查询接口返回 HTTP ${resp.status}` };
            }
            const data = await resp.json();
            if (data.success === false) {
                return { ok: false, message: `智谱用量查询失败: ${data.msg || '未知错误'}` };
            }
            
            const limits = data.data?.limits || [];
            const tokenLimits = limits
                .filter(item => (item.type || '').toUpperCase() === 'TOKENS_LIMIT')
                .map(item => ({
                    percentage: parseFloat(item.percentage || 0),
                    resetTime: parseInt(item.nextResetTime || 9999999999999)
                }))
                .sort((a, b) => a.resetTime - b.resetTime);
                
            let msg = '';
            if (tokenLimits.length >= 2) {
                msg = `用量已用：5小时桶 ${tokenLimits[0].percentage.toFixed(1)}% | 每周额度 ${tokenLimits[1].percentage.toFixed(1)}%`;
            } else if (tokenLimits.length === 1) {
                msg = `用量已用：5小时桶 ${tokenLimits[0].percentage.toFixed(1)}%`;
            } else {
                msg = '未获取到具体的智谱 Coding Plan Token 用量详情';
            }
            
            if (data.data?.level) {
                msg += ` (${data.data.level})`;
            }
            
            return {
                ok: true,
                message: msg
            };
        } catch (e) {
            return { ok: false, message: `智谱用量查询出错: ${e.message}` };
        }
    }

    // 8. MiniMax Coding Plan
    if (urlLower.includes('api.minimaxi.com') || urlLower.includes('api.minimax.io')) {
        const isCn = urlLower.includes('api.minimaxi.com');
        const domain = isCn ? 'api.minimaxi.com' : 'api.minimax.io';
        try {
            const resp = await fetch(`https://${domain}/v1/api/openplatform/coding_plan/remains`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!resp.ok) {
                return { ok: false, message: `MiniMax 用量查询接口返回 HTTP ${resp.status}` };
            }
            const data = await resp.json();
            if (data.base_resp && data.base_resp.status_code !== 0) {
                return { ok: false, message: `MiniMax 接口错误 (code ${data.base_resp.status_code}): ${data.base_resp.status_msg}` };
            }
            
            const modelRemains = data.model_remains || [];
            if (modelRemains.length > 0) {
                const item = modelRemains[0];
                const intervalTotal = parseFloat(item.current_interval_total_count || 0);
                const intervalRemaining = parseFloat(item.current_interval_usage_count || 0);
                const weeklyTotal = parseFloat(item.current_weekly_total_count || 0);
                const weeklyRemaining = parseFloat(item.current_weekly_usage_count || 0);
                
                let msg = '';
                const fiveHourUsed = intervalTotal > 0 ? ((intervalTotal - intervalRemaining) / intervalTotal) * 100 : 0;
                const weeklyUsed = weeklyTotal > 0 ? ((weeklyTotal - weeklyRemaining) / weeklyTotal) * 100 : 0;
                
                msg = `用量已用：5小时桶 ${fiveHourUsed.toFixed(1)}% | 每周额度 ${weeklyUsed.toFixed(1)}%`;
                return {
                    ok: true,
                    message: msg
                };
            }
            return { ok: false, message: '未获取到 MiniMax 用量信息' };
        } catch (e) {
            return { ok: false, message: `MiniMax 用量查询出错: ${e.message}` };
        }
    }

    return { ok: false, message: '该服务商不支持在线余额/用量查询' };
}

function parseMaybeJson(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function extractProviderMessage(parsed, fallbackText = '') {
    if (!parsed || typeof parsed !== 'object') {
        return summarizeText(fallbackText, 500);
    }
    return summarizeText(
        parsed?.error?.message ||
        parsed?.error?.msg ||
        parsed?.message ||
        parsed?.msg ||
        fallbackText,
        500
    );
}

async function registerBuiltInSkills() {
    [
        {
            id: 'new',
            label: '新建会话',
            aliases: ['new', '/new'],
            description: '创建新的历史会话并切换过去。',
            category: 'Workbench',
            kind: 'local',
            icon: 'NEW',
            usage: '/new',
            examples: ['/new'],
            argumentMode: 'none',
            supportsSession: false,
            dangerous: false,
            localOnly: true
        },
        {
            id: 'history',
            label: '历史对话',
            aliases: ['history', '/history', 'resume', '/resume', 'sessions', '/sessions'],
            description: '打开并聚焦历史对话搜索。',
            category: 'Workbench',
            kind: 'local',
            icon: 'HIS',
            usage: '/history',
            examples: ['/history'],
            argumentMode: 'none',
            supportsSession: false,
            dangerous: false,
            localOnly: true
        },
        {
            id: 'clear',
            label: '清空上下文',
            aliases: ['clear', '/clear'],
            description: '建立新的 Pi 会话上下文，保留原始历史文件。',
            category: 'Workbench',
            kind: 'local',
            icon: 'CLR',
            usage: '/clear',
            examples: ['/clear'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: false,
            localOnly: true
        },
        {
            id: 'delete-session',
            label: '删除会话',
            aliases: ['delete-session', '/delete-session'],
            description: '删除当前 Prota 会话记录。',
            category: 'Workbench',
            kind: 'local',
            icon: 'DEL',
            usage: '/delete-session',
            examples: ['/delete-session'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: true,
            localOnly: true
        },
        {
            id: 'retry',
            label: '重试上一次',
            aliases: ['retry', '/retry'],
            description: '复跑最近一次消息、命令或 skill。',
            category: 'Workbench',
            kind: 'local',
            icon: 'RET',
            usage: '/retry',
            examples: ['/retry'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: false,
            localOnly: true
        },
        {
            id: 'interrupt',
            label: '中断任务',
            aliases: ['interrupt', '/interrupt'],
            description: '停止当前运行中的任务。',
            category: 'Workbench',
            kind: 'local',
            icon: 'STP',
            usage: '/interrupt',
            examples: ['/interrupt'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: true,
            localOnly: true
        },
        {
            id: 'model',
            label: '切换模型',
            aliases: ['model', '/model'],
            description: '切换当前会话后续运行所使用的模型。',
            category: 'Config',
            kind: 'local',
            icon: 'MOD',
            usage: '/model glm-5.1',
            examples: ['/model', '/model glm-5.1'],
            argumentMode: 'optional-text',
            supportsSession: true,
            dangerous: false,
            localOnly: true
        },
        {
            id: 'provider',
            label: '切换 Provider',
            aliases: ['provider', '/provider'],
            description: '切换当前会话后续运行所使用的 provider。',
            category: 'Config',
            kind: 'local',
            icon: 'PRO',
            usage: '/provider zhipu-anthropic',
            examples: ['/provider', '/provider zhipu-anthropic'],
            argumentMode: 'optional-text',
            supportsSession: true,
            dangerous: false,
            localOnly: true
        },
        {
            id: 'permission',
            label: '权限模式',
            aliases: ['permission', '/permission', 'perm', '/perm'],
            description: '切换工具权限与审批模式。',
            category: 'Agent',
            kind: 'local',
            icon: 'PER',
            usage: '/permission default',
            examples: ['/permission', '/permission bypassPermissions', '/permission plan'],
            argumentMode: 'optional-text',
            supportsSession: true,
            dangerous: false,
            localOnly: true
        },
        {
            id: 'runtime',
            label: 'Pi 运行时',
            aliases: [],
            description: '查看 Pi 运行时配置、工具与会话能力。',
            category: 'Agent',
            kind: 'command',
            icon: 'PI',
            usage: '/runtime',
            examples: ['/runtime'],
            argumentMode: 'none',
            supportsSession: false,
            dangerous: false
        },
        {
            id: 'tools',
            label: 'Agent 工具',
            aliases: ['tools', '/tools'],
            description: '列出 Pi 内置 tools 与 Prota extension tools。',
            category: 'Agent',
            kind: 'command',
            icon: 'TLS',
            usage: '/tools',
            examples: ['/tools'],
            argumentMode: 'none',
            supportsSession: false,
            dangerous: false
        },
        {
            id: 'messages',
            label: 'Pi 模型消息',
            aliases: ['messages', '/messages'],
            description: '读取 Pi 当前会话的模型消息。',
            category: 'Agent',
            kind: 'command',
            icon: 'MSG',
            usage: '/messages',
            examples: ['/messages'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: false
        },
        {
            id: 'api-type',
            label: 'API Type',
            aliases: ['api-type', '/api-type'],
            description: '读取 session.providerConfig.apiType。',
            category: 'Agent',
            kind: 'command',
            icon: 'API',
            usage: '/api-type',
            examples: ['/api-type'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: false
        },
        {
            id: 'usage',
            label: 'Token / Cost',
            aliases: ['cost', '/cost'],
            description: '查看当前 Pi 会话的 Token、费用和上下文统计。',
            category: 'Agent',
            kind: 'command',
            icon: 'CST',
            usage: '/usage',
            examples: ['/cost'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: false
        },
        {
            id: 'config',
            label: '配置摘要',
            aliases: ['config', '/config'],
            description: '查看当前 Provider 与 Agent options 摘要。',
            category: 'Agent',
            kind: 'command',
            icon: 'CFG',
            usage: '/config',
            examples: ['/config'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: false
        },
        {
            id: 'mcp',
            label: 'MCP',
            aliases: ['mcp', '/mcp'],
            description: '查看连接、启用和允许使用状态；enable/disable 服务名。',
            category: 'Agent',
            kind: 'command',
            icon: 'MCP',
            usage: '/mcp [enable|disable 服务名]',
            examples: ['/mcp'],
            argumentMode: 'optional-text',
            supportsSession: true,
            dangerous: false
        },
        {
            id: 'status',
            label: '当前状态',
            aliases: ['status', '/status'],
            description: '输出当前会话、页面、模型与状态摘要。',
            category: 'Workbench',
            kind: 'command',
            icon: 'STA',
            usage: '/status',
            examples: ['/status'],
            argumentMode: 'none',
            supportsSession: true,
            dangerous: false
        },
        {
            id: 'help',
            label: '命令帮助',
            aliases: ['help', '/help'],
            description: '展示可用命令和 skill 说明。',
            category: 'Workbench',
            kind: 'command',
            icon: 'HELP',
            usage: '/help',
            examples: ['/help'],
            argumentMode: 'none',
            supportsSession: false,
            dangerous: false
        },
        {
            id: 'compact',
            label: '压缩上下文',
            aliases: ['compact', '/compact'],
            description: '压缩模型上下文，保留完整操作历史；可指定保留重点。',
            category: 'Workbench',
            kind: 'command',
            icon: 'CMP',
            usage: '/compact [保留重点]',
            examples: ['/compact', '/compact 保留画板需求和当前进度'],
            argumentMode: 'optional-text',
            supportsSession: true,
            dangerous: false
        }
    ].forEach(registerLocalCommand);
    const piCommands = [
        ['tree', '会话历史树', '查看历史节点与分支，从用户消息继续探索。', 'none'],
        ['fork', '从历史消息分叉', '选择历史用户消息，创建独立会话；保留当前文件。', 'optional-text'],
        ['clone', '复制当前会话', '复制当前完整模型上下文到独立会话。', 'none'],
        ['rewind', '回溯对话', '选择历史用户消息创建分支，文件保持当前状态。', 'optional-text'],
        ['rollback', '文件回滚', '查看运行的文件变更，确认后恢复检查点。', 'optional-text'],
        ['thinking', '推理等级', '选择模型支持的推理强度。', 'optional-text'],
        ['name', '命名会话', '重命名当前会话。', 'required-text'],
        ['auto-compact', '自动压缩', '开启或关闭自动上下文压缩。', 'optional-text'],
        ['export', '导出会话', '下载当前会话 HTML 到本地。', 'none'],
        ['copy', '复制最近回复', '复制最近一条助手回复。', 'none']
    ];
    for (const [id, label, description, argumentMode] of piCommands) registerLocalCommand({
        id, label, description, argumentMode, kind: 'command', source: 'pi-rpc', action: 'client',
        category: 'Session', icon: 'PI', usage: `/${id}`, aliases: [], localOnly: true,
        supportsSession: true, requiresConfirmation: id === 'rollback'
    });
}

async function loadProviderPresets() {
    const raw = await fs.readFile(PROVIDER_PRESETS_PATH, 'utf8');
    return JSON.parse(raw);
}

async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
    }
    if (!chunks.length) return {};
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        ...SESSION_STREAM_HEADERS,
        'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
    res.writeHead(statusCode, {
        ...SESSION_STREAM_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end(message);
}

async function handleCreateSession(req, res) {
    const body = await readJsonBody(req);
    const session = createSession({
        context: body,
        providerConfig: body.providerConfig || {},
        sessionScope: body.sessionScope === 'global' ? 'global' : 'page'
    });
    if (body.title) {
        session.title = normalizeSessionTitle(body.title);
        await persistSession(session);
    }
    sendJson(res, 200, {
        sessionId: session.id,
        title: session.title,
        sessionScope: inferSessionScope(session),
        context: session.context,
        providerConfig: sanitizeProviderConfig(session.providerConfig),
        runState: session.runState
    });


}

async function handleDownloadZip(req, res) {
    let tempZipPath = null;
    try {
        const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        const projectId = url.searchParams.get('projectId') || 'readify';
        const pageId = url.searchParams.get('pageId');
        const version = url.searchParams.get('version');

        if (!pageId || !version) {
            sendJson(res, 400, { ok: false, error: 'Missing pageId or version' });
            return;
        }

        const safeProjectId = String(projectId).replace(/[^a-zA-Z0-9_\-]/g, '');
        const safePageId = String(pageId).replace(/[^a-zA-Z0-9_\-]/g, '');
        const safeVersion = String(version).replace(/[^a-zA-Z0-9_\-]/g, '');

        if (!safeProjectId || !safePageId || !safeVersion) {
            sendJson(res, 400, { ok: false, error: 'Invalid parameters format' });
            return;
        }

        const pageDir = path.join(getWorkspaceRoot(), 'src', 'pages', safeProjectId, safePageId);
        const versionDir = path.join(pageDir, safeVersion);
        const docsDir = path.join(pageDir, 'docs');

        // Check if version directory exists
        try {
            await fs.access(versionDir);
        } catch {
            sendJson(res, 404, { ok: false, error: `Version directory not found: src/pages/${safeProjectId}/${safePageId}/${safeVersion}` });
            return;
        }

        // Determine if docs directory exists
        let hasDocs = false;
        try {
            await fs.access(docsDir);
            hasDocs = true;
        } catch {
            hasDocs = false;
        }

        // Create temporary dir in data/temp
        const tempDir = path.join(getWorkspaceRoot(), 'data', 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        const zipName = `${safePageId}_${safeVersion}_prd_${Date.now()}.zip`;
        tempZipPath = path.join(tempDir, zipName);

        const targetItems = [safeVersion];
        if (hasDocs) {
            targetItems.push('docs');
        }

        // Execute zip command in the context of pageDir
        const cmd = `zip -r "${tempZipPath}" ${targetItems.map(item => `"${item}"`).join(' ')}`;
        await execPromise(cmd, { cwd: pageDir });

        const fileBuffer = await fs.readFile(tempZipPath);

        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${safePageId}_${safeVersion}_prd.zip"`,
            'Content-Length': fileBuffer.length
        });
        res.end(fileBuffer);
    } catch (err) {
        console.error('[agent-gateway] Download zip failed:', err);
        sendJson(res, 500, { ok: false, error: `Internal server error: ${err.message}` });
    } finally {
        if (tempZipPath) {
            try {
                await fs.rm(tempZipPath, { force: true });
            } catch (cleanupErr) {
                console.error('[agent-gateway] Cleanup temp zip failed:', cleanupErr);
            }
        }
    }
}

function encodeSessionCursor(item) {
    return Buffer.from(JSON.stringify({
        updatedAt: item.updatedAt || item.createdAt || '',
        id: item.id
    })).toString('base64url');
}

function decodeSessionCursor(value) {
    if (!value) return null;
    try {
        const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        return parsed?.id ? parsed : null;
    } catch {
        return null;
    }
}

function compareSessionListItems(left, right) {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    if (leftTime !== rightTime) return rightTime - leftTime;
    return String(right.id || '').localeCompare(String(left.id || ''));
}

function isVisibleSessionListItem(item) {
    if (item.archived) return false;
    if (item.hasHistory !== false) return true;
    const title = String(item.title || '').trim();
    const summary = String(item.lastSummary || '').trim();
    const genericTitle = !title || title === '新会话' || title === '新增页面';
    const placeholderSummary = !summary
        || summary === '尚未建立会话'
        || summary === '已连接，等待新的任务。'
        || summary === '已连接，等待新的任务';
    return !(genericTitle && placeholderSummary);
}

async function handleListSessions(res, url) {
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '', 10);
    const limit = Math.min(
        MAX_SESSION_PAGE_SIZE,
        Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_SESSION_PAGE_SIZE)
    );
    const query = String(url.searchParams.get('query') || '').trim().toLowerCase();
    const cursor = decodeSessionCursor(url.searchParams.get('cursor'));
    let items = Array.from(sessions.values())
        .map((session) => createSessionListItem(session))
        .filter(isVisibleSessionListItem)
        .filter((item) => {
            if (!query) return true;
            return [item.title, item.pageId, item.version, item.lastSummary, item.contextLabel]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        })
        .sort(compareSessionListItems);

    if (cursor) {
        const cursorIndex = items.findIndex((item) => item.id === cursor.id);
        if (cursorIndex >= 0) {
            items = items.slice(cursorIndex + 1);
        } else {
            items = items.filter((item) => compareSessionListItems(item, cursor) > 0);
        }
    }

    const page = items.slice(0, limit);
    const hasMore = items.length > limit;
    sendJson(res, 200, {
        ok: true,
        sessions: page,
        nextCursor: hasMore && page.length ? encodeSessionCursor(page.at(-1)) : null,
        hasMore
    });
}

async function handleHistory(res, session) {
    const timeline = await Promise.all((session.timeline || []).map(async (event) => {
        if (event.type !== 'run_changes' || event.payload?.rollbackStatus !== 'available' || !event.payload?.runId) {
            return event;
        }
        try {
            await fs.access(getCheckpointFilePath(session.id, event.payload.runId));
            return event;
        } catch {
            return {
                ...event,
                payload: { ...event.payload, rollbackStatus: 'expired' }
            };
        }
    }));
    sendJson(res, 200, redactSecrets({
        sessionId: session.id,
        title: session.engineInfo?.sessionName || normalizeSessionTitle(session.title),
        sessionScope: inferSessionScope(session),
        context: session.context,
        providerConfig: sanitizeProviderConfig(session.providerConfig),
        timeline,
        engineInfo: session.engineInfo,
        runState: session.runState,
        ...previewRunMetadata(session),
        pendingApproval: session.pendingApproval
            ? {
                id: session.pendingApproval.id,
                toolName: session.pendingApproval.toolName,
                createdAt: session.pendingApproval.createdAt,
                inputPreview: session.pendingApproval.inputPreview,
                options: session.pendingApproval.options
            }
            : null,
        pendingQuestion: session.pendingQuestion
            ? {
                id: session.pendingQuestion.id,
                question: session.pendingQuestion.question,
                options: session.pendingQuestion.options
            }
            : null
    }, sessionSecrets(session)));


}

async function handleSdkMessages(res, session) {
    const agent = await ensureSessionAgent(session);
    sendJson(res, 200, {
        ok: true,
        sessionId: session.id,
        messages: await piGateway.messages(session)
    });
}

async function handleSdkClear(res, session) {
    if (session.activeRun || session._piOperation) { sendJson(res, 409, { ok: false, message: 'Session is busy' }); return; }
    await piGateway.clear(session);
    session.timeline = [];
    session.runState = {
        ...createDefaultRunState(),
        status: 'ready',
        stageMessage: 'Agent 上下文已清空，等待新的任务'
    };
    emitEvent(session, 'sdk_status', {
        runId: null,
        message: 'Agent conversation history cleared'
    });
    await persistSession(session);
    sendJson(res, 200, {
        ok: true,
        sessionId: session.id
    });
}

async function handleSdkSetModel(req, res, session) {
    const body = await readJsonBody(req);
    const model = String(body.model || '').trim();
    if (!model) {
        sendJson(res, 400, { ok: false, message: 'model is required' });
        return;
    }
    if (session.activeRun || session._piOperation) { sendJson(res, 409, { ok: false, message: 'Session is busy' }); return; }
    session.providerConfig.model = model;
    await ensureSessionAgent(session);
    await persistSession(session);
    emitEvent(session, 'session_ready', {
        sessionId: session.id,
        sessionScope: inferSessionScope(session),
        context: session.context,
        providerConfig: sanitizeProviderConfig(session.providerConfig),
        runState: session.runState
    });
    sendJson(res, 200, {
        ok: true,
        model
    });
}

async function handleSdkSetContext(req, res, session) {
    const body = await readJsonBody(req);
    const sessionScope = body.sessionScope || (body.globalContext ? 'global' : 'page');
    session.context = normalizeContext({
        ...body,
        globalContext: sessionScope === 'global'
    });
    session.sessionScope = sessionScope;
    await piGateway.dispose(session.id);
    await persistSession(session);
    emitEvent(session, 'session_ready', {
        sessionId: session.id,
        sessionScope: inferSessionScope(session),
        context: session.context,
        providerConfig: sanitizeProviderConfig(session.providerConfig),
        runState: session.runState
    });
    sendJson(res, 200, {
        ok: true,
        context: session.context,
        sessionScope: session.sessionScope
    });
}


async function handleSdkSetProvider(req, res, session) {
    const body = await readJsonBody(req);
    const incoming = isPlainObject(body.providerConfig) ? body.providerConfig : body;
    const providerConfig = resolveProviderConfig({
        ...incoming,
        provider: incoming.provider || body.provider || body.providerId || body.id
    });
    await ensureSessionAgent(session, providerConfig);
    await persistSession(session);
    sendJson(res, 200, {
        ok: true,
        providerConfig: sanitizeProviderConfig(session.providerConfig)
    });
}

async function handleSdkSetPermissionMode(req, res, session) {
    const body = await readJsonBody(req);
    const permissionMode = String(body.permissionMode || body.mode || '').trim();
    const allowedModes = new Set(['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan']);
    if (!allowedModes.has(permissionMode)) {
        sendJson(res, 400, {
            ok: false,
            message: 'permissionMode must be one of default, acceptEdits, dontAsk, bypassPermissions, plan'
        });
        return;
    }
    const agent = await ensureSessionAgent(session);

    session.providerConfig.sdkOptions = {
        ...(session.providerConfig.sdkOptions || {}),
        permissionMode
    };
    await persistSession(session);
    sendJson(res, 200, {
        ok: true,
        permissionMode
    });
}

async function handleSdkApiType(res, session) {
    const agent = await ensureSessionAgent(session);
    sendJson(res, 200, {
        ok: true,
        apiType: session.providerConfig.apiType
    });
}

async function handleSdkClose(res, session) {
    await piGateway.dispose(session.id);
    sendJson(res, 200, {
        ok: true,
        closed: true
    });
}

async function handleSdkPrompt(req, res, session) {
    const body = await readJsonBody(req);
    const prompt = String(body.prompt || body.message || '').trim();
    if (!prompt) {
        sendJson(res, 400, { ok: false, message: 'prompt is required' });
        return;
    }
    if (session.activeRun || session._piOperation) { sendJson(res, 409, { ok: false, message: 'Session is busy' }); return; }
    session.providerConfig = resolveProviderConfig(body.providerConfig || session.providerConfig);
    const descriptor = createRunDescriptor('message', session.context, {
        message: prompt, sdkOptions: resolveSdkOptions(body, SDK_QUERY_OPTION_KEYS)
    });
    await runSessionTask(session, descriptor);
    sendJson(res, 200, { ok: session.runState.status === 'succeeded', result: {
        text: session.runState.lastSummary || '', status: session.runState.status
    } });
}

async function handleSdkSessionList(res) {
    const sdkSessions = await listPiSessions();
    sendJson(res, 200, {
        ok: true,
        sessions: sdkSessions
    });
}

async function handleSdkFork(req, res) {
    const body = await readJsonBody(req);
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
        sendJson(res, 400, { ok: false, message: 'sessionId is required' });
        return;
    }
    const source = await getHydratedSession(sessionId);
    if (!source) { sendJson(res, 404, { ok: false, message: 'Session not found' }); return; }
    if (source.activeRun || source._piOperation || source._runStarting) { sendJson(res, 409, { ok: false, message: 'Session is busy' }); return; }
    source._piOperation = true;
    try {
        const target = await branchPiSession(source, body.entryId || null);
        sendJson(res, 200, { ok: true, session: target.id, draft: target.branchDraft || '' });
    } finally { delete source._piOperation; }
}

async function branchPiSession(source, entryId = null) {
    const target = createSession({ context: structuredClone(source.context), providerConfig: structuredClone(source.providerConfig), sessionScope: source.sessionScope });
    try {
        await piGateway.clone(source, target, entryId);
        target.title = `${source.title} · ${entryId ? '分支' : '副本'}`;
        target.engineInfo.sessionName = target.title;
        let cutoff = source.timeline.length;
        if (entryId) {
            const runId = Object.entries(source.engineInfo.runEntries || {}).find(([, entry]) => entry.userEntryId === entryId)?.[0];
            cutoff = runId ? source.timeline.findIndex(event => event.type === 'run_started' && event.payload?.runId === runId) : -1;
            // Older sessions lack an exact run mapping. Keep their business history
            // in the parent instead of falsely displaying a future timeline.
            if (cutoff < 0) cutoff = 0;
        }
        target.timeline = structuredClone(source.timeline.slice(0, cutoff));
        const retainedRuns = new Set(target.timeline.filter(event => event.type === 'run_started').map(event => event.payload?.runId));
        target.engineInfo.runEntries = Object.fromEntries(Object.entries(target.engineInfo.runEntries || {}).filter(([runId]) => retainedRuns.has(runId)));
        for (const runId of retainedRuns) {
            const from = getCheckpointDir(source.id, runId);
            try { await fs.cp(from, getCheckpointDir(target.id, runId), { recursive: true }); }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        emitEvent(target, 'system', { text: '已创建独立会话。工作区文件保持当前状态；文件恢复需单独预览并确认。', parentSession: target.parentSession });
        await persistSession(target);
        return target;
    } catch (error) {
        await piGateway.dispose(target.id);
        sessions.delete(target.id);
        await removePersistedSession(target.id);
        await fs.rm(path.dirname(getCheckpointDir(target.id, '_')), { recursive: true, force: true });
        await fs.rm(sessionPaths(target, getWorkspaceRoot(), configDirectory).sessions, { recursive: true, force: true });
        throw error;
    }
}

async function handleSteer(req, res, session) {
    const body = await readJsonBody(req);
    const message = String(body.message || '').trim();
    if (!message || message.startsWith('/')) {
        sendJson(res, 400, { message: '请输入补充要求；斜杠命令请通过命令入口执行。' }); return;
    }
    const run = session.activeRun;
    if (!run || run.interrupted || session.pendingApproval || session.pendingQuestion) {
        sendJson(res, 409, { message: '当前任务已结束或正在等待回答，请处理后重新发送。' }); return;
    }
    try {
        const result = await piGateway.manager.steer(session.id, { message });
        const event = emitEvent(session, 'user_followup', { runId: run.id, text: message, disposition: result.disposition });
        await persistSession(session);
        sendJson(res, 200, { ok: true, disposition: result.disposition, event });
    } catch (error) {
        sendJson(res, error.code === 'PI_IDLE' ? 409 : 400, { message: error.message });
    }
}

async function handlePiSessionCommand(req, res, session) {
    if (session.activeRun || session._runStarting || session._piOperation) {
        sendJson(res, 409, { ok: false, message: '当前会话正在运行，请完成或中断后再操作。' }); return;
    }
    session._piOperation = true;
    try {
        const body = await readJsonBody(req);
        const operation = body.operation;
        let result;
        if (operation === 'rewind-preview') {
            const entryId = String(body.entryId || '');
            const runId = Object.entries(session.engineInfo?.runEntries || {}).find(([, entry]) => entry.userEntryId === entryId)?.[0];
            if (!runId) throw new Error('该历史消息没有精确关联的文件检查点，可选择仅回溯对话。');
            let preview;
            try { preview = await rollbackRunToCheckpoint(session, runId, { dryRun: true, beforeRun: true }); }
            catch (error) { if (error.code === 'ENOENT') throw new Error('该历史消息的文件检查点已过期。'); throw error; }
            if (!preview.ok) { sendJson(res, 409, { ok: false, message: preview.summary, result: preview }); return; }
            const token = randomUUID();
            session._rewindPreview = { token, entryId, runId, preview, expires: Date.now() + 5 * 60_000 };
            result = { ...preview, token };
        } else if (['clone', 'fork', 'rewind'].includes(operation)) {
            if (operation !== 'clone' && !body.entryId) throw new Error('请选择历史用户消息。');
            let restore;
            if (body.restoreFiles) {
                restore = session._rewindPreview;
                if (operation !== 'rewind' || !restore || body.confirmationToken !== restore.token || restore.entryId !== body.entryId || restore.expires < Date.now()) {
                    throw new Error('恢复文件需先预览并确认，请重新选择历史节点。');
                }
                const current = await rollbackRunToCheckpoint(session, restore.runId, { dryRun: true, beforeRun: true });
                if (!current.ok || JSON.stringify(current) !== JSON.stringify(restore.preview)) throw new Error('文件状态已变化，请重新预览并确认。');
            }
            const target = await branchPiSession(session, operation === 'clone' ? null : String(body.entryId));
            if (restore) {
                const rollback = await rollbackRunToCheckpoint(session, restore.runId, { beforeRun: true });
                if (!rollback.ok) {
                    sendJson(res, 409, { ok: false, message: rollback.summary, result: { ...rollback, sessionId: target.id } }); return;
                }
                delete session._rewindPreview;
                session.engineInfo.workspaceNotice = `用户已将工作区文件恢复至运行 ${restore.runId} 之前。请读取实际文件再继续。`;
                target.engineInfo.workspaceNotice = session.engineInfo.workspaceNotice;
                emitEvent(session, 'run_rollback', { runId: restore.runId, mode: 'to_checkpoint', result: rollback });
                await persistSession(session);
                await persistSession(target);
            }
            result = { sessionId: target.id, draft: target.branchDraft || '', filesRestored: Boolean(restore) };
        } else if (operation === 'export') {
            result = { html: await piGateway.exportSession(session) };
        } else if (operation === 'compact') {
            result = await piGateway.compact(session, String(body.value || ''));
            emitEvent(session, 'sdk_compact', { ...result, phase: 'done' });
        } else result = await piGateway.sessionCommand(session, operation, body);
        await persistSession(session);
        sendJson(res, 200, { ok: true, result });
    } finally { delete session._piOperation; }
}

async function handleArchiveSession(req, res, session) {
    const body = await readJsonBody(req);
    session.archivedAt = body.restore ? null : new Date().toISOString();
    await persistSession(session);
    sendJson(res, 200, {
        ok: true,
        archived: Boolean(session.archivedAt)
    });
}

async function handleRunChanges(res, session, runId) {
    const existing = getRunChangesPayload(session, runId);
    if (existing) {
        let changes = existing;
        if (existing.rollbackStatus === 'available') {
            try {
                await fs.access(getCheckpointFilePath(session.id, runId));
            } catch {
                changes = { ...existing, rollbackStatus: 'expired' };
            }
        }
        sendJson(res, 200, {
            ok: true,
            changes
        });
        return;
    }
    const changes = await detectRunChanges(session, runId);
    sendJson(res, 200, {
        ok: true,
        changes
    });
}

async function handleRunRollback(req, res, session, runId) {
    if (session.activeRun || session._piOperation) {
        sendJson(res, 409, {
            ok: false,
            status: 'busy',
            message: '当前任务仍在执行，请先停止或等待完成后再撤销。'
        });
        return;
    }
    const body = await readJsonBody(req);
    const mode = body.mode === 'single' ? 'single' : body.mode === 'restore' ? 'restore' : 'to_checkpoint';
    const restoreMode = body.restoreMode === 'to_checkpoint' ? 'to_checkpoint' : 'single';
    const force = Boolean(body.force);
    let result;
    try {
        result = mode === 'restore'
            ? await restoreRunFromSnapshot(session, runId, { mode: restoreMode, force })
            : await rollbackRunToCheckpoint(session, runId, { mode, force });
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        sendJson(res, 410, {
            ok: false,
            status: 'expired',
            runId,
            message: '该运行的撤销记录已过期。'
        });
        return;
    }
    if (result.ok) {
        ensureEngineInfo(session).workspaceNotice = `工作区文件已执行 ${mode}，关联运行 ${runId}。请读取实际文件确认当前状态。`;
        await persistSession(session);
    }
    emitEvent(session, 'run_rollback', {
        runId,
        mode,
        restoreMode: mode === 'restore' ? restoreMode : null,
        force,
        result
    });
    sendJson(res, result.ok ? 200 : (result.status === 'conflict' ? 409 : 400), result);
}

async function handleStreamAttach(res, session) {
    res.writeHead(200, createSseHeaders());
    attachSubscriber(session, res, 'session');
    try {
        if (session.runState?.active) ensureRunPreview(session, {
            configDirectory, getWorkspaceRoot, workspaceLocked,
            emit: (name, data) => emitEvent(session, name, data, { persist: false })
        });
    } catch (error) { console.warn('[preview]', error.message); }
    // Immediately push current run state so the frontend can correctly restore its UI
    // (e.g. stop button) after a browser refresh while a run is still in progress.
    if (session.runState?.active) {
        writeSseEvent(res, 'run_status', redactSecrets({
            id: randomUUID(),
            type: 'run_status',
            runId: session.runState.runId,
            createdAt: new Date().toISOString(),
            payload: {
                runState: session.runState,
                ...previewRunMetadata(session),
                context: session.context,
                summary: session.runState.stageMessage || '正在运行…'
            }
        }, sessionSecrets(session)));
    }
}

function runNeedsAgent(normalizedKind, commandId) {
    if (normalizedKind === 'dev-simulate') return false;
    if (normalizedKind === 'command') {
        const command = getLocalCommand(commandId);
        return Boolean(command?.skillId);
    }
    return true;
}

function normalizeRunRequest(kind, body = {}) {
    if (kind === 'prototype') {
        const skill = getLocalSkill('generate-page-prototype');
        return {
            kind: 'skill',
            body: {
                ...body,
                skillId: skill?.id || 'generate-page-prototype',
                message: body.message || skill?.defaultStarter || ''
            }
        };
    }

    if (kind === 'generate-prd') {
        const skill = getLocalSkill('generate-product-doc');
        return {
            kind: 'skill',
            body: {
                ...body,
                skillId: skill?.id || 'generate-product-doc',
                message: body.message || skill?.defaultStarter || ''
            }
        };
    }

    if (kind === 'command') {
        return {
            kind: 'command',
            body
        };
    }

    return { kind, body };
}

async function handleStartRun(req, res, session, kind, extraBody = {}) {
    const rawBody = {
        ...(await readJsonBody(req)),
        ...extraBody
    };
    if (kind === 'message' && /^\/[a-z0-9_-]+(?:\s|$)/i.test(String(rawBody.message || ''))) {
        sendJson(res, 400, { ok: false, message: '斜杠命令请通过命令入口执行；输入 /help 查看可用命令。' }); return;
    }
    const normalized = normalizeRunRequest(kind, rawBody);
    const body = normalized.body;
    const normalizedKind = normalized.kind;

    if (session.activeRun || session._runStarting || session._piOperation) {
        res.writeHead(200, createSseHeaders());
        const subscriber = attachSubscriber(session, res, 'run', session.runState.runId);
        // Use run_busy instead of run_failed: busy is a transient rejection, not a terminal
        // run state. Using run_failed would incorrectly clear the frontend's stop button while
        // the actual run is still in progress.
        writeSseEvent(res, 'run_busy', {
            id: randomUUID(),
            type: 'run_busy',
            runId: session.runState.runId,
            createdAt: new Date().toISOString(),
            payload: {
                reason: '当前已有任务在执行，请先等待完成或中断后再试。',
                classification: 'busy'
            }
        });
        closeSubscriber(subscriber);
        session.subscribers.delete(subscriber);
        return;
    }

    session._runStarting = true;
    try {
    try {
        body.attachments = await persistAgentImageAttachments(session.id, body.attachments || []);
    } catch (error) {
        sendJson(res, error?.status || 400, {
            ok: false,
            reason: error?.message || '图片附件无效',
            classification: error?.classification || 'invalid_attachment'
        });
        return;
    }

    session.context = normalizeContext({
        ...body,
        globalContext: isGlobalRunRequest(normalizedKind, body, session)
    });
    session.sessionScope = session.context.globalContext ? 'global' : 'page';
    const descriptor = createRunDescriptor(normalizedKind, session.context, body);
    const availability = await getContextAvailability(session.context, descriptor);
    if (availability.blocked) {
        sendJson(res, 409, {
            ok: false,
            reason: availability.reason,
            classification: 'context_deleted'
        });
        return;
    }
    const shouldUpdateTitle = shouldRefreshSessionTitle(session, descriptor);

    if (runNeedsAgent(normalizedKind, body.commandId)) {
        session.providerConfig = resolveProviderConfig(body.providerConfig || session.providerConfig);
    } else {
        session.providerConfig = resolveProviderConfig(body.providerConfig || session.providerConfig);
    }

    res.writeHead(200, createSseHeaders());
    attachSubscriber(session, res, 'run', null);
    if (shouldUpdateTitle) {
        queueMicrotask(() => {
            refreshSessionTitle(session, descriptor).catch((error) => {
                console.warn('[agent-gateway] Failed to refresh session title:', error);
            });
        });
    }

    try {
        queueMicrotask(async () => {
            try {
                await runSessionTask(session, descriptor, {
                    internalInstructions: String(body.internalInstructions || '').trim()
                });
            } catch (error) {
                const failure = classifyRuntimeError(error, session.providerConfig);
                emitEvent(session, 'run_failed', {
                    runId: session.runState.runId,
                    reason: failure.message,
                    classification: failure.classification,
                    httpStatus: failure.httpStatus || null
                });
            }
        });
    } catch (error) {
        sendText(res, 500, error?.message || '无法启动任务');
    }
    } finally {
        session._runStarting = false;
    }
}

async function handleInterrupt(req, res, session) {
    if (!session.activeRun) {
        sendJson(res, 200, {
            ok: true,
            interrupted: false,
            message: '当前没有正在执行的任务'
        });
        return;
    }

    const activeRun = session.activeRun;
    const runId = activeRun.id || session.runState?.runId || null;
    activeRun.interrupted = true;
    markRunInterrupted(session, runId);
    resetTransientWaiters(session);
    if (activeRun.heartbeatTimer) {
        clearInterval(activeRun.heartbeatTimer);
    }

    activeRun.abortController?.abort(new Error('User interrupted task'));
    await piGateway.manager.abort(session.id).catch(error => {
        console.warn('[agent-gateway] Pi abort failed:', error.message);
    });
    await finishInterruptedRun(session, activeRun, runId, {
        stageMessage: '任务已中断', summary: '用户已中断当前任务'
    });
    if (session.activeRun?.id === runId) session.activeRun = null;
    queueMicrotask(() => finalizeRunCheckpoint(session, runId).catch(error => {
        console.warn('[agent-gateway] Failed to finalize interrupted checkpoint:', error);
    }));

    sendJson(res, 200, {
        ok: true,
        interrupted: true
    });
}

async function handleApproval(req, res, session, approvalId) {
    const body = await readJsonBody(req);
    if (!session.pendingApproval || session.pendingApproval.id !== approvalId) {
        sendJson(res, 404, { ok: false, message: '待审批项不存在或已过期' });
        return;
    }

    const decision = body.decision;
    if (!['allow_once', 'allow_session', 'deny'].includes(decision)) {
        sendJson(res, 400, { ok: false, message: '无效的审批动作' });
        return;
    }

    session.pendingApproval.resolve(decision);
    sendJson(res, 200, { ok: true, decision });
}

async function handleQuestion(req, res, session, questionId) {
    const body = await readJsonBody(req);
    if (!session.pendingQuestion || session.pendingQuestion.id !== questionId) {
        sendJson(res, 404, { ok: false, message: '待回答问题不存在或已过期' });
        return;
    }

    const answer = summarizeText(body.answer || '', 2000);
    if (!answer) {
        sendJson(res, 400, { ok: false, message: '回答不能为空' });
        return;
    }

    session.pendingQuestion.resolve(answer);
    sendJson(res, 200, { ok: true, answer });
}

async function handleDeleteSession(res, session) {
    resetTransientWaiters(session);
    if (session.activeRun?.heartbeatTimer) {
        clearInterval(session.activeRun.heartbeatTimer);
    }
    session.activeRun?.abortController?.abort();
    await piGateway.dispose(session.id);
    const piPaths = sessionPaths(session, getWorkspaceRoot(), configDirectory);
    await fs.rm(piPaths.sessions, { recursive: true, force: true });
    await fs.rm(piPaths.config, { recursive: true, force: true });
    await fs.rm(piPaths.backup, { recursive: true, force: true });
    session.subscribers.forEach((subscriber) => closeSubscriber(subscriber));
    session.closed = true;
    sessions.delete(session.id);
    await removePersistedSession(session.id);
    const checkpointDir = path.join(path.join(getWorkspaceRoot(), 'data', 'agent-checkpoints'), session.id);
    if (checkpointDir.startsWith(path.join(getWorkspaceRoot(), 'data', 'agent-checkpoints') + path.sep)) {
        await fs.rm(checkpointDir, { recursive: true, force: true });
    }
    sendJson(res, 200, { ok: true });
}

function matchPath(urlPath, pattern) {
    const actual = urlPath.split('/').filter(Boolean);
    const wanted = pattern.split('/').filter(Boolean);
    if (actual.length !== wanted.length) return null;
    const params = {};

    for (let index = 0; index < wanted.length; index += 1) {
        const expected = wanted[index];
        const value = actual[index];
        if (expected.startsWith(':')) {
            params[expected.slice(1)] = value;
        } else if (expected !== value) {
            return null;
        }
    }

    return params;
}

let workspaceChanging = false;
let workspacePrepareDeadline = 0;
let workspaceRequests = 0;
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
        res.writeHead(204, SESSION_STREAM_HEADERS);
        res.end();
        return;
    }

    try {
        if (req.method === 'POST' && url.pathname.startsWith('/api/agent/workspace/')) {
            if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || req.headers.origin) {
                sendJson(res, 403, { error: 'Local service requests only' }); return;
            }
            if (url.pathname.endsWith('/prepare')) {
                if (workspaceChanging || workspaceRequests || Array.from(sessions.values()).some(session => session.activeRun || session.runState?.active)) {
                    sendJson(res, 409, { error: '请结束正在运行的 AI 任务后重试。' }); return;
                }
                workspaceChanging = true;
                workspacePrepareDeadline = Date.now() + 30000;
                try {
                    for (const timer of scheduledSessionPersists.values()) clearTimeout(timer);
                    scheduledSessionPersists.clear();
                    await Promise.allSettled([...pendingWorkspaceWrites]);
                    let sourceAvailable = true;
                    try { getWorkspaceRoot(); } catch { sourceAvailable = false; }
                    if (sourceAvailable) for (const session of sessions.values()) if (!session._summaryOnly) await persistSession(session);
                } catch (error) { workspaceChanging = false; throw error; }
                sendJson(res, 200, { ok: true }); return;
            }
            if (url.pathname.endsWith('/complete')) {
                for (const session of sessions.values()) {
                    session.closed = true;
                    for (const subscriber of session.subscribers || []) subscriber.end?.();
                }
                await piGateway.releaseAll();
                sessions.clear();
                await hydratePersistedSessions();
                workspaceChanging = false;
                sendJson(res, 200, { ok: true }); return;
            }
            sendJson(res, 404, { error: 'Unknown workspace operation' }); return;
        }
        if (workspaceChanging && !workspaceLocked() && Date.now() > workspacePrepareDeadline) workspaceChanging = false;
        if (workspaceChanging || workspaceLocked()) {
            sendJson(res, 423, { error: '工作区正在切换，请等待完成。' }); return;
        }
        getWorkspaceRoot();
        workspaceRequests += 1;
        req._workspaceRequest = true;
        await refreshProjectSkills();

        if (req.method === 'GET' && url.pathname === '/api/agent/health') {
            sendJson(res, 200, {
                ok: true,
                now: new Date().toISOString(),
                sessions: sessions.size,
                activeRuns: [...sessions.values()].filter(session => session.runState?.active).length,
                piRuntimes: piGateway.manager.entries.size,
                installation: createHash('sha256').update(fsSync.realpathSync(ROOT_DIR)).digest('hex'),
                build: PRODUCT_AGENT_BUILD
            });
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/agent/templates') {
            const includeDisabled = url.searchParams.get('includeDisabled') !== '0'
                && url.searchParams.get('includeDisabled') !== 'false';
            sendJson(res, 200, {
                ok: true,
                ...(await listTemplateSystems({ includeDisabled }))
            });
            return;
        }

        const templateStatusMatch = matchPath(url.pathname, '/api/agent/templates/:templateId/status');
        if (req.method === 'POST' && templateStatusMatch) {
            const body = await readJsonBody(req);
            if (typeof body.enabled !== 'boolean') {
                throw createClassifiedError('enabled 必须是布尔值。', 'invalid_template_status', 400);
            }
            const template = await setTemplateEnabled(decodeURIComponent(templateStatusMatch.templateId), body.enabled);
            sendJson(res, 200, {
                ok: true,
                template,
                ...(await listTemplateSystems({ includeDisabled: true }))
            });
            return;
        }

        const templateDeleteMatch = matchPath(url.pathname, '/api/agent/templates/:templateId');
        if (req.method === 'DELETE' && templateDeleteMatch) {
            const result = await deleteTemplateSystem(decodeURIComponent(templateDeleteMatch.templateId));
            sendJson(res, 200, {
                ok: true,
                ...result,
                ...(await listTemplateSystems({ includeDisabled: true }))
            });
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/agent/skills') {
            const includeDisabled = url.searchParams.get('includeDisabled') === '1'
                || url.searchParams.get('includeDisabled') === 'true'
                || url.searchParams.get('scope') === 'all';
            sendJson(res, 200, {
                ok: true,
                skills: listUserInvocableSkills({ includeDisabled })
            });
            return;
        }

        const skillDetailMatch = matchPath(url.pathname, '/api/agent/skills/:skillId/detail');
        if (req.method === 'GET' && skillDetailMatch) {
            sendJson(res, 200, {
                ok: true,
                skill: await getProjectSkillDetail(decodeURIComponent(skillDetailMatch.skillId))
            });
            return;
        }

        const skillStatusMatch = matchPath(url.pathname, '/api/agent/skills/:skillId/status');
        if (req.method === 'POST' && skillStatusMatch) {
            const body = await readJsonBody(req);
            if (typeof body.enabled !== 'boolean') {
                throw createClassifiedError('enabled 必须是布尔值。', 'invalid_skill_status', 400);
            }
            const skill = await setProjectSkillEnabled(decodeURIComponent(skillStatusMatch.skillId), body.enabled);
            sendJson(res, 200, {
                ok: true,
                skill,
                skills: listUserInvocableSkills({ includeDisabled: true })
            });
            return;
        }

        const skillDeleteMatch = matchPath(url.pathname, '/api/agent/skills/:skillId');
        if (req.method === 'DELETE' && skillDeleteMatch) {
            const result = await deleteProjectSkill(decodeURIComponent(skillDeleteMatch.skillId));
            sendJson(res, 200, {
                ok: true,
                ...result,
                skills: listUserInvocableSkills({ includeDisabled: true })
            });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/agent/skills/import') {
            const imported = await importProjectSkill(await readJsonBody(req));
            sendJson(res, 200, {
                ok: true,
                skill: imported,
                skills: listUserInvocableSkills({ includeDisabled: true })
            });
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/agent/commands') {
            const sessionId = url.searchParams.get('sessionId');
            const session = sessionId ? await getHydratedSession(sessionId) : null;
            let commands = listUserInvocableCommands();
            const runtime = session && piGateway.manager.get(session.id);
            if (runtime && !runtime.busy) {
                const native = await runtime.rpc.request('get_commands');
                commands = mergePiCommands(commands, native.commands);
                session._piCommands = commands.filter(command => command.source === 'pi-extension');
            }
            sendJson(res, 200, { ok: true, commands });
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/agent/sdk') {
            sendJson(res, 200, buildAgentSdkInfo());
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/agent/sdk/sessions') {
            await handleSdkSessionList(res);
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/agent/sdk/fork') {
            await handleSdkFork(req, res);
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/agent/page/download-zip') {
            await handleDownloadZip(req, res);
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/agent/sessions') {
            await handleListSessions(res, url);
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/agent/test-connection') {
            const body = await readJsonBody(req);
            const result = await testConnection(body.providerConfig || body);
            sendJson(res, 200, result);
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/agent/fetch-models') {
            const body = await readJsonBody(req);
            const result = await fetchProviderModels(body.providerConfig || body);
            sendJson(res, result.ok ? 200 : 400, result);
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/agent/get-balance') {
            const body = await readJsonBody(req);
            const result = await queryBalance(body.providerConfig || body);
            sendJson(res, result.ok ? 200 : 400, result);
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/agent/session') {
            await handleCreateSession(req, res);
            return;
        }

        const piCommandMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/pi');
        if (req.method === 'POST' && piCommandMatch) {
            const session = await getHydratedSession(piCommandMatch.sessionId);
            if (!session) { sendJson(res, 404, { ok: false, message: 'Session not found' }); return; }
            await handlePiSessionCommand(req, res, session);
            return;
        }

        const historyMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/history');
        if (req.method === 'GET' && historyMatch) {
            const session = await getHydratedSession(historyMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleHistory(res, session);
            return;
        }

        const sdkMessagesMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/sdk/messages');
        if (req.method === 'GET' && sdkMessagesMatch) {
            const session = await getHydratedSession(sdkMessagesMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkMessages(res, session);
            return;
        }

        const sdkClearMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/sdk/clear');
        if (req.method === 'POST' && sdkClearMatch) {
            const session = await getHydratedSession(sdkClearMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkClear(res, session);
            return;
        }

        const sdkSetModelMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/sdk/set-model');
        if (req.method === 'POST' && sdkSetModelMatch) {
            const session = await getHydratedSession(sdkSetModelMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkSetModel(req, res, session);
            return;
        }

        const sdkSetContextMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/set-context');
        if (req.method === 'POST' && sdkSetContextMatch) {
            const session = await getHydratedSession(sdkSetContextMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkSetContext(req, res, session);
            return;
        }

        const sdkSetProviderMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/sdk/set-provider');
        if (req.method === 'POST' && sdkSetProviderMatch) {
            const session = await getHydratedSession(sdkSetProviderMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkSetProvider(req, res, session);
            return;
        }

        const sdkSetPermissionMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/sdk/set-permission-mode');
        if (req.method === 'POST' && sdkSetPermissionMatch) {
            const session = await getHydratedSession(sdkSetPermissionMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkSetPermissionMode(req, res, session);
            return;
        }

        const sdkApiTypeMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/sdk/api-type');
        if (req.method === 'GET' && sdkApiTypeMatch) {
            const session = await getHydratedSession(sdkApiTypeMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkApiType(res, session);
            return;
        }

        const sdkCloseMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/sdk/close');
        if (req.method === 'POST' && sdkCloseMatch) {
            const session = await getHydratedSession(sdkCloseMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkClose(res, session);
            return;
        }

        const sdkPromptMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/sdk/prompt');
        if (req.method === 'POST' && sdkPromptMatch) {
            const session = await getHydratedSession(sdkPromptMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleSdkPrompt(req, res, session);
            return;
        }

        const streamMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/stream');
        if (req.method === 'GET' && streamMatch) {
            const session = await getHydratedSession(streamMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleStreamAttach(res, session);
            return;
        }

        const archiveMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/archive');
        if (req.method === 'POST' && archiveMatch) {
            const session = await getHydratedSession(archiveMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleArchiveSession(req, res, session);
            return;
        }

        const runChangesMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/runs/:runId/changes');
        if (req.method === 'GET' && runChangesMatch) {
            const session = await getHydratedSession(runChangesMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleRunChanges(res, session, decodeURIComponent(runChangesMatch.runId));
            return;
        }

        const runRollbackMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/runs/:runId/rollback');
        if (req.method === 'POST' && runRollbackMatch) {
            const session = await getHydratedSession(runRollbackMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleRunRollback(req, res, session, decodeURIComponent(runRollbackMatch.runId));
            return;
        }

        const steerMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/steer');
        if (req.method === 'POST' && steerMatch) {
            const session = await getHydratedSession(steerMatch.sessionId);
            if (!session) { sendText(res, 404, 'Session not found'); return; }
            await handleSteer(req, res, session);
            return;
        }

        const messageMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/message');
        if (req.method === 'POST' && messageMatch) {
            const session = await getHydratedSession(messageMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleStartRun(req, res, session, 'message');
            return;
        }

        const skillRunMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/skills/:skillId/run');
        if (req.method === 'POST' && skillRunMatch) {
            const session = await getHydratedSession(skillRunMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleStartRun(req, res, session, 'skill', {
                skillId: decodeURIComponent(skillRunMatch.skillId)
            });
            return;
        }

        const commandRunMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/commands/:commandId/run');
        if (req.method === 'POST' && commandRunMatch) {
            const session = await getHydratedSession(commandRunMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleStartRun(req, res, session, 'command', {
                commandId: decodeURIComponent(commandRunMatch.commandId)
            });
            return;
        }

        const prototypeMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/actions/prototype');
        if (req.method === 'POST' && prototypeMatch) {
            const session = await getHydratedSession(prototypeMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleStartRun(req, res, session, 'prototype');
            return;
        }

        const prdMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/actions/generate-prd');
        if (req.method === 'POST' && prdMatch) {
            const session = await getHydratedSession(prdMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleStartRun(req, res, session, 'generate-prd');
            return;
        }

        const simulateMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/actions/dev-simulate');
        if (req.method === 'POST' && simulateMatch) {
            const session = await getHydratedSession(simulateMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleStartRun(req, res, session, 'dev-simulate');
            return;
        }

        const interruptMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/interrupt');
        if (req.method === 'POST' && interruptMatch) {
            const session = await getHydratedSession(interruptMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleInterrupt(req, res, session);
            return;
        }

        const approvalMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/approvals/:approvalId');
        if (req.method === 'POST' && approvalMatch) {
            const session = await getHydratedSession(approvalMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleApproval(req, res, session, approvalMatch.approvalId);
            return;
        }

        const questionMatch = matchPath(url.pathname, '/api/agent/session/:sessionId/questions/:questionId');
        if (req.method === 'POST' && questionMatch) {
            const session = await getHydratedSession(questionMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleQuestion(req, res, session, questionMatch.questionId);
            return;
        }

        const deleteMatch = matchPath(url.pathname, '/api/agent/session/:sessionId');
        if (req.method === 'DELETE' && deleteMatch) {
            const session = await getHydratedSession(deleteMatch.sessionId);
            if (!session) {
                sendText(res, 404, 'Session not found');
                return;
            }
            await handleDeleteSession(res, session);
            return;
        }

        sendText(res, 404, 'Not found');
    } catch (error) {
        console.error('[agent-gateway] Request failed:', error);
        sendJson(res, 500, {
            ok: false,
            message: summarizeText(error?.message || String(error), 500)
        });
    } finally {
        if (req._workspaceRequest) workspaceRequests -= 1;
    }
});

server.listen(PORT, HOST, () => {
    logInfo(`Listening on http://${HOST}:${PORT}`);
});

let shuttingDown = false;
async function shutdownGateway() {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const session of sessions.values()) {
        session.activeRun?.abortController?.abort(new Error('Gateway is shutting down'));
        resetTransientWaiters(session);
        if (session.activeRun?.heartbeatTimer) clearInterval(session.activeRun.heartbeatTimer);
        for (const subscriber of session.subscribers || []) closeSubscriber(subscriber);
    }
    await piGateway.manager.disposeAll();
    await Promise.allSettled([...sessions.values()].filter(session => !session._summaryOnly).map(persistSession));
    for (const timer of scheduledSessionPersists.values()) clearTimeout(timer);
    server.close(() => process.exit(0));
    server.closeAllConnections();
}
process.once('SIGTERM', shutdownGateway);
process.once('SIGINT', shutdownGateway);
