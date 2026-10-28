import fs from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { evaluateTool, validatePolicy, isToolAllowed } from '../../server/pi/tool-policy.mjs';
import { encodeInteraction } from '../../server/pi/ui-protocol.mjs';
import { knownSecrets, redactSecrets } from '../../server/pi/secrets.mjs';

export default function protaExtension(pi: ExtensionAPI) {
    const secrets = knownSecrets();
    let policy: ReturnType<typeof validatePolicy> | null = null;
    const grants = new Set<string>();
    let turns = 0;
    pi.registerCommand('prota-runtime-status', {
        description: 'Inspect Prota runtime integration protocol version',
        handler: async (_args, ctx) => {
            ctx.ui.notify(JSON.stringify({ protocol: 'prota-runtime-v1', activeRunId: policy?.runId || null }), 'info');
        }
    });
    pi.registerCommand('prota-import-legacy-v1', {
        description: 'Import a validated Prota legacy transcript using Pi native Session storage',
        handler: async (_args, ctx) => {
            const filename = process.env.PROTA_PI_MIGRATION_CONFIG;
            if (!filename) throw new Error('No Prota migration file is configured');
            const migration = JSON.parse(fs.readFileSync(filename, 'utf8'));
            if (migration.schemaVersion !== 1 || !/^prota-legacy-v1-[a-zA-Z0-9._-]+$/.test(migration.id)
                || !Array.isArray(migration.messages) || !migration.messages.length
                || migration.messages.some((message: { role?: string }) => !['user', 'assistant', 'toolResult'].includes(message.role || ''))) {
                throw new Error('Invalid Prota legacy import');
            }
            if (ctx.sessionManager.getBranch().some(entry => entry.type === 'message')) {
                throw new Error('Legacy import requires an empty native session');
            }
            // Pi creates, persists and refreshes the new session. Do not write
            // native Session JSONL ourselves or use a captured ctx after replacement.
            const result = await ctx.newSession({ setup: async manager => {
                for (const message of migration.messages) manager.appendMessage(message);
                manager.appendCustomEntry('prota-migration-v1', { id: migration.id, version: 1,
                    status: 'converted', notes: migration.notes || [] });
            } });
            if (result.cancelled) throw new Error('Pi cancelled legacy import');
        }
    });
    pi.on('session_start', async (_event, ctx) => {
        grants.clear();
        for (const entry of ctx.sessionManager.getBranch()) {
            if (entry.type === 'custom' && entry.customType === 'prota-permission-v1') {
                const data = entry.data as { grantKey?: string } | undefined;
                if (typeof data?.grantKey === 'string') grants.add(data.grantKey);
            }
        }
    });
    pi.on('before_agent_start', (event, ctx) => {
        policy = null;
        turns = 0;
        const filename = process.env.PROTA_PI_RUN_CONFIG;
        if (!filename) throw new Error('Missing Prota Pi run policy');
        policy = validatePolicy(JSON.parse(fs.readFileSync(filename, 'utf8')));
        const activeTools = pi.getAllTools().map(tool => tool.name).filter(name => isToolAllowed(policy, name));
        pi.setActiveTools(activeTools);
        event.systemPromptOptions.selectedTools = activeTools;
        event.systemPromptOptions.sections.prota_context = String(policy.systemContext || '');
        const recovery = policy.legacyRecovery;
        if (recovery && !ctx.sessionManager.getBranch().some(entry => entry.type === 'custom_message' && entry.customType === recovery.id)) {
            return { message: { customType: recovery.id, content: recovery.content, display: false } };
        }
    });
    pi.on('before_provider_request', event => {
        // Reuse Prota's verified provider-specific reasoning fields through the
        // public payload hook. Pi still owns requests, streaming and retries.
        if (!policy?.reasoningBody || !event.payload || typeof event.payload !== 'object') return;
        const payload = event.payload as Record<string, unknown>;
        const fields = policy.reasoningBody as Record<string, unknown>;
        const next = { ...payload, ...fields };
        if (fields.output_config && typeof fields.output_config === 'object') {
            next.output_config = { ...(payload.output_config as Record<string, unknown> || {}), ...fields.output_config };
        }
        return next;
    });
    pi.on('tool_call', async (event, ctx) => {
        if (!policy) return { block: true, reason: 'No valid Prota run policy is active' };
        const decision = evaluateTool(policy, event.toolName, event.input, grants);
        if (decision.action === 'deny') return { block: true, reason: decision.reason };
        if (decision.action === 'allow') return;
        const title = encodeInteraction({ kind: 'approval', runId: policy.runId,
            toolName: event.toolName, input: event.input });
        const answer = await ctx.ui.select(title, ['allow_once', 'allow_session', 'deny'], { timeout: 10 * 60_000 });
        if (answer === 'allow_session') {
            grants.add(decision.grantKey);
            pi.appendEntry('prota-permission-v1', { grantKey: decision.grantKey });
        } else if (answer !== 'allow_once') return { block: true, reason: 'Tool execution was denied or approval expired' };
    });
    pi.on('tool_result', event => {
        if (!policy) return { content: [{ type: 'text', text: 'Prota run policy is no longer active' }], isError: true };
        // Official result replacement happens before model context and native
        // Session persistence. Keep image data and result structure intact.
        return { content: redactSecrets(event.content, secrets), details: redactSecrets(event.details, secrets),
            ...(event.structuredContent === undefined ? {} : { structuredContent: redactSecrets(event.structuredContent, secrets) }) };
    });
    pi.on('message_end', event => ({ message: redactSecrets(event.message, secrets) }));
    pi.on('turn_start', (_event, ctx) => {
        turns++;
        if (policy?.maxTurns && turns > policy.maxTurns) {
            ctx.ui.notify('PROTA_PI_MAX_TURNS', 'error');
            // Abort without waiting for this event handler to finish the same run.
            void ctx.abort();
        }
    });
    pi.on('turn_end', event => {
        if (event.message.role === 'assistant') {
            pi.appendEntry('prota-usage-v1', { runId: policy?.runId, turn: turns, usage: event.message.usage });
        }
    });
    pi.on('agent_settled', () => { policy = null; });
    pi.registerTool({
        name: 'ask_user', label: 'Ask user', description: 'Ask the user a question and wait for their answer.',
        parameters: Type.Object({ question: Type.String(), options: Type.Optional(Type.Array(Type.String())),
            allowFreeText: Type.Optional(Type.Boolean()) }),
        async execute(_id, input, _signal, _onUpdate, ctx) {
            if (!policy) throw new Error('No Prota run policy is active');
            const title = encodeInteraction({ kind: 'question', runId: policy.runId, question: input.question,
                options: input.options || [], allowFreeText: input.allowFreeText !== false });
            let answer: string | undefined;
            if (input.options?.length) {
                const freeText = '__prota_free_text_v1__';
                answer = await ctx.ui.select(title, input.allowFreeText === false ? input.options : [...input.options, freeText], { timeout: 10 * 60_000 });
                if (answer === freeText) answer = await ctx.ui.input(title, '', { timeout: 10 * 60_000 });
            } else answer = await ctx.ui.input(title, '', { timeout: 10 * 60_000 });
            if (answer === undefined) throw new Error('Question cancelled or expired');
            return { content: [{ type: 'text', text: answer }], details: { answered: true } };
        }
    });
}
