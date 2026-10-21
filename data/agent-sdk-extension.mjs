/**
 * Optional Prota bridge for @codeany/open-agent-sdk features that cannot be
 * represented as JSON in the UI, such as custom ToolDefinition handlers,
 * SDK MCP servers, hooks, subagents, and canUseTool callbacks.
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
