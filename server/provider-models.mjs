// Model discovery is independent of the inference protocol: compatibility
// gateways frequently expose their catalog outside their /anthropic prefix.
const COMPAT_SUFFIXES = ['/api/claudecode', '/api/anthropic', '/apps/anthropic', '/api/coding', '/claudecode', '/anthropic', '/step_plan', '/coding', '/claude'];

export function modelEndpoints(config, preset = {}) {
    const base = new URL(config.baseURL);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
        throw new Error('Base URL 必须是 HTTP(S) 服务地址，不能包含账号、查询参数或片段');
    }
    const path = base.pathname.replace(/\/+$/, '').replace(/\/(chat\/completions|messages|responses)$/, '');
    const paths = [];
    if (/(^|\.)xiaomimimo\.com$/.test(base.hostname)) paths.push('/v1/models');
    // A preset override only applies to its original host and path. Never send
    // a custom gateway's key to the preset's official server.
    if (preset.modelsPath && config.baseURL.replace(/\/+$/, '') === preset.baseURL?.replace(/\/+$/, '')) {
        paths.push(preset.modelsPath);
    }
    paths.push(`${path}${/\/v\d+(?:beta\d*)?$/.test(path) ? '' : '/v1'}/models`);
    paths.push(`${path}/models`);
    const suffix = COMPAT_SUFFIXES.find(value => path.endsWith(value));
    if (suffix) {
        const root = path.slice(0, -suffix.length);
        paths.push(`${root}/v1/models`, `${root}/models`);
    }
    return [...new Set(paths)].map(value => {
        const url = new URL(value, base.origin);
        if (url.origin !== base.origin) throw new Error('模型列表接口必须与 Base URL 同源');
        return url.href;
    });
}

export async function discoverProviderModels(config, preset = {}, fetchImpl = fetch) {
    const startedAt = Date.now();
    const fail = (message, httpStatus = null) => ({ ok: false, models: [], httpStatus, latencyMs: Date.now() - startedAt, message });
    if (!config.apiKey || !config.baseURL) return fail('请先填写 Base URL 和 API Key');
    try {
        const endpoints = modelEndpoints(config, preset);
        const headers = { Accept: 'application/json' };
        if (config.apiType === 'anthropic-messages') {
            headers['x-api-key'] = config.apiKey;
            headers['anthropic-version'] = '2023-06-01';
        }
        if (new URL(config.baseURL).hostname !== 'api.anthropic.com') headers.Authorization = `Bearer ${config.apiKey}`;
        if (/(^|\.)xiaomimimo\.com$/.test(new URL(config.baseURL).hostname)) {
            headers['api-key'] = config.apiKey;
            delete headers.Authorization;
            delete headers['x-api-key'];
        }
        const signal = AbortSignal.timeout(30000);
        for (const endpoint of endpoints) {
            let next = endpoint;
            const models = new Set();
            const cursors = new Set();
            for (let page = 0; page < 50; page++) {
                const response = await fetchImpl(next, { headers, signal, redirect: 'error' });
                if ([404, 405].includes(response.status) && page === 0) break;
                if (!response.ok) {
                    const message = [401, 403].includes(response.status) ? '模型列表鉴权失败，请检查 Key 和套餐权限'
                        : response.status === 429 ? '模型列表请求过于频繁，请稍后重试'
                        : `模型列表接口返回 HTTP ${response.status}`;
                    return fail(message, response.status);
                }
                let body;
                try { body = await response.json(); } catch { return fail('接口未返回 JSON 模型列表，请检查 Base URL'); }
                const entries = Array.isArray(body) ? body : body?.data ?? body?.models;
                if (!Array.isArray(entries)) return fail('接口返回格式不支持模型列表，请手动输入模型 ID');
                for (const entry of entries) {
                    const id = typeof entry === 'string' ? entry : entry?.id || entry?.name || entry?.model;
                    if (typeof id === 'string' && id.trim()) models.add(id.trim());
                }
                if (!body.has_more) return {
                    ok: true, models: [...models].sort((a, b) => a.localeCompare(b)),
                    endpoint, fetchedAt: new Date().toISOString(), httpStatus: response.status,
                    latencyMs: Date.now() - startedAt,
                    message: models.size ? `已从服务商获取 ${models.size} 个模型` : '接口未返回可用模型，请检查账号权限或手动输入模型 ID'
                };
                if (!body.last_id || cursors.has(body.last_id)) return fail('模型列表分页异常，请稍后重试');
                cursors.add(body.last_id);
                const url = new URL(endpoint);
                url.searchParams.set('after_id', body.last_id);
                next = url.href;
            }
            if (models.size) return fail('模型列表分页超过上限，请缩小服务商模型范围');
        }
        return fail('服务商未开放可访问的模型列表接口（404/405），可保留模板模型或手动输入模型 ID', 404);
    } catch (error) {
        return fail(error?.name === 'TimeoutError' ? '拉取模型超时，请稍后重试' : '无法连接模型列表接口，请检查地址与网络');
    }
}
