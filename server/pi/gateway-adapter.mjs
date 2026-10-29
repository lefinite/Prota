import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PiRuntimeManager } from './runtime-manager.mjs';
import { PiEventAdapter } from './event-adapter.mjs';
import { adaptProvider, prepareProviderDirectory, readPiModelCatalog, assertImageInput } from './provider-adapter.mjs';
import { mapAllowedTools, normalizeToolSelection, isToolAllowed } from './tool-policy.mjs';
import { ensureEngineInfo, sessionPaths, prepareLegacyRecovery, synchronizeEngineInfo } from './session-adapter.mjs';
import { piRuntime } from '../../scripts/pi-paths.mjs';
import { verifyPi } from '../../scripts/verify-pi.mjs';
import { adaptMcpServers } from './mcp-adapter.mjs';
import { knownSecrets, redactText } from './secrets.mjs';

export class ProtaPiGateway {
    constructor({ workspaceRoot, configDirectory }) {
        this.workspaceRoot = workspaceRoot;
        this.configDirectory = configDirectory;
        this.configurations = new Map();
        this.catalog = null;
        this.verification = null;
        this.manager = new PiRuntimeManager({ configure: async id => {
            const config = this.configurations.get(id);
            if (!config) throw new Error('Missing Prota Pi runtime configuration');
            return config;
        } });
        this.manager.on('runtime_disconnected', id => this.configurations.delete(id));
    }

    async ensure(session, options = {}) {
        try { await (this.verification ||= verifyPi(undefined, { smoke: false })); }
        catch (error) {
            this.verification = null;
            throw new Error(`Pi runtime is unavailable or invalid. Run npm run pi:build before starting Prota. ${error.message}`);
        }
        const root = this.workspaceRoot();
        const paths = sessionPaths(session, root, this.configDirectory);
        const engine = ensureEngineInfo(session);
        this.catalog ||= readPiModelCatalog();
        // Prota owns cwd and cancellation through run().signal / interrupt.
        // Old SDK callback options remain visible to validation, so a meaningful
        // custom callback cannot be silently discarded at the RPC boundary.
        const { cwd, ...jsonOptions } = options;
        const provider = { ...session.providerConfig, sdkOptions: { ...session.providerConfig.sdkOptions, ...jsonOptions } };
        if (engine.thinkingLevel && engine.thinkingTarget === JSON.stringify([provider.provider, provider.baseURL, provider.model])) provider.sdkOptions = { ...provider.sdkOptions, reasoningEffort: engine.thinkingLevel };
        const adapted = adaptProvider(provider, { catalog: this.catalog, capabilities: provider.modelCapabilities || {} });
        const mcp = adaptMcpServers(provider.sdkOptions.mcpServers);
        const mcpSignature = createHash('sha256').update(JSON.stringify(mcp)).digest('hex');
        const persistence = provider.sdkOptions.persistSession ?? true;
        const transient = Boolean(session._transient);
        const signature = createHash('sha256').update(JSON.stringify({ root, models: adapted.models, settings: adapted.settings,
            mcpSignature, key: provider.apiKey, piSessionId: engine.piSessionId, persistence, transient })).digest('hex');
        const current = this.manager.get(session.id);
        if (current && current.config.signature !== signature) {
            if (current.busy) throw new Error('Cannot change provider while a Pi run is active');
            const previous = current.config.adapted;
            const previousProvider = previous.models.providers[previous.providerId];
            const nextProvider = adapted.models.providers[adapted.providerId];
            const declared = previousProvider.models.find(model => model.id === provider.model);
            const catalogKey = models => JSON.stringify([...models].sort((a, b) => a.id.localeCompare(b.id)));
            if (current.config.cwd === root && current.config.persistence === persistence && current.config.transient === transient
                && current.config.mcpSignature === mcpSignature && previous.providerId === adapted.providerId && previousProvider.baseUrl === nextProvider.baseUrl
                && previousProvider.api === nextProvider.api && current.config.env.PROTA_PI_API_KEY === provider.apiKey
                && catalogKey(previousProvider.models) === catalogKey(nextProvider.models)
                && declared && JSON.stringify(declared) === JSON.stringify(adapted.model)
                && JSON.stringify(previous.settings) === JSON.stringify(adapted.settings)) {
                await this.manager.setModel(session.id, adapted.providerId, provider.model);
                if (adapted.thinkingLevel) await current.rpc.request('set_thinking_level', { level: adapted.thinkingLevel });
                current.config.signature = signature;
                current.config.adapted = adapted;
            } else await this.dispose(session.id);
        }
        if (!this.manager.get(session.id)) {
            const prepared = prepareProviderDirectory(paths.config, provider, { catalog: this.catalog, capabilities: provider.modelCapabilities || {} });
            await fs.writeFile(path.join(paths.config, 'mcp.json'), JSON.stringify(mcp.config), { mode: 0o600 });
            await fs.mkdir(paths.sessions, { recursive: true });
            // Builtin resource sources are always sorted after file extensions,
            // regardless of CLI order. Load Pi's unchanged official MCP factory
            // as a file first so it awaits direct tools before our policy hook.
            const args = ['--no-extensions', '--no-mcp', ...(mcp.names.length ? ['--extension',
                path.join(piRuntime, 'node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/index.js')] : []),
                '--extension', path.join(piRuntime, 'extensions/prota-extension.mjs'),
                '--no-skills', '--no-prompt-templates', '--no-approve',
                '--tools', `read,write,edit,find,grep,ls,ask_user,${process.platform === 'win32' ? 'powershell' : 'bash'}${mcp.names.length ? ',mcp__*' : ''}`,
                '--provider', prepared.providerId, '--model', provider.model];
            if (provider.sdkOptions.persistSession === false || session._transient) args.push('--no-session');
            else args.push('--session-id', engine.piSessionId, '--session-dir', paths.sessions);
            if (prepared.thinkingLevel) args.push('--thinking', prepared.thinkingLevel);
            this.configurations.set(session.id, { cwd: root, args, env: { ...prepared.env, ...mcp.env,
                READIFY_WORKSPACE: root, READIFY_CONFIG_DIR: this.configDirectory,
                PROTA_PI_REDACT_VALUES: JSON.stringify(mcp.secretValues),
                PROTA_PI_RUN_CONFIG: path.join(paths.config, 'run.json'),
                PROTA_PI_MIGRATION_CONFIG: path.join(paths.config, 'migration.json') }, signature, persistence, transient, mcpSignature, mcpNames: mcp.names, paths, adapted: prepared });
        }
        const runtime = await this.manager.ensure(session.id);
        if (!runtime.busy && engine.autoCompaction !== undefined) await runtime.rpc.request('set_auto_compaction', { enabled: engine.autoCompaction });
        return { runtime, paths, adapted };
    }

