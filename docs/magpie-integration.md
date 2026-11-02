# Magpie integration

Prota treats Magpie as one local provider. The standalone plugin is maintained in
[lefinite/magpie-agent-prota](https://github.com/lefinite/magpie-agent-prota); it is installed separately and is not copied into Prota's source or business workspace.

## 使用

1. 更新 Prota 后重启本地服务与页面，保持 Magpie 运行。
2. 安装或更新 Prota 专用插件：`magpie plugin add github:lefinite/magpie-agent-prota`。
3. 在 Magpie 的 Agents → Prota 中选择默认模型。
4. Prota 设置 → 模型配置 → 我的服务商 → Magpie → 使用 Magpie。
5. 输入框模型菜单可以选择「跟随 Magpie」，或搜索并固定本会话的模型。

Magpie 默认模型只由 Magpie 修改。固定会话不反写默认模型。外部变更会在空闲后应用；任务运行时保留当前模型，只记录最新待应用值。切回普通服务商会退出当前会话的 Magpie 绑定。

Magpie 的“没有原来的模型，改用…”提示是接入时选定其目录中的模型，不表示 Prota 运行已经切换。以 Prota 的会话模型按钮和后端确认状态为准。Magpie 显示的其他 Agent 安装命令无需执行。

## Contract and security

The fixed anchor is `~/.config/prota/magpie-agent.json`, even when `READIFY_CONFIG_DIR` points elsewhere. Magpie writes `model`, `managedBy`, `provider`, `apiType`, `baseURL`, `apiKey`; Prota reads it, validates the schema and loopback HTTP origin, verifies `/api/hello`, and fetches `/v1/models` using the agent-specific gateway key. Redirects, remote origins, oversized files/responses and symlink escapes are rejected. On POSIX, Prota tightens a validated, owned config inode to `0600` because the tested Magpie host creates it as `0644`; Prota never rewrites its values.

`integration:magpie` is a protected singleton. The ordinary provider store persists no Magpie model, endpoint or key. The gateway keeps its key in memory and the existing isolated Pi environment, not in history, status, SSE or browser storage. Session snapshots persist `providerBinding`, `bindingRevision`, `effectiveModel`; each `run_started` stores its immutable `runModelSnapshot`.

Model changes use a synchronous per-session reservation, a candidate Pi configuration and `get_state` confirmation. State commits only after runtime readiness, and rolls back on failure. Running tasks and pending approvals/questions block user switches. A following session is reconciled at idle boundaries; pinned sessions keep their exact ID. Missing models, damaged config, plugin disconnects and offline gateways block new runs. No direct provider or paid fallback is selected automatically. The Magpie gateway's own routing/fallback settings remain owned by Magpie.

Only declared catalog capabilities are exposed. Responses, Messages and Chat native endpoints are preferred in that order; groups/unknown native endpoints use Magpie's Responses translation. Unknown image input and context limits remain unknown. Pi-supported reasoning values are `off/minimal/low/medium/high/xhigh/max`; Magpie-only values such as `ultra` are omitted. An incompatible previous effort resets to default. Prota's tools, prompts, MCP and permissions stay in the existing Pi chain.

## APIs

- `GET /api/agent/magpie/status`, `/models`, `/events`, `/quotas`
- `POST /api/agent/magpie/refresh`
- `GET|POST /api/agent/session/:id/model-binding`

Binding POST requires `expectedRevision` and `{kind:"magpie",policy:"follow"|"pinned",pinnedModelId?,reasoningEffort?}` or `{kind:"direct",providerId,providerConfig}`. Busy/conflicting requests return 409, unavailable models 422, disconnection/runtime errors 503. The existing direct-provider API uses the same transaction; the legacy model endpoint cannot bypass Magpie binding. Magpie APIs accept only local requests and reject untrusted web origins.

Status uses a watched file plus one-second reconciliation, a 20-second catalog cache and SSE. The Portal also polls the lightweight current session binding every two seconds while visible and refreshes immediately on return to the foreground. Errors and pending states do not overwrite historical run identities. A late response for a previously selected session is discarded.

## Validation

```sh
npm run magpie:test
node tests/magpie-ui.browser.mjs
npm run agent:test
node tests/pi-ui.browser.mjs
node --test tests/agent-provider-config.test.mjs tests/provider-models.test.mjs tests/provider-reasoning.test.mjs
python3 -m unittest tests.test_agent_provider_persistence
npm run pi:verify
```

Ordinary tests use temporary workspaces, fake gateway/model fixtures and the real bundled Pi runtime. Live tests are explicitly opt-in and consume the selected model's allowance:

```sh
PROTA_MAGPIE_LIVE=1 node --test tests/magpie-live.test.mjs
```

Validated on 2026-11-02:

- Existing Pi suite: 84 tests passed; existing Portal approval/question/reload/fork browser workflow passed.
- Magpie fixture suites: file safety, capabilities, follow/pinned, latest-only pending changes, transaction failure, tool write/read loop, restart restoration, removed models, corrupt config and no provider fallback passed.
- Magpie Portal browser workflow: singleton detail panel, follow, pinned/search, per-session reasoning, failed-switch rollback and direct-provider switch passed.
- Live local Magpie + `codex/gpt-6.1-sol` + Responses: image input, file read/write tools and a subsequent edit turn passed. The test used a temporary workspace and did not change Magpie's selected model, plugin settings or subscription accounts.

Other subscriptions, remote gateways, every routing-group strategy and all cross-provider protocol translations were not live-tested. Anthropic/Chat selection is covered by fixtures and standalone plugin host tests. Quotas are optional: unavailable/unauthorized responses are displayed as such rather than converted into a fabricated balance. The live test is skipped in ordinary CI with an explicit reason.
