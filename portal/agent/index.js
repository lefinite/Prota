window.ReadifyAgent = {
    ApiClient: window.AgentApiClient,
    Events: window.AgentEvents,
    ProviderConfigStore: window.AgentProviderConfigStore,
    RunRoutes: window.AgentRunRoutes,
    State: window.AgentState,
    constants: {
        statusCopy: typeof AGENT_STATUS_COPY === 'undefined' ? {} : AGENT_STATUS_COPY,
        activityCopy: typeof AGENT_ACTIVITY_COPY === 'undefined' ? {} : AGENT_ACTIVITY_COPY,
        skillFallback: typeof AGENT_SKILL_FALLBACK === 'undefined' ? [] : AGENT_SKILL_FALLBACK,
        commandFallback: typeof AGENT_COMMAND_FALLBACK === 'undefined' ? [] : AGENT_COMMAND_FALLBACK,
        providerPresetFallback: typeof AGENT_PROVIDER_PRESET_FALLBACK === 'undefined' ? { defaultProvider: '', providers: [] } : AGENT_PROVIDER_PRESET_FALLBACK
    }
};
