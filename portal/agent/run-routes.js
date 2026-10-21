const AgentRunRoutes = {
    pathFor(sessionId, kind, payload = {}) {
        const encodedSessionId = encodeURIComponent(sessionId);
        if (kind === 'dev-simulate') {
            return `/api/agent/session/${encodedSessionId}/actions/dev-simulate`;
        }
        if (kind === 'skill') {
            return `/api/agent/session/${encodedSessionId}/skills/${encodeURIComponent(payload.skillId)}/run`;
        }
        if (kind === 'command') {
            return `/api/agent/session/${encodedSessionId}/commands/${encodeURIComponent(payload.commandId)}/run`;
        }
        return `/api/agent/session/${encodedSessionId}/message`;
    }
};

window.AgentRunRoutes = AgentRunRoutes;