    async run(session, { prompt, options, runId, emit, setRunState, approval, question, onToolResult, signal }) {
        const { runtime, paths, adapted } = await this.ensure(session, options);
        const secrets = knownSecrets(runtime.config.env);
        const blocks = Array.isArray(prompt) ? prompt : [{ type: 'text', text: prompt }];
        const images = blocks.filter(block => block.type === 'image').map(block => ({ type: 'image', data: block.source?.data || block.data,
            mimeType: block.source?.media_type || block.mimeType }));
        assertImageInput(adapted.model, images);
        if (['pending', 'failed'].includes(session.engineInfo.migrationStatus)) await synchronizeEngineInfo(session, runtime);
        let recovery = await prepareLegacyRecovery(session, paths, this.workspaceRoot());
        if (recovery?.mode === 'converted') {
            await this.importLegacy(session, runtime, paths, recovery);
            recovery = null;
            emit('sdk_status', { runId, message: '旧会话消息与工具关联已转换为 Pi 原生历史，原始数据已备份。缺失的历史计量信息没有补测。' });
        }
        const allowed = mapAllowedTools(options.allowedTools || ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'AskUserQuestion']);
        const denied = new Set(mapAllowedTools(options.disallowedTools || []));
        const policy = { schemaVersion: 1, runId, sessionId: session.id, workspaceRoot: this.workspaceRoot(),
            readRoots: [path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')],
            allowedTools: allowed, availableTools: normalizeToolSelection(options.tools ?? session.providerConfig.sdkOptions?.tools),
            disallowedTools: [...denied], permissionMode: options.permissionMode || 'default',
            maxTurns: options.maxTurns || 200,
            systemContext: [options.systemPrompt, options.appendSystemPrompt, session.engineInfo.workspaceNotice].filter(Boolean).join('\n\n'),
            reasoningBody: adapted.reasoningBody, legacyRecovery: recovery };
        const filename = runtime.config.env.PROTA_PI_RUN_CONFIG;
        await fs.writeFile(`${filename}.next`, JSON.stringify(policy), { mode: 0o600 });
        await fs.rename(`${filename}.next`, filename);
        const interactions = new Set();
        let interactionTail = Promise.resolve();
        const controller = new AbortController();
        const abort = () => controller.abort(signal?.reason);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const partials = (options.includePartialMessages ?? session.providerConfig.sdkOptions?.includePartialMessages) !== false;
        const adapter = new PiEventAdapter({ runId,
            emit: (type, payload, eventOptions) => {
                if (!partials && (type === 'assistant_delta' || (['assistant_message', 'assistant_thinking'].includes(type) && payload.partial))) return;
                emit(type, payload, eventOptions);
            },
            setRunState: patch => setRunState(!partials && ('partialAssistantText' in patch || 'partialAssistantEventId' in patch)
                ? { ...patch, partialAssistantText: '', partialAssistantEventId: null } : patch),
            onToolResult, secrets,
            onInteraction: (record, interaction) => {
                const work = interactionTail.then(async () => {
                    try {
                        const value = interaction.kind === 'approval'
                            ? await approval(interaction.toolName, interaction.input, record)
                            : await question(interaction.question, record.method === 'select' ? interaction.options : [], record);
                        await runtime.rpc.respondToUI(record.id, { value });
                    } catch {
                        if (!runtime.rpc.closed) await runtime.rpc.respondToUI(record.id, { cancelled: true }).catch(() => {});
                    }
                });
                interactionTail = work.catch(() => {});
                interactions.add(work);
                work.finally(() => interactions.delete(work));
            } });
        let turns = 0;
        let usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_tokens: 0 };
        let totalCost = 0;
        let maxTurnsReached = false;
        const started = Date.now();
        const before = await runtime.rpc.request('get_entries');
        // Runtime readiness is operational state, not conversation history.
        emit('agent_init', { runId, sessionId: session.engineInfo.piSessionId, tools: policy.allowedTools,
            model: session.providerConfig.model, cwd: policy.workspaceRoot, mcpServers: runtime.config.mcpNames, permissionMode: policy.permissionMode },
        { persist: false });
        for (const warning of adapted.warnings) emit('sdk_status', { runId, message: warning });
        if (recovery) emit('sdk_status', { runId, message: '旧会话将通过上下文摘要恢复；原始历史已备份，未进行无损转换。' });
        try {
            const result = await this.manager.prompt(session.id, { message: redactText(blocks.filter(block => block.type === 'text').map(block => block.text).join('\n\n'), secrets),
                images, timeoutMs: options.requestTimeoutMs || options.providerTimeoutMs || 20 * 60_000, signal: controller.signal,
                onEvent: record => {
                    adapter.handle(record);
                    if (record.type === 'extension_ui_request' && record.message === 'PROTA_PI_MAX_TURNS') maxTurnsReached = true;
                    if (record.type === 'turn_end') turns++;
                    if (record.type === 'message_end' && record.message?.role === 'assistant') {
                        usage.input_tokens += record.message.usage?.input || 0;
                        usage.output_tokens += record.message.usage?.output || 0;
                        usage.cache_read_input_tokens += record.message.usage?.cacheRead || 0;
                        usage.cache_creation_input_tokens += record.message.usage?.cacheWrite || 0;
                        usage.total_tokens += record.message.usage?.totalTokens || 0;
                        totalCost += record.message.usage?.cost?.total || 0;
                    }
                } });
            await adapter.flush();
            await synchronizeEngineInfo(session, runtime);
            const after = await runtime.rpc.request('get_entries', before.entries.length ? { since: before.entries.at(-1).id } : {});
            const userEntry = after.entries.find(entry => entry.type === 'message' && entry.message?.role === 'user');
            session.engineInfo.runEntries ||= {};
            session.engineInfo.runEntries[runId] = { beforeLeafId: before.leafId, userEntryId: userEntry?.id, leafId: after.leafId };
            return { result: redactText((result.message?.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n'), secrets),
                num_turns: turns, usage, total_cost_usd: totalCost, duration_ms: Date.now() - started, stop_reason: result.message?.stopReason };
        } catch (error) {
            error.message = redactText(error.message, secrets);
            if (maxTurnsReached) throw Object.assign(new Error(`已达到本轮 ${options.maxTurns || 200} 次模型调用上限。`), { classification: 'max_turns' });
            throw error;
        } finally {
            signal?.removeEventListener('abort', abort);
            await fs.rm(filename, { force: true });
        }
    }

    async sessionCommand(session, operation, args = {}) {
        const methods = { tree: 'get_tree', entries: 'get_entries', forkMessages: 'get_fork_messages',
            usage: 'get_session_stats', state: 'get_state', thinkingLevels: 'get_available_thinking_levels', copy: 'get_last_assistant_text', commands: 'get_commands',
            name: 'set_session_name', thinking: 'set_thinking_level', 'auto-compact': 'set_auto_compaction' };
        if (!methods[operation]) throw new Error('Unsupported Pi session operation');
        const { runtime } = await this.ensure(session);
        if (runtime.busy) throw new Error('Pi session is busy');
        let payload = {};
        if (operation === 'name') {
            const name = String(args.value || '').trim();
            if (!name || name.length > 120) throw new Error('会话名称须为 1–120 个字符。');
            payload = { name };
        }
        if (operation === 'thinking') {
            if (!['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(args.value)) throw new Error('无效推理等级');
            const { levels } = await runtime.rpc.request('get_available_thinking_levels');
            if (!levels.includes(args.value)) throw new Error('当前模型不支持该推理等级。');
            payload = { level: args.value };
        }
        if (operation === 'auto-compact') {
            if (typeof args.enabled !== 'boolean') throw new Error('enabled 必须为布尔值');
            payload = { enabled: args.enabled };
        }
        const result = await runtime.rpc.request(methods[operation], payload);
        if (operation === 'thinking') {
            session.engineInfo.thinkingLevel = (await runtime.rpc.request('get_state')).thinkingLevel;
            session.engineInfo.thinkingTarget = JSON.stringify([session.providerConfig.provider, session.providerConfig.baseURL, session.providerConfig.model]);
        }
        if (operation === 'auto-compact') session.engineInfo.autoCompaction = args.enabled;
        if (operation === 'name') { session.title = payload.name; session.engineInfo.sessionName = payload.name; }
        return result;
    }

    async exportSession(session) {
        const { runtime, paths } = await this.ensure(session);
        if (runtime.busy) throw new Error('Pi session is busy');
        // Export into this session's private directory; paths supplied by clients are never used.
        const outputPath = path.join(paths.config, 'session-export.html');
        await runtime.rpc.request('export_html', { outputPath });
        const html = await fs.readFile(outputPath, 'utf8');
        return redactText(html, knownSecrets(runtime.config.env));
    }

    async mcpStatus(session) {
        const { runtime } = await this.ensure(session);
        if (runtime.busy) throw new Error('Pi session is busy');
        let status = null;
        const listener = event => {
            if (event.type !== 'extension_ui_request' || event.method !== 'notify') return;
            try { const value = JSON.parse(event.message); if (value.protocol === 'prota-runtime-v1') status = value; } catch {}
        };
        runtime.rpc.on('event', listener);
        try { await runtime.rpc.request('prompt', { message: '/prota-runtime-status' }); }
        finally { runtime.rpc.off('event', listener); }
        const options = session.providerConfig.sdkOptions || {};
        return Object.entries(options.mcpServers || {}).map(([name, config]) => {
            const prefix = `mcp__${name.replace(/-/g, '_')}__`;
            const tools = (status?.tools || []).filter(tool => tool.startsWith(prefix));
            const allowed = mapAllowedTools(options.allowedTools || []);
            const denied = mapAllowedTools(options.disallowedTools || []);
            const available = normalizeToolSelection(options.tools);
            const permitted = tools.filter(tool => isToolAllowed({ allowedTools: config.enabled === true ? [...allowed, `${prefix}*`] : allowed,
                disallowedTools: denied, availableTools: available }, tool));
            return { name, configured: true, enabled: config.enabled === true, connected: status ? tools.length > 0 : null,
                tools, allowedTools: permitted, approval: options.permissionMode === 'bypassPermissions' ? 'bypassed' : 'required' };
        });
    }

    async messages(session) {
        const { runtime } = await this.ensure(session);
        return (await runtime.rpc.request('get_messages')).messages;
    }

    async importLegacy(session, runtime, paths, recovery) {
        try {
            // If Gateway crashed after Pi committed the import but before the
            // Prota snapshot was saved, resume the committed native file instead
            // of importing a second copy. This only reads Pi's public file format.
            const matches = [];
            for (const name of await fs.readdir(paths.sessions)) {
                if (!name.endsWith('.jsonl')) continue;
                const filename = path.join(paths.sessions, name);
                const lines = (await fs.readFile(filename, 'utf8')).split('\n').filter(Boolean);
                if (lines.some(line => {
                    const entry = JSON.parse(line);
                    return entry.type === 'custom' && entry.customType === 'prota-migration-v1' && entry.data?.id === recovery.id;
                })) matches.push(filename);
            }
            if (matches.length > 1) throw new Error('Multiple committed legacy imports found; refusing ambiguous recovery');
            if (matches.length) await runtime.rpc.request('switch_session', { sessionPath: matches[0] });
            else {
                if (session.engineInfo.migrationStatus === 'failed'
                    && (await runtime.rpc.request('get_messages')).messages.length) {
                    // A failed native import can leave a partial branch without
                    // its commit marker. Preserve that file, then retry in a new
                    // empty native session instead of being permanently blocked.
                    const reset = await runtime.rpc.request('new_session');
                    if (reset.cancelled) throw new Error('Pi cancelled the legacy migration retry');
                }
                const filename = runtime.config.env.PROTA_PI_MIGRATION_CONFIG;
                await fs.writeFile(filename, JSON.stringify({ schemaVersion: 1, ...recovery }), { mode: 0o600 });
                try {
                    const result = await runtime.rpc.request('prompt', { message: '/prota-import-legacy-v1' });
                    if (result.disposition !== 'handled') throw new Error('Pi did not handle the native legacy import command');
                } finally { await fs.rm(filename, { force: true }); }
            }
            await synchronizeEngineInfo(session, runtime);
            if (session.engineInfo.migrationStatus !== 'converted') throw new Error('Pi did not commit the legacy migration marker');
        } catch (error) {
            session.engineInfo.migrationStatus = 'failed';
            throw error;
        }
    }

    async compact(session, customInstructions = '') {
        const { runtime } = await this.ensure(session);
        if (runtime.busy) throw new Error('Cannot compact a running session');
        const previous = (await runtime.rpc.request('get_messages')).messages.length;
        const result = await runtime.rpc.request('compact', { customInstructions }, { timeoutMs: 20 * 60_000 });
        const next = (await runtime.rpc.request('get_messages')).messages.length;
        await synchronizeEngineInfo(session, runtime);
        return { ok: true, previousMessageCount: previous, nextMessageCount: next, summary: result.summary, compactSummary: result.summary };
    }

    async clear(session) {
        await this.dispose(session.id);
        session.engineInfo = null;
        ensureEngineInfo(session);
    }

    async clone(source, target, entryId = null) {
        const { runtime } = await this.ensure(source);
        if (runtime.busy) throw new Error('Cannot fork a running session');
        if (entryId) {
            const { messages } = await runtime.rpc.request('get_fork_messages');
            if (!messages.some(message => message.entryId === entryId)) throw new Error('请选择可分叉的历史用户消息。');
        }
        const original = await runtime.rpc.request('get_state');
        if (!original.sessionFile || source.providerConfig.sdkOptions?.persistSession === false) {
            throw new Error('Cannot fork a non-persistent Pi session');
        }
        let copiedClone;
        try {
            const result = await runtime.rpc.request(entryId ? 'fork' : 'clone', entryId ? { entryId } : {});
            target.branchDraft = result.text || '';
            target.parentSession = { sessionId: source.id, entryId, mode: entryId ? 'fork' : 'clone' };
            if (result.cancelled) throw new Error('Pi session fork was cancelled');
            const cloned = await runtime.rpc.request('get_state');
            if (!cloned.sessionFile) throw new Error('Pi clone did not create a native session file');
            const paths = sessionPaths(target, this.workspaceRoot(), this.configDirectory);
            await fs.mkdir(paths.sessions, { recursive: true });
            const destination = path.join(paths.sessions, path.basename(cloned.sessionFile));
            let nativeFile = destination;
            try {
                await fs.copyFile(cloned.sessionFile, destination);
                copiedClone = cloned.sessionFile;
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                const { messages } = await runtime.rpc.request('get_messages');
                if (messages.some(message => message.role === 'user' || message.role === 'assistant')) throw error;
                // Pi intentionally persists only after the first conversation
                // message. Forking before the first user therefore has no file
                // to copy; the target's native ID is persisted on its next run.
                nativeFile = undefined;
            }
            target.engineInfo = { ...structuredClone(source.engineInfo), piSessionId: cloned.sessionId, piSessionFile: nativeFile };
        } finally {
            try { await runtime.rpc.request('switch_session', { sessionPath: original.sessionFile }); }
            finally {
                await this.dispose(source.id);
                // Pi clones into the source session directory. The target owns
                // the copied branch; remove only the redundant staging file,
                // after Pi stopped using it, to keep the source mapping unique.
                if (copiedClone && copiedClone !== original.sessionFile) {
                    const sourcePaths = sessionPaths(source, this.workspaceRoot(), this.configDirectory);
                    if (await fs.realpath(path.dirname(copiedClone)) === await fs.realpath(sourcePaths.sessions)) {
                        await fs.rm(copiedClone);
                    }
                }
            }
        }
    }

    async dispose(id) {
        await this.manager.dispose(id);
        this.configurations.delete(id);
    }

    async releaseAll() {
        await Promise.all([...this.configurations.keys()].map(id => this.dispose(id)));
    }
}
