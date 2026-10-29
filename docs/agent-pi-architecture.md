# Prota Agent 迁移 Pi

目标是完整替换 `@codeany/open-agent-sdk`。本文记录当前实现与验收证据；未完成项不代表兼容能力已经交付。

## 固定的上游

- 仓库：`https://github.com/earendil-works/pi.git`
- Release：`v1.4.0`
- Commit：`4a080252f06caf63a525d7873c5d94d3c23887e0`
- 引入方式：`vendor/pi` Git Submodule；不修改上游核心代码。
- 版本记录：`pi-version.json`。
- Node 最低要求：22.19.0。产品 engines、macOS 和 Windows 启动检查已同步。

## 已实现的基础层

`scripts/build-pi.mjs` 检查 Release、Commit 和源码工作树，按上游锁文件安装依赖，下载并验证上游发布版本固定的模型目录，再执行上游 `build:offline`。构建通过上游的 `produceArtifactSet`、`installConsumer` 生成完整的独立 npm 安装目录，包含官方 bundle、依赖和资源，不依赖全局 Pi。

模型目录固定为上游 `nix/model-catalog.json` 中的 SHA-256 revision，下载的内容必须匹配 revision。没有重新生成模型类型，也没有因供应商接口不可用而缩减模型目录。

产物保存在被 Git 忽略的 `runtime/pi/`。构建将 `integrations/pi/prota-extension.ts` 及其业务策略编译为独立扩展，再在 staging 目录执行逐文件 SHA-256 校验及真实 RPC smoke（确认扩展注册成功），成功后替换旧目录；构建失败不会替换现有运行时。原始 Pi MIT License 随运行时保留。`runtime/pi-artifacts/` 是开发构建产物，不能作为用户配置或会话存储位置。

运行时 manifest 还保存扩展协议版本与第一方编译输入的 SHA-256。修改扩展或其业务策略而没有重新构建时，校验会明确失败，不会静默加载旧扩展。

`server/pi/rpc-transport.mjs` 管理 LF 字节分帧、跨块 UTF-8、命令 ID、超时、取消、背压、诊断缓冲和进程断开。超时不会重发 prompt。

`server/pi/runtime-manager.mjs` 管理懒启动、同会话启动去重、进程复用、会话间隔离、容量限制、空闲回收、进程异常和关闭。上层提供绝对工作区路径、隔离环境、官方 CLI 参数。`prompt` 在收到接受结果之后，以 `agent_settled` 判定完成；`agent_end` 不能结束 Prota Run。取消、Provider 失败、超时与断开有独立错误码。

`server/pi/event-adapter.mjs` 将流式文字、思考、工具调用/结果、压缩与交互映射为现有 SSE 事件形状。文字与思考通过稳定事件 ID 原位替换，并以最终消息校正；工具调用按原生 ID 去重。适配层不自行生成 Run 终态，Gateway 必须在 Runtime 完成、产物检查和文件变更处理后统一完成 Run。

无限画布允许独立会话并行修改不同画板，默认进程容量为 4。画板 Agent 入口在运行中保持可用，优先打开处理所选画板的运行会话；页面内新建会话绑定当前页面。切换会话只断开前端订阅，后台任务继续运行，前端按会话和 AbortController 隔离迟到事件，并汇总后台任务的画板目标保护。

运行中可继续标注，并通过 `POST /api/agent/session/:sessionId/steer` 追加文字、标注与 PRD 文本。Gateway 使用原生 `prompt` 的 `streamingBehavior: "steer"`，在当前步骤后交给同一 Pi 会话；不创建重复 Run 或检查点。Runtime 在追加消息的接受结果返回前保留原 Run 监听，覆盖前一轮恰好结束的边界。追加消息以 `user_followup` 保存到 Timeline，失败时保留输入与标注草稿。输入为空时发送按钮仍停止当前任务，审批和主动提问继续沿原入口处理。运行中图片和斜杠命令仍使用新会话或等待本轮结束。

正式 Gateway 的任务执行与标题生成已经改为 Pi RPC，不再导入旧 SDK。HTTP/SSE 路由名称保持兼容。创建会话和读取历史不启动 Pi；需要执行任务或明确读取模型消息时才启动。`engineInfo` 与原 Prota Snapshot 一起保存，原生 Session 放在工作区 `data/pi-sessions/<Prota session ID>/`。

