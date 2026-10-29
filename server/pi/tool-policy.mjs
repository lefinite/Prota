import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const aliases = { Read: 'read', Write: 'write', Edit: 'edit', Glob: 'find', Grep: 'grep',
    Bash: process.platform === 'win32' ? 'powershell' : 'bash', AskUserQuestion: 'ask_user', Skill: 'read' };
const supported = new Set(['read', 'write', 'edit', 'find', 'grep', 'ls', 'bash', 'powershell', 'ask_user']);
const modes = new Set(['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan']);

export function mapAllowedTools(names = []) {
    if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) throw new Error('Pi tool names must be a string array; custom tool handlers require a Pi Extension');
    const mapped = names.map(name => aliases[name] || name);
    const unknown = mapped.filter(name => !supported.has(name) && !/^mcp__[A-Za-z0-9_*]+__[A-Za-z0-9_*]+$/.test(name));
    if (unknown.length) throw new Error(`Unsupported Pi tools: ${unknown.join(', ')}`);
    return [...new Set(mapped)];
}

export function normalizeToolSelection(option) {
    if (option === undefined || option === null) return undefined;
    if (Array.isArray(option)) return mapAllowedTools(option);
    if (option && option.type === 'preset' && option.preset === 'default'
        && Object.keys(option).every(key => ['type', 'preset'].includes(key))) return undefined;
    throw new Error('Unsupported Agent tools configuration; use tool names, the default preset, or migrate custom handlers to a Pi Extension');
}

export function toolMatches(pattern, name) {
    return pattern === name || (pattern.startsWith('mcp__')
        && new RegExp(`^${pattern.split('*').join('[A-Za-z0-9_]*')}$`).test(name));
}

export function isToolAllowed(policy, name) {
    return policy.allowedTools.some(pattern => toolMatches(pattern, name))
        && (!policy.availableTools || policy.availableTools.some(pattern => toolMatches(pattern, name)))
        && !(policy.disallowedTools || []).some(pattern => toolMatches(pattern, name));
}

function inside(root, target) {
    const relative = path.relative(root, target);
    return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// Resolve existing ancestors as well as the final path, so a symlink cannot
// turn an apparently workspace-local write into an external write.
function physicalPath(target) {
    let current = path.resolve(target);
    const missing = [];
    while (!fs.existsSync(current)) {
        const parent = path.dirname(current);
        if (parent === current) throw new Error('Cannot resolve file path');
        // A dangling symlink must not be treated as a new ordinary file.
        try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Dangling symlink is not allowed'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        missing.unshift(path.basename(current));
        current = parent;
    }
    return path.join(fs.realpathSync(current), ...missing);
}

export function validatePolicy(policy) {
    if (policy?.schemaVersion !== 1 || !policy.runId || !path.isAbsolute(policy.workspaceRoot || '')) {
        throw new Error('Invalid Prota Pi run policy');
    }
    if (!modes.has(policy.permissionMode || 'default')) throw new Error('Unknown permission mode');
    const allowedTools = mapAllowedTools(policy.allowedTools);
    return { ...policy, allowedTools, availableTools: normalizeToolSelection(policy.availableTools),
        disallowedTools: mapAllowedTools(policy.disallowedTools || []), permissionMode: policy.permissionMode || 'default' };
}

export function evaluateTool(policy, toolName, input = {}, grants = new Set()) {
    if (!isToolAllowed(policy, toolName)) return { action: 'deny', reason: 'Tool is not allowed for this run' };
    const edits = toolName === 'write' || toolName === 'edit';
    const shell = toolName === 'bash' || toolName === 'powershell';
    const remote = toolName.startsWith('mcp__');
    let target = '';
    if (!shell && !remote && toolName !== 'ask_user') {
        try {
            target = physicalPath(path.resolve(policy.workspaceRoot, input.path || '.'));
            const roots = edits ? [policy.workspaceRoot] : [policy.workspaceRoot, ...(policy.readRoots || [])];
            if (!roots.some(root => inside(physicalPath(root), target))) return { action: 'deny', reason: 'File path is outside the allowed workspace' };
            if (target.split(path.sep).some(part => /^(?:\.env(?:\..*)?|auth\.json|agent-provider-config\.json|\.ssh|\.aws|pi-runtime|pi-sessions|agent-sessions)$/i.test(part))) {
                return { action: 'deny', reason: 'Sensitive configuration and session files are not ordinary task files' };
            }
        } catch (error) { return { action: 'deny', reason: error.message }; }
    }
    // Match Prota's existing "always allow for this session" behavior: a grant
    // covers the tool, while the whitelist and file boundary still apply first.
    // Bind it to the product session so a native fork cannot inherit approval.
    const grantKey = createHash('sha256').update(JSON.stringify([policy.sessionId || 'runtime', policy.workspaceRoot, toolName])).digest('hex');
    if (!edits && !shell && !remote) return { action: 'allow', grantKey };
    if (grants.has(grantKey) || policy.permissionMode === 'bypassPermissions'
        || (edits && policy.permissionMode === 'acceptEdits')) return { action: 'allow', grantKey };
    if (policy.permissionMode === 'dontAsk') return { action: 'deny', reason: 'dontAsk denies high-risk operations without a prior grant', grantKey };
    // Existing Prota plan mode behaves as default; keep that behavior explicitly.
    return { action: 'ask', grantKey };
}
