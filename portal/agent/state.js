const AgentState = {
    createDefaultRunState({ hasSession = false } = {}) {
        return {
            status: hasSession ? 'ready' : 'disconnected',
            active: false,
            runId: null,
            descriptor: null,
            currentTool: null,
            startedAt: null,
            finishedAt: null,
            lastActivityAt: null,
            stageMessage: hasSession ? '已连接，等待新的任务。' : '请先配置 Provider 并测试连接。',
            sdkStatusMessage: '',
            lastError: null,
            lastSummary: null,
            lastDescriptor: null
        };
    },

    isTerminal(runState) {
        return !runState?.active;
    }
};

window.AgentState = AgentState;