命令层已改为 Prota 注册表 + Pi 原生命令的合并模型。`/tree`、`/fork`、`/clone`、`/rewind`、`/thinking`、`/auto-compact`、`/name`、`/usage`、`/export`、`/copy` 和 `/compact [要求]` 走 Pi Session/RPC；`/compact` 调用官方原生压缩并保留 Prota Timeline，不再用摘要事件覆盖业务历史。动态发现的 Pi 命令会过滤 Prota 内部命令、prompt/skill 来源、不安全名称以及与现有命令或别名冲突的项。未知 `/xxx` 在前端提示，后端 message API 同样拒绝，避免被当成普通 Prompt 发送。

Fork 在所选原生用户消息前创建分支并把该消息放入输入框草稿；Clone 复制当前完整上下文。两者都会生成独立 Prota Snapshot 与原生 Session，并只复制能精确映射的 Timeline/检查点。`/rewind` 默认仅回溯对话，文件保持当前状态；选择恢复文件时必须先生成差异预览，再用 5 分钟有效的确认 token 执行。预览后任何文件状态变化都会要求重新预览。恢复成功后，源会话和分支会话都持久化 `workspaceNotice`，后续模型请求会收到“请读取实际文件”的上下文提示。

旧 Snapshot 在首次读取、任何修改前保存到 `data/agent-sessions/legacy-backups/<ID>/snapshot.json`。迁移会尝试读取工作区匹配的旧 SDK transcript 并备份原始字节；对可验证的旧消息执行文本、图片和工具关联转换，通过扩展命令调用官方 `ctx.newSession({setup})` 与 Session Manager 写入；缺少的计量/时间元数据使用明确标注的默认值，不宣称补测。未知消息块、签名思考、孤立工具结果或未完成工具调用会保留原始数据并明确采用摘要恢复。转换结果通过原生迁移标记检测，支持 Snapshot 尚未保存时的幂等恢复。摘要恢复通过官方 `before_agent_start` 返回自定义上下文消息，并检查原生分支中是否已有相同 `customType`，避免重复注入。Snapshot 保存 `pending` / `converted` / `summary_recovered` / `failed` 状态与迁移版本。

Clear 创建新的原生 Session ID，保留旧原生文件；Fork 使用 Pi 的 `clone` RPC 创建原生分支，再为新 Prota 会话保存独立文件。Archive 继续仅更改展示状态；Delete 仅在现有明确删除操作中移除该会话的 Prota 记录、Pi 数据、运行配置与迁移备份。

自定义 `modelCapabilities` 与配置模型目录会从前端运行配置传递并随会话 Snapshot 持久化。

模型已在同 Provider 配置中加载且其他连接参数不变时，优先通过 `set_model` RPC 切换；端点或凭证变化会安全重建 Runtime。Gateway 切换工作区和收到退出信号时关闭对应 Pi 进程。

`provider-adapter.mjs` 将现有 Provider 协议、端点、模型及已支持参数转换为 Pi `models.json` 和 `settings.json`。它从固定模型目录读取能力信息，未声明图片支持时明确拒绝图片；未知的重要 SDK 参数会报配置错误。Key 通过会话专属环境变量提供，不写入 JSON 或命令行。未设置的其他 Provider 凭证和 `NODE_OPTIONS` 不继承。

环境变量不是凭证沙箱：获准运行的 shell 工具仍可能读取当前 Pi 进程的 Key。扩展的文件路径检查也不是 shell 的操作系统沙箱；生产集成不能将其描述为强隔离。

已增加已知运行凭证的输出脱敏：官方 `tool_result` / `message_end` Hook 在原生消息持久化前替换凭证；Gateway 对用户 Prompt、SSE、会话快照、列表与历史响应额外过滤。流式文字跨 RPC 记录的凭证片段会暂存到能安全输出时再发送。原生集成测试覆盖获准 shell 回显 Provider Key，以及模型分块返回 Key，验证模型上下文、SSE、Prota Snapshot 与 Pi Session 不含该凭证。图片二进制保留原样。该措施不会限制获准 shell 的文件或网络访问，也不构成凭证沙箱。

