/**
 * Legacy configuration entry point retained for existing Prota installs.
 * JSON options and MCP servers are translated by the Pi adapter. Custom tool
 * handlers, hooks and permission callbacks must use the official Pi Extension
 * API in integrations/pi/prota-extension.ts.
 */

export const options = {};

export const createAgentOptions = {};

export const queryOptions = {};

export const tools = [];

export const mcpServers = {};

export const agents = {};

export const hooks = {};

export async function canUseTool() {
    return null;
}
canUseTool.protaPlaceholder = true;

export default {
    options,
    createAgentOptions,
    queryOptions,
    tools,
    mcpServers,
    agents,
    hooks,
    canUseTool
};
