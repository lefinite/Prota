class AgentApiClient {
    constructor({ baseURL = 'http://127.0.0.1:8081' } = {}) {
        this.baseURL = baseURL.replace(/\/$/, '');
    }

    url(path) {
        return `${this.baseURL}${path}`;
    }

    async request(path, { method = 'GET', body, signal, stream = false } = {}) {
        const response = await fetch(this.url(path), {
            method,
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal
        });

        if (stream) {
            if (!response.ok || !response.body) {
                throw new Error(await this.readError(response, 'Agent Gateway 请求失败'));
            }
            return response;
        }

        if (!response.ok) {
            throw new Error(await this.readError(response, 'Agent Gateway 请求失败'));
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    async readError(response, fallback) {
        const text = await response.text().catch(() => '');
        if (!text) return fallback;
        try {
            const parsed = JSON.parse(text);
            return parsed.reason || parsed.message || text;
        } catch {
            return text;
        }
    }

    getSkills({ includeDisabled = false } = {}) {
        return this.request(`/api/agent/skills${includeDisabled ? '?includeDisabled=1' : ''}`);
    }

    setSkillStatus(skillId, enabled) {
        return this.request(`/api/agent/skills/${encodeURIComponent(skillId)}/status`, {
            method: 'POST',
            body: { enabled }
        });
    }

    getSkillDetail(skillId) {
        return this.request(`/api/agent/skills/${encodeURIComponent(skillId)}/detail`);
    }

    getCommands() {
        return this.request('/api/agent/commands');
    }

    getSdkInfo() {
        return this.request('/api/agent/sdk');
    }

    listSessions({ limit = 30, cursor = '', query = '' } = {}) {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        if (query) params.set('query', query);
        return this.request(`/api/agent/sessions?${params.toString()}`);
    }

    getSessionHistory(sessionId) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/history`);
    }

    createSession(payload) {
        return this.request('/api/agent/session', {
            method: 'POST',
            body: payload
        });
    }

    archiveSession(sessionId, payload = {}) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/archive`, {
            method: 'POST',
            body: payload
        });
    }

    deleteSession(sessionId) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}`, {
            method: 'DELETE'
        });
    }

    openSessionStream(sessionId, { signal } = {}) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/stream`, {
            signal,
            stream: true
        });
    }

    clearSdkConversation(sessionId) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/sdk/clear`, {
            method: 'POST'
        });
    }

    setContext(sessionId, contextPayload) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/set-context`, {
            method: 'POST',
            body: contextPayload
        });
    }

    setModel(sessionId, model) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/sdk/set-model`, {
            method: 'POST',
            body: { model }
        });
    }

    setProvider(sessionId, providerConfig) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/sdk/set-provider`, {
            method: 'POST',
            body: { providerConfig }
        });
    }

    setPermissionMode(sessionId, permissionMode) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/sdk/set-permission-mode`, {
            method: 'POST',
            body: { permissionMode }
        });
    }

    interrupt(sessionId) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/interrupt`, {
            method: 'POST'
        });
    }

    getRunChanges(sessionId, runId) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}/changes`);
    }

    rollbackRun(sessionId, runId, payload = {}) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}/rollback`, {
            method: 'POST',
            body: payload
        });
    }

    resolveApproval(sessionId, approvalId, decision) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/approvals/${encodeURIComponent(approvalId)}`, {
            method: 'POST',
            body: { decision }
        });
    }

    answerQuestion(sessionId, questionId, answer) {
        return this.request(`/api/agent/session/${encodeURIComponent(sessionId)}/questions/${encodeURIComponent(questionId)}`, {
            method: 'POST',
            body: { answer }
        });
    }

    startRunByPath(path, payload, { signal } = {}) {
        return this.request(path, {
            method: 'POST',
            body: payload,
            signal,
            stream: true
        });
    }

    testConnection(providerConfig) {
        return this.request('/api/agent/test-connection', {
            method: 'POST',
            body: { providerConfig }
        });
    }

    fetchModels(providerConfig) {
        return this.request('/api/agent/fetch-models', {
            method: 'POST',
            body: { providerConfig }
        });
    }

    getBalance(providerConfig) {
        return this.request('/api/agent/get-balance', {
            method: 'POST',
            body: { providerConfig }
        });
    }
}

window.AgentApiClient = AgentApiClient;