`tools` 的字符串列表与本轮白名单取交集，空列表关闭工具；旧 `default` 预设保持对应的产品工具集。未知预设、旧自定义工具定义、非占位的 `canUseTool` 回调和未映射的重要选项会明确报错，要求迁移到官方 Extension。旧可选配置入口继续保留 JSON/MCP 配置能力。

Runtime 还显式传入当前 `READIFY_WORKSPACE`、`READIFY_CONFIG_DIR`，并保留显式配置的 `PLAYWRIGHT_BROWSERS_PATH` 等运行路径；这些不是继承全部环境的例外。截图工具因此使用当前工作区与桌面发行包的浏览器缓存。

Prota Extension 已实现逐轮任务策略、系统上下文、官方请求 payload hook、工具前授权、`allow_once` / `allow_session` / `deny`、原生 Session 保存授权、`ask_user`、轮数限制和使用量记录。UI 交互使用版本化标识 `prota-ui:v1:`，Gateway 需通过 `ui-protocol.mjs` 解码并关联 Run 与现有审批/提问 UI。

运行时启动的 `--tools` 必须包含产品支持工具的全集（尤其是 `ask_user`）；Pi CLI 白名单会过滤工具注册。扩展再使用 `pi.setActiveTools()` 设置本轮子集，`tool_call` 再次检查白名单和文件边界。禁止通过只启动 `read,write` 然后动态启用未注册的 `ask_user` 来集成。

`dontAsk` 采用“不询问，拒绝未授权高风险操作”的语义，Provider Adapter 返回兼容性提示，Gateway 必须展示；`plan` 明确保留现有 default 审批行为。

MCP 使用 Pi 官方未修改的 MCP 扩展、stdio/streamable HTTP 传输和原生工具管线。Prota 只转换配置并强制 direct 工具模式，关闭隐式 codemode；只有本轮显式允许的 `mcp__server__tool` 或通配符工具可用，排除名单优先。MCP 操作默认审批，`acceptEdits` 不会自动授权外部调用；会话授权按工具类型匹配，绑定当前 Prota 会话和工作区；分叉会话重新审批，持久化记录不保存参数原文。环境变量、请求头及 OAuth clientSecret 转为专属环境引用，不写入运行时 mcp.json；旧 SSE 传输、命令式凭证和未知字段明确报错。OAuth 登录 UI 尚未验证。

`/mcp` 展示每个 namespace 的 configured / enabled / connected / tools / allowedTools / approval 状态；`/mcp enable|disable 名称` 只切换当前会话级启用状态。未显式 `enabled: true` 的 namespace 不加入默认工具白名单；启用的 namespace 也仍受本轮工具交集、deny 列表、available tools 和审批模式约束。

Provider 连接测试使用与运行时一致的协议适配，分别构造 Anthropic Messages、OpenAI Chat Completions、OpenAI Responses 和 Google Generative Language 请求。OpenAI 兼容端点保留已有数字版本段（如 `/v1`、`/v4`）；没有版本段时自动补 `/v1`，避免根地址测试误打到缺少版本的路径。

Pi 内置资源默认排在文件扩展之后；因此通过文件路径加载其官方 MCP 工厂，保证 MCP direct 工具连接完成后再执行 Prota 策略 Hook，同时明确更新 `systemPromptOptions.selectedTools` 与活动工具集。该路径属于固定版本的兼容面，由原生集成测试覆盖升级检查。

## 当前验证

```sh
npm run pi:build
npm run pi:verify
npm run agent:test
```

测试必须在构建 Pi 后运行。测试包括 RPC 故障契约、运行时生命周期、产物完整性、Provider 映射、权限与扩展，以及运行真实 Pi 子进程的集成测试。集成测试使用本机确定性 HTTP 模型端点，让 Pi 原生 `write` 工具经审批写文件，关闭并重建进程，再验证原生 Session 保留消息和工具结果，以及 `ask_user` 的中文选项往返。

本机 HTTP 端点仅用于测试，不属于生产模型适配，也不能证明真实 Provider 的连接、质量或计费参数已通过验收。测试不读取生产 API Key，不修改用户工作区。

## 2026-10-28 验证记录

