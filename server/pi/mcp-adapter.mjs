import { createHash } from 'node:crypto';

// Serialization must redact credentials even when another field makes the
// server configuration invalid and no runtime was ever created.
export function configuredMcpSecrets(servers = {}, source = process.env) {
    const values = [];
    const add = value => {
        if (typeof value !== 'string' || !value) return;
        const resolved = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) => source[name] ?? match);
        values.push(resolved);
        const bearer = resolved.match(/^Bearer\s+(.+)$/i)?.[1];
        if (bearer) values.push(bearer);
    };
    if (!servers || typeof servers !== 'object') return values;
    for (const server of Object.values(servers)) {
        if (!server || typeof server !== 'object') continue;
        for (const value of Object.values(server.headers || {})) add(value);
        for (const [key, value] of Object.entries(server.env || {})) if (/key|token|secret|password|authorization/i.test(key)) add(value);
        add(server.oauth?.clientSecret);
    }
    return [...new Set(values)];
}

// Pi owns MCP transports, discovery and execution. This only translates the
// existing JSON configuration and keeps credential values out of mcp.json.
export function adaptMcpServers(servers = {}, source = process.env) {
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) throw new Error('mcpServers must be an object');
    const output = {};
    const env = {};
    const namespaces = new Set();
    const secretValues = [];
    function credential(value, label) {
        if (typeof value !== 'string') throw new Error(`MCP ${label} must be a string`);
        if (value.startsWith('!')) throw new Error(`MCP ${label}: command-valued credentials require an explicit Pi extension`);
        const resolved = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name) => {
            if (source[name] === undefined) throw new Error(`Missing MCP environment variable ${name}`);
            return source[name];
        });
        const variable = `PROTA_PI_MCP_${createHash('sha256').update(label).digest('hex').slice(0, 20).toUpperCase()}`;
        env[variable] = resolved;
        if (/\.headers\.|\.oauth\.|key|token|secret|password|authorization/i.test(label)) {
            secretValues.push(resolved);
            const bearer = resolved.match(/^Bearer\s+(.+)$/i)?.[1];
            if (bearer) secretValues.push(bearer);
        }
        return '${' + variable + '}';
    }
    for (const [name, original] of Object.entries(servers)) {
        const namespace = name.replace(/-/g, '_');
        if (!/^[A-Za-z0-9_-]+$/.test(name) || namespaces.has(namespace)) throw new Error(`Invalid or duplicate MCP server name: ${name}`);
        namespaces.add(namespace);
        if (!original || typeof original !== 'object' || Array.isArray(original)) throw new Error(`Invalid MCP server: ${name}`);
        const config = structuredClone(original);
        const allowed = new Set(['type', 'command', 'args', 'env', 'cwd', 'url', 'headers', 'oauth', 'enabled', 'timeout', 'description']);
        for (const key of Object.keys(config)) if (!allowed.has(key)) throw new Error(`Unsupported MCP field ${name}.${key}`);
        if (config.type && !['stdio', 'http', 'streamable-http'].includes(config.type)) throw new Error(`Unsupported MCP transport: ${config.type}`);
        const stdio = typeof config.command === 'string' && !!config.command;
        const http = typeof config.url === 'string' && !!config.url;
        if (stdio === http || (config.type === 'stdio' && !stdio) || (config.type && config.type !== 'stdio' && !http)) throw new Error(`MCP ${name} must declare exactly one matching transport`);
        if (config.args && (!Array.isArray(config.args) || config.args.some(value => typeof value !== 'string'))) throw new Error(`MCP ${name}.args must be strings`);
        if (config.cwd !== undefined && typeof config.cwd !== 'string') throw new Error(`MCP ${name}.cwd must be a string`);
        if (config.enabled !== undefined && typeof config.enabled !== 'boolean') throw new Error(`MCP ${name}.enabled must be boolean`);
        if (config.timeout !== undefined && (!Number.isFinite(config.timeout) || config.timeout <= 0)) throw new Error(`MCP ${name}.timeout must be positive`);
        if (http) {
            const url = new URL(config.url);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`MCP ${name} URL must be HTTP(S) without inline credentials`);
        }
        for (const field of ['env', 'headers']) if (config[field] !== undefined) {
            if (!config[field] || typeof config[field] !== 'object' || Array.isArray(config[field])) throw new Error(`MCP ${name}.${field} must be an object`);
            config[field] = Object.fromEntries(Object.entries(config[field]).map(([key, value]) => [key, credential(value, `${name}.${field}.${key}`)]));
        }
        if (config.oauth !== undefined) {
            if (!http || !config.oauth || typeof config.oauth !== 'object' || Array.isArray(config.oauth)) throw new Error(`MCP ${name}.oauth requires an HTTP server`);
            const oauthFields = new Set(['clientId', 'clientSecret', 'callbackPort', 'callbackUrl', 'scope', 'clientName', 'clientRegistration', 'authServerMetadataUrl']);
            for (const key of Object.keys(config.oauth)) if (!oauthFields.has(key)) throw new Error(`Unsupported MCP OAuth field ${key}`);
            if (config.oauth.clientSecret !== undefined) config.oauth.clientSecret = credential(config.oauth.clientSecret, `${name}.oauth.clientSecret`);
        }
        output[name] = { ...config, exposure: 'direct' };
    }
    return { config: { mcpServers: output, autoEnableCodemode: false }, env, secretValues,
        names: Object.entries(output).filter(([, config]) => config.enabled !== false).map(([name]) => name) };
}
