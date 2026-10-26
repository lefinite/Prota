# Agent 思考强度

核实日期：2026-10-23。

Plan 是先规划、等待批准再执行的工作流；思考强度是模型推理参数，两者独立。按产品要求移除 composer 的 Plan 开关、系统提示注入和遗留 permissionMode=plan；其他权限保持原值。

当前保存的配置：

| 模型 | 可选控制 | 默认 |
| --- | --- | --- |
| GLM-5.3 / GLM-5.3-Flash | low / high / max | max，不能关闭思考 |
| MiMo-V2.5-Pro | enabled / disabled | enabled，不区分强度 |

界面默认不覆盖服务商策略。GLM 只显示低／高／最高三项；MiMo 只显示开启／关闭两项。已知默认值直接显示默认标签，避免重复的默认选项。配置分别保存于各供应商实例 sdkOptions.reasoningEffort。非法、过期或不适用的选项回退到模型默认；不因兼容协议名称就假定未知模型/网关支持参数。模板和业务工作区元数据无须更改。

实现：portal/agent/reasoning.js 同时供前端和服务端使用；server/provider-reasoning.mjs 适配 SDK 0.2.1 的实例请求。此 SDK 类型虽声明 effort，agent/engine/provider 实际未透传。Anthropic 请求在 messages.create 层附加字段；OpenAI 请求复用 SDK 的消息、工具和响应转换，保留 reasoning_content 供多轮工具调用继续使用。没有修改 node_modules 或全局 fetch。

已核实的其他官方端点保守接入 DeepSeek、Kimi Coding、MiniMax-M3.1-Flash、Claude 5.5/Fable 5.1，以及部分 OpenAI reasoning 型号。没有泛化到所有模板型号或自定义网关。GLM 使用文档给出的 thinking.type=enabled 与 reasoning_effort，Anthropic effort 型接口使用 output_config.effort；MiMo 只传 thinking.type。保留模型默认时不增加请求字段。

交互：紧凑按钮显示当前选择；上弹菜单只保留档位、默认标签和勾选；用途说明收进 tooltip。支持方向键、Home/End、Escape、Tab、外部点击关闭，定时刷新保留菜单焦点。菜单按视口调整位置和高度；执行中与保存中禁止切换，失败恢复原值。成功不弹 toast。

验证：node --test tests/provider-reasoning.test.mjs tests/agent-provider-config.test.mjs tests/provider-models.test.mjs tests/agent-provider-create-mode.test.mjs；python3 -m unittest tests/test_agent_provider_persistence.py；node tests/agent-reasoning.browser.mjs；npm run agent:check。请求字段由真实 SDK + mock 服务验证；未使用用户凭证发送付费生成请求。兼容服务的线上行为仍取决于实际接口实现。

来源：

- Plan 工作流：https://developers.openai.com/blog/mastering-codex-remote-for-engineering
- OpenAI reasoning 参数：https://developers.openai.com/api/docs/guides/reasoning
- GLM-5.3：https://docs.z.ai/guides/llm/glm-5.3
- GLM-5.3 / Flash 官方仓库：https://github.com/zai-org/GLM-5
- MiMo 深度思考（含 V2.5-Pro）：https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking
- MiMo Anthropic：https://mimo.mi.com/docs/en-US/api/chat/anthropic-api
- DeepSeek：https://api-docs.deepseek.com/guides/thinking_mode/
- Kimi Coding：https://www.kimi.com/code/docs/en/kimi-code/models
- Claude：https://platform.claude.com/docs/en/build-with-claude/effort
- MiniMax：https://platform.minimax.io/docs/api-reference/text-anthropic-api