`pi:build` 与 `pi:verify` 已通过，官方 v1.4.0 源码保持干净。组合运行 Pi、Provider 配置/目录和桌面启动器测试：86 项通过，0 失败、0 跳过。Gateway 原生测试覆盖 HTTP/SSE 写文件、审批、并发 busy、检查点与回滚、服务重启、Fork、Clear、旧快照备份、摘要恢复幂等性和实际流式中断。后续管理边界专项还检查 Archive 保留原生字节、Set Context 保持映射及 Delete 仅删除专属数据。

专项测试包含：

- 完整官方 Pi 子进程的自动压缩、持久化摘要和重启恢复。
- 图片进入真实原生请求及 Session；未声明图片能力时明确拒绝。测试模型端点为本机确定性服务，不能称为真实供应商图片验收。
- MCP stdio 与带认证的 Streamable HTTP：官方工具发现、白名单、审批、结果回传、环境凭证与配置文件脱敏。OAuth 交互认证尚未实测；无法映射的原生交互明确失败，避免无声挂起。
- 未接受 prompt 时取消/超时、UI 适配失败、进程退出恢复、容量和空闲回收。
- 旧历史安全转换、失败分支保留后重试、提交标记幂等性；不兼容签名思考等格式明确摘要恢复。
- 真实 Portal + Bridge + Gateway + Pi + Chromium：审批/主动提问等待时刷新，同一会话恢复、回答后继续、最终消息去重。allow_session 保持原产品按工具授权，并验证不同文件与分叉隔离。
- 同 Provider RPC 模型切换；工作区、持久化选项、MCP、端点和完整模型目录变化时安全重建。
- 已知 Provider/MCP 凭证在流式片段、工具结果、快照和历史中脱敏；空闲进程已被回收时仍从配置识别 MCP 凭证。此功能不构成操作系统沙箱。
- 命令层与会话能力专项：原生 compact 后 Timeline 前缀保持不变，compact 指定重点进入模型请求；Fork/Clone/Rewind 保持独立语义，文件恢复必须经过新鲜预览与 token 确认；重启后恢复文件通知进入后续模型请求；四种 Provider 协议的连接测试端点一致；未知斜杠命令不会提交为普通 Prompt。
- 取消生命周期专项：已接受的 Abort 会等待 Pi `agent_settled` 后再关闭该 Runtime，避免立即重试与原生工具收尾重叠；未接受 prompt 的 Abort 仍在确认后立即销毁不确定进程。

2026-10-28 本次命令层改造完成后：`npm run agent:test` 81 项全部通过，`npm run pi:verify` 通过，真实 Portal + Bridge + Gateway + Pi + Chromium 的 `tests/pi-ui.browser.mjs` 通过。

### 真实 Provider 与业务生成

`node scripts/test-pi-live.mjs --direct [--provider ID]` 只读取已配置凭证，产物写入隔离临时工作区。实际通过智谱 Anthropic-compatible 端点的 GLM-5.3-Flash 与 GLM-5.3：单轮/多轮记忆、连续 Write + Read、进程重启恢复。其他 Provider、供应商图片和 OAuth 尚未真实验证。

真实 HTTP/SSE 业务任务已生成并完成对应浏览器或产物检查：Mobile、Web Dashboard、三画板无限画布、v1→v2（v1 原样保留并读取文档）、已有画布局部编辑（布局/ID/无关文件不变）、在 v2 继续编辑、含标注和三张状态截图的业务 AI-Ready PRD。另已实际回滚 v2 最近一次三文件编辑，随后重启 Gateway 并在原生历史中继续只读核查，确认回滚后的源码事实。

当前工作树已有合并版 generate-business-prd Skill；历史 generate-product-doc / generate-ai-ready-prd 执行 ID 在原 Skill 未安装时解析到当前合并版。显式禁用的旧 Skill 不回退，已安装独立旧 Skill 优先使用原项。未声称不存在的两份旧 Skill 均已单独执行。

### 五组新旧引擎对照

基线使用产品外的临时旧 SDK 0.2.1 测试脚本，不接入正式入口。各组同模型、maxTokens=16384、maxTurns=200、相同用户指令及完整业务 Skill；迭代/PRD 另校验标准化提示词、系统业务上下文和输入源码哈希相同。Pi 保留其原生系统提示词和工具，实现差异属于比较对象。所有产物生成完成；原型浏览器交互通过，PRD 各有三张真实状态截图及可见元数据。人工视觉盲评尚待完成。

