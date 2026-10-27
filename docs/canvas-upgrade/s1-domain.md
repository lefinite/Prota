# S1：数据内核与 Schema v2

日期：2026-10-27（Asia/Shanghai）。实现范围限于 S1；正式画板快照、历史 UI、流程编辑与共享运行时尚未实现。

## 数据契约

- `node.id` 继续表示摆放实例，原坐标、父子关系与 src 不变。
- v2 的 board 节点必须有 `boardId` 与 `boardRevisionId`。尚无正式快照时 `boardRevisionId: null`，自动保存只递增布局 `revision`。
- 迁移旧画板时，用 `SHA-256(JSON.stringify(['prota-board-v1', projectId, pageId, node.id]))` 的前 128 bit 构造安全 ID `b_<hex>`。排除 vN，保证同一旧节点复制至其他画布版本后身份一致；不是按数组顺序分配身份。已有 boardId 保留。
- 独立复制生成新 node.id、新 boardId，写入 originBoardId，清空 boardRevisionId，继续复制现有业务目录。
- v2 顶层新增 `edges: []`；只固定连线 ID 和两端实例 ID 的合法格式与唯一性，未知字段原样保留。允许端点缺失时保留断链身份，实际连线创建/修复 UI 属于 S6。
- v1、v2 的节点容量仍为 1000。支持多实例共享逻辑 boardId，索引返回实例列表，不把它误判为 node.id 重复。

`canvas-domain.js` 是独立纯数据层，含校验、显式迁移注册表与 `createIndex()`（byId、children、boards）。不访问 DOM、磁盘或网络，使用同步 SHA-256 保持旧经典脚本及 file:// 启动契约；与平台 SHA-256、Python hashlib 做一致性测试。`canvas-core.js` 保留旧 API 和单独加载时的 v1 兼容路径；正常编辑器通过 domain 使用 v1/v2 一致的校验。渲染复用节点索引检查祖先锁定，尚未做可见区虚拟化。

`server/canvas_domain.py` 提供等价校验和迁移。共享异常样例覆盖非法路径/换行后缀、重复 ID、循环父子关系、无效身份、布尔坐标/样式、revision、连线与错误容器类型。三方恢复同时处理节点、连线和未知顶层字段，独立更改保留，冲突继续走原有显式确认。

## 启用和回退

默认关闭。仅在测试业务工作区中创建 `data/canvas-features.json`：

```json
{
  "testWorkspaceIds": ["与 workspace.json 的 id 一致"],
  "overrides": { "canvasSchemaV2": true }
}
```

只读本机接口 `GET /api/canvas/features` 返回该工作区是否允许迁移。此配置与 S0 开关契约一致；其他 11 个开关尚未接入。真实业务工作区未自动启用。

编辑器保持同步启动，随后被动读取配置并在内存中迁移；不开启额外输入框，不修改 Agent Prompt/Skill/工具权限。读取配置失败继续旧流程，迁移失败不替换已有状态。仅打开、平移、缩放不会写回迁移。未保存的历史/重做状态也在内存中补齐身份，原始磁盘 baseline 保持 v1，继续用于 409 校验。

首次编辑保存的顺序：校验源与 baseline → 准备现有素材/复制及布局临时文件 → 重查磁盘 → 创建 `.canvas-migrations/v1-<原文件SHA256>.js` 字节级备份并同步落盘 → 再查磁盘 → 原子替换布局。备份独立于仅保留 10 次的 `.canvas-history`，不随历史轮换删除。备份或提交失败保留源，清理布局临时文件；外部写入产生 409。备份存在但布局未提交时可安全重试。

关闭开关后，未迁移 v1 继续旧读写；已存在 v2 始终可读写，不剥离身份或未知字段。旧客户端尝试以 v1 覆盖磁盘 v2 时返回 409。服务端也拒绝未获工作区开关授权的首次 v1→v2 迁移。真正恢复 v1 需由用户显式使用迁移备份并保留新数据，不能以关闭开关自动降级。

运行时修复资源清单、HTML 启动检查和 Portal 健康判断都包含 `canvas-domain.js`。Schema 版本与现有运行时版本独立；本阶段未借机覆盖并行的 Runtime v5/Markdown/预览改动。版本目录仍自包含，不跨版本引用运行代码。

## 测试与验收

```sh
node --test tests/canvas-core.test.mjs tests/canvas-baseline.test.mjs tests/canvas-version-model.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_canvas*.py'
node --test tests/preview-*.test.mjs
node tests/canvas-version-browser.mjs
node tests/infinite-canvas.browser.mjs
node tests/page-presentation.browser.mjs
node tests/canvas-performance.browser.mjs --output=/private/tmp/prota-canvas-s1.json
```

Node 核心/基线/模型 21 项、Python 画布 19 项通过；工作区已有预览逻辑的 12 项回归通过。三套浏览器回归在当前工作区通过。另把 S1 差异叠加到干净 v4 + S0 源码副本验证，避免独立 PR 带入并行修改。

新增浏览器验收覆盖：首次打开不写源文件、不创建迁移备份；刷新和 v1/v2 目录复制身份一致；首次编辑保存 v2 并备份原字节；复制画板连业务目录独立；关闭开关后 v2 可读、v1 继续原路径；损坏 v2 只读且不能保存空回退；file:// 内嵌业务交互正常。ZIP 测试验证完整运行时/业务代码/素材包含在包内，同时排除隐藏迁移备份和布局历史。

故障测试覆盖备份写盘失败、原子提交失败、备份期间外部写入、符号链接备份目录、过期 baseline、旧客户端降级、迁移备份在 12 次布局保存后仍存在。

## 性能与剩余风险

[S1 性能原始报告](s1-performance.json) 使用与 S0 相同机器、浏览器及 7 种场景，测试当前工作区的前后端。由于工作区也包含先前未提交的 Runtime v5/Markdown/预览改动，不能把与 S0 的差异全归因于 S1。此轮默认关闭迁移开关，衡量兼容路径、索引和校验开销；已启用迁移的业务正确性由独立用例覆盖。

- 最差档帧间隔 p95 约 27ms，仍不能证明达到 16.7ms。3000 节点仍拒绝，50 个画板仍挂载 50 个 iframe；虚拟化属于 S5。
- 保存计时包括当前完整文档验证和文件历史，样本仅每场景 5 次；主页面 JS heap 仍不是浏览器进程总峰值。没有据一次测量宣称性能门槛达标。
- S1 原子布局提交前仍复用现有素材写入/cloneFrom 行为。失败可能留下未引用的新素材或复制目录；不删除源文件，S2 事务及引用治理必须接管孤儿回收。
- 全面文件快照、历史恢复 UI、垃圾回收、跨窗口正式版本分支尚未实现。本阶段没有对真实业务工作区执行迁移，也未做断电演练。
- 新建节点继续使用 UUID；外部 Agent 直接重写布局文件仍应保留稳定身份。S1 不为此重写生成提示。

下一阶段 S2 以此数据契约实现不可变完整画板快照、manifest、事务提交/恢复、分支与回收站。S1 审阅后再推进；不以布局 revision 或迁移备份冒充 BoardRevision。
