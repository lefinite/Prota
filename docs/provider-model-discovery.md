# 服务商模板与模型列表

更新日期：2026-10-21。

服务商模板维护地址、协议和初始模型目录；它不是在线权限清单。已有配置的模型、Key、地址不随模板更新而覆盖。通用 OpenAI 兼容模板不再混入 DeepSeek、Qwen 等其他服务商的模型。

在「设置 → 模型配置」填写 Base URL 和 Key 后，点击「拉取模型」。服务端通过 `POST /api/agent/fetch-models` 请求该服务的模型列表，无生成请求。成功后替换当前草稿的模型目录并保留已选模型；保存后持久化。失败、空列表、切换配置期间的过期响应不会覆盖原目录。模型目录并不保证每个模型都具有工具调用能力或当前账号的实际调用权限。

实现位于 `server/provider-models.mjs`：

- 原生 Anthropic 使用 x-api-key、anthropic-version，支持 has_more/last_id 分页。
- 兼容服务按同源候选地址查询，正确处理 v1、v4 和 /anthropic、/coding 等兼容前缀。
- 模板可通过 modelsPath 指定精确目录，例如 DeepSeek /models、Moonshot /v1/models、硅基流动对话模型筛选。
- 小米使用 api-key 鉴权。Token Plan 与按量 Key 分开，目录权限取决于套餐。
- 精确模板目录只在原模板 Base URL 生效，自定义网关不会收到其他服务商的目录地址。拒绝跨域跳转；总超时 30 秒；仅 404/405 尝试下一个地址，401/403、429 立即报告。
- 无接口时允许保留模板列表或手动输入模型 ID，不伪装为在线更新成功。

参考本机 cc-switch 的 src-tauri/src/services/model_fetch.rs：它同样维护内置服务商模板，然后利用带 Key 的模型列表接口和兼容路径候选获取目录。其 Codex OAuth、GitHub Copilot 另走登录态、令牌交换和专用接口。本项目当前没有移植这些账号登录链路，普通 GitHub PAT 不能当作 Copilot 服务令牌。

## 核实来源

- Anthropic 模型与目录：https://platform.claude.com/docs/en/models/overview
- DeepSeek 模型目录：https://api-docs.deepseek.com/api/list-models/
- GLM 5.3：https://docs.z.ai/guides/llm/glm-5.3
- Kimi Coding 模型：https://www.kimi.ai/help/kimi-code/models
- MiniMax 模型：https://platform.minimax.io/docs/guides/text-generation
- 小米目录与鉴权：https://mimo.mi.com/docs/en-US/api/model/list-models
- 小米 Token Plan：https://mimo.mi.com/docs/en-US/tokenplan/Token%20Plan/quick-access
- OpenRouter 目录：https://openrouter.ai/docs/api/api-reference/models/get-models
- 硅基流动对话模型筛选：https://api-docs.siliconflow.cn/docs/api/models-get

本次只读实测：本机两份智谱配置各返回 11 个模型；小米 Token Plan 返回 401/403 鉴权失败。未发送生成请求，未修改真实账号凭证或选中的模型。

验证：node --test tests/provider-models.test.mjs tests/agent-provider-config.test.mjs tests/agent-provider-create-mode.test.mjs；node tests/unified-settings.browser.mjs；npm run agent:check。

## 模板显示修正

2026-10-21 再次核对：GLM 模板仅推荐 5.3 / 5.3-Flash / 5.3-FlashX，Claude 默认 Opus 5.5，Kimi Coding 默认 k3，开放平台默认 kimi-k3。OpenRouter 模板从公开模型 API 校验 11 个当前模型，包含 GPT-6.1 Sol 系列。通用 OpenAI 兼容模板保持空白，不假定自定义端点支持某个厂商型号；GitHub Copilot 移除写死的旧模型，要求以账号目录为准。

修正已保存的旧 models 数组遮蔽新版模板的问题：最新模板模型优先显示，再补充用户保存的模型和当前选中型号。新建配置使用新版默认模型，已有配置的当前模型保持原值。加载模板时禁用缓存并重建模板选择器，避免继续显示旧选项。


## 常用模型与切换（2026-11-03）

模型目录 `models` 与切换名单 `enabledModels` 独立保存。设置中可勾选同一服务商的多个常用模型；拉取新目录不会自动启用新模型。旧配置缺少 `enabledModels` 时只显示原来的当前模型，明确保存空数组则不在菜单显示该服务商的模型。

切换菜单按服务商分组，以完整模型名称为主，长名称允许换行。思考强度在同一菜单内直接点选，选项来自当前模型能力；仅支持开关的模型显示默认/开启/关闭，能力未确认的模型保持模型默认。切换到不支持原强度的型号时移除过期参数。模型切换失败保留原选择，强度保存失败恢复原值。


服务商模型管理使用一份固定列表，整行点击即可勾选或取消，选择后不移动或隐藏模型。底部“保存配置”统一提交。较长的列表提供查找；手动输入模型 ID 放在折叠备用入口。查询不算未保存修改，目录与选择的变化会触发未保存提醒。


权限选择独立于服务商配置保存。调整权限会更新当前会话，以及单独保存的 `defaultPermissionMode`；新建会话复制该默认值，打开历史会话时读取该会话自己的权限。模型切换和思考强度调整保留会话权限，其他已有会话不随默认值改变。