| 任务 | 模型 | 旧 SDK / Pi 总耗时（秒） | 旧 / Pi 总 token（含缓存读取） | 旧 / Pi 工具错误 |
| --- | --- | ---: | ---: | ---: |
| Mobile | GLM-5.3-Flash | 591 / 236 | 625769 / 219865 | 0 / 0 |
| Web Dashboard | GLM-5.3-Flash | 753 / 547 | 1026759 / 369629 | 0 / 1 |
| 三画板无限画布 | GLM-5.3 | 654 / 1079 | 2591171 / 4789338 | 0 / 5 |
| 已有原型迭代 | GLM-5.3-Flash | 218 / 305 | 393482 / 290544 | 0 / 5 |
| 标注及 PRD | GLM-5.3-Flash | 370 / 419 | 457797 / 732630 | 0 / 0 |

这是每组各一次有效生成，不足以证明统计显著性。Pi 画布样本耗时约增 65%、总 token 约增 85%，PRD 总 token 约增 60%，不能宣称性能无退化。画布额外消耗伴随更多模型轮次与源码/模板检查（Pi 86 次工具调用，旧引擎 64 次）；错误为模型自检命令和工作区外文件拦截，无持续 RPC 协议失败。迭代样本错误含继承本机 C.UTF-8 导致 Perl 失败、模型自检作用域错误、外部路径拦截和一次后续修复的逻辑断言。未通过削减 Skill 或工具来改善数据；性能门槛仍需审查或增加重复样本。

基线夹具早期曾错误重复 /private 前缀，相关报告已标记 invalid-fixture-path-remapping 并排除；仅使用修正后重跑的五组数据。真实回滚核查的首个测试断言错误限定 Read 工具，而模型合法使用 Bash grep；通过保留的本轮 Gateway Timeline、原生工具结果、成功终态和当前文件复核完成核查，没有重复执行回滚。

### 桌面、发布与升级

macOS 已在隔离配置和无旧 SDK 的导出产品中运行真实 Prota.app 可执行入口，经 osascript/JXA 创建 Cocoa 准备窗口，验证首次产品依赖安装时窗口 visible、就绪后退出，暖启动及适配更新不显示准备窗口。测试同时检查服务暖复用、适配文件变化仅重启 Agent，业务元数据和运行时 manifest 不变。独立 cache override 仅隔离测试诊断，不改变默认缓存路径。`PROTA_TEST_NATIVE_APP=1 node tests/macos-desktop.mjs` 现已接入 macOS CI；原 bootstrap 直测模式仍保留。本地未提交工作树须通过 PROTA_TEST_PRODUCT 指向白名单导出目录；默认模式仅归档已提交源码。测试没有验证 Finder 的系统签名/信任提示，也没有强制重复下载已有的系统 Node/Python。Windows 与 macOS 远端 CI 仍未执行，Windows 验收不以此替代。

最新白名单导出 19047 文件，扫描 0 findings、readyForReview=true。完整运行时随包交付，不要求用户安装 Pi 或拉取 Submodule；导出包可在没有根 node_modules 的情况下运行原生测试。主工作树与独立导出副本的 `package.json` 和锁文件均已移除旧 SDK，Pi 原生测试通过，macOS 冷安装/暖启动/适配更新重启再次通过。最终源码变动后须重新导出。此自动扫描不替代对发布内容的人工审查。

上游检查与每周升级 PR 流程已实现：仅稳定 Release，跨平台构建测试成功后创建草稿 PR，不自动合并。初始只读检查的最新版本为 v1.4.0；尚未演练更新至新的正式 Release。

## 尚未完成的发布门槛

1. 人工盲评与画布/PRD 消耗增加的最终质量判断。
2. Windows 实机/远端 CI 与原生 GUI 全新安装验收。macOS 原生入口/准备窗口已在本机实测；远端 CI 仍需执行。需准备审查后的测试分支或提供 Windows 执行环境。
3. 未配置的真实 Provider、供应商图片输入与 MCP OAuth；未知高级选项、自定义旧回调/工具明确报迁移错误，未声称全部兼容。
4. 新 Release 可用后执行一次真实升级演练。

当前迁移目标仍为进行中。未通过的发布门槛没有以本机确定性服务或生成成功状态替代。
