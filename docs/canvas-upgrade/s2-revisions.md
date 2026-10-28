# S2：完整画板快照、事务恢复与版本分支

日期：2026-10-27（Asia/Shanghai）。本阶段提供存储与 API；画板历史菜单、比较浮层、Agent 完成后自动形成业务版本属于 S3，不在此阶段提前接入。

## 数据与版本语义

页面根目录维护 `board-history/index.json` 与 `board-history/{boardId}/{revisionId}/`。每份不可变包包含 `manifest.json` 和 `files/`，文件仍按原画布版本相对路径保存：

```text
board-history/{boardId}/{revisionId}/
  manifest.json
  files/boards/{sourceDirectory}/index.html
  files/boards/{sourceDirectory}/styles.css
  files/boards/{sourceDirectory}/app.js
  files/boards/{sourceDirectory}/modules/...
  files/assets/...
  files/shared/...
```

快照收集整个画板目录、整个同版本 assets（覆盖计算式素材名），以及从入口递归发现的静态 HTML/CSS/JS 依赖。支持 ES Module、局部模块、静态 fetch/new URL、CSS url/@import、图片与 import map。未关联的画板源文件也保留，但仅验证入口可达依赖，不把未运行的工具脚本当成业务入口执行。Node 只做标准 JavaScript 语法检查，不执行用户源码。依赖限当前版本，拒绝越界/符号链接/隐藏路径及不允许的可执行资源；默认最多 5000 文件、128 MiB，读取前后比较内容并等待稳定窗口。无效或变化中的候选不形成新正式版本。

manifest 记录业务 revisionId、逻辑 boardId、parentRevisionId、源画布版本/实例、入口、时间、名称、说明、文件大小和 SHA-256，以及仍需网络的外部依赖。索引另保存整个 manifest 的 SHA-256，防止修改文件后同时伪造 manifest 校验值。读取、预览和恢复均校验索引/清单/文件一致性，不修改历史快照。

首次保存 parent 为 null；后续默认继承当前 node.boardRevisionId，也可显式选择同一 boardId 的旧 revisionId 为父，形成分支。画布实例只更新自己的版本指针和布局 revision，其他节点、画布版本和未知字段保持不动。普通自动保存不创建 BoardRevision；它不能写入未经历史索引确认的新 revisionId。

恢复旧版会先保存当前可运行工作副本为 recovery 版本，再创建 parent 指向所选旧版的 restore 版本，将完整业务目录与缺失依赖恢复到工作副本。如果当前工作副本已损坏，则先把可获得的源码、素材、诊断留在事务回收站的 `recovery-draft/`，不冒充可运行的正式业务版本，再恢复合法旧版。历史原版永不倒写。

## 事务与恢复

`server/canvas_transactions.py` 提供进程内锁及页面级 OS 文件锁。画板操作与原 `/api/canvas/save` 使用同一锁和恢复协议；不锁住整个 Agent 任务。

事务先准备全部 after/before 材料，同步文件和目录，再写入持久日志；按快照 → 工作副本/缺失依赖 → 历史索引 → 布局指针顺序安装，最后标记 committed。每次安装重新校验目标原指纹；目录替换保留 displaced 副本。快照创建/恢复出现异常时回滚；日志和材料移入 `.board-trash/{transactionId}/`，不自动删除。

进程中断后，下一次相关操作或普通布局保存先恢复事务：全部安装完成则确认提交，部分安装则回滚，回滚自身中断也可继续。若外部写入改变了事务目标，停止自动恢复并返回 409，保留全部材料。调用者先读取事务清单，再以精确 `expectedCurrent` 指纹选择显式 rollback；服务器先备份外部内容到 `external-current/`，指纹变化则再次返回 409。

旧 cloneFrom 和嵌入图片保存也改为先暂存，再与布局一起提交。提交失败时，新业务副本/图片不会作为无引用资源遗留在正式目录；已有源、历史、草稿不被清除。

## API 与开关

在真实业务工作区的 `workspace.json` 中取 id，显式配置测试工作区：

```json
{
  "testWorkspaceIds": ["测试工作区的 id"],
  "overrides": { "canvasSchemaV2": true, "boardRevisions": true }
}
```

默认关闭，未自动启用任何真实业务工作区。操作前需通过 S1 保存为 v2。新建/恢复请求携带 projectId、pageId、version、nodeId、boardId、revision 和完整 baseline；旧 revision 或 baseline 返回 409，身份/路径不匹配拒绝。

| API | 用途 |
| --- | --- |
| GET /api/boards/versions | 按 projectId/pageId/boardId 列出正式历史 |
| POST /api/boards/versions/create | 从当前稳定工作副本创建版本；可传 parentRevisionId、label、description |
| POST /api/boards/versions/restore | 按 revisionId 恢复，并返回 recoveryRevisionId 或 recoveryDraft、事务 ID |
| GET /api/boards/versions/preview | 校验快照并返回 manifest 和只读资源 URL |
| GET /api/boards/transactions | 读取待处理事务及当前目标指纹，不触发冲突事务覆盖 |
| POST /api/boards/transactions/recover | 自动恢复；显式 rollback 另带 transactionId、expectedCurrent |

关闭 boardRevisions 后拒绝新的业务版本变更，既有历史仍可读取，普通编辑/自动保存继续工作；未完成事务仍优先安全恢复，不能靠关闭开关丢弃未完成提交。

历史资源通过 `/__prota_board_history/...` 单独提供，原始历史/日志/回收站静态路径被阻止。HTML 使用 opaque-origin CSP sandbox，保留脚本与表单交互，隔离 Portal origin 和本机存储；仅该静态资源接口接纳沙箱模块请求，管理 API 不接受 opaque-origin 调用。CORS 响应只写入一个值，模块与相对素材在真实浏览器中验证。

## 验证

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_board_revisions.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_canvas*.py'
node --test tests/canvas-core.test.mjs tests/canvas-baseline.test.mjs tests/canvas-version-model.test.mjs
node tests/board-revisions.browser.mjs
node tests/canvas-version-browser.mjs
node tests/infinite-canvas.browser.mjs
node tests/page-presentation.browser.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_deployer.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_share_security.py
node tests/canvas-performance.browser.mjs --output=/private/tmp/prota-canvas-s2.json
node tests/canvas-performance.browser.mjs --scenario=50:0 --output=/private/tmp/prota-canvas-s2-50.json
```

新增 17 项画板测试，既有 19 项 Python 画布测试、21 项 Node 核心/模型测试通过；当前工作区的 12 项预览回归（`node --test tests/preview-*.test.mjs`，仅已有并行预览实现的工作区执行）也通过，另有部署 9 项、分享安全 6 项回归通过。四套浏览器回归在工作区通过，并在只叠加 S2 的干净 S1 源码副本验证，排除本地其他功能改动依赖。

覆盖完整嵌套模块/素材快照、不可变旧版、父版本分叉、不同画布版本独立、恢复点、损坏草稿保护、非法 JS/依赖/路径、源变化、容量、清单/文件篡改、旧窗口 409、关闭开关、原始历史路径隔离及 opaque sandbox 模块交互。

故障覆盖提交写盘失败、目录替换间隙真实进程退出、回滚途中真实进程退出、全部安装后尚未标记 committed 的中断、自动保存先恢复中断事务、外部写入冲突与带指纹的显式回滚、复制/图片提交失败无孤儿资源。未进行断电、Windows 原生文件锁或真实磁盘耗尽演练；错误通过故障注入验证。

## 性能和边界

[完整性能结果](s2-performance.json) 沿用 S0/S1 机器和七场景。帧间隔最差档 p95 约 26ms，仍不能证明 16.7ms；3000 节点仍拒绝，50 个 iframe 仍全部挂载。完整测量中 50 节点保存出现 124ms 单次峰值；额外隔离复测分别为 7.3ms、11.5ms，记录见 [复测 1](s2-performance-50-repeat1.json)、[复测 2](s2-performance-50-repeat2.json)。不据此删除异常点或宣称无退化；该轮测量存在并行测试/环境噪声，后续需同机持续对照。测量来自含其他未提交功能的工作区，默认关闭业务版本开关，不代表大快照事务时延。

- 当前优先文件完整性，尚未去重；整个 assets 与恢复回收站可能增大磁盘占用。没有自动 GC，不会误删旧画布/分享/恢复引用；引用分析和释放需后续明确治理。
- 恢复共享依赖时，已有文件若与历史字节不同返回 409，不覆盖其他画板；当前恢复要求相同业务 src 目录。不同目录实例的可移植复制/资源重映射留给 S7，不能静默改写源码。
- 根绝对地址、越版本依赖和未能解析的模块映射不作为成功快照发布；来源文件保持原样。计算式画板内依赖由完整目录兜底，计算式 assets 由完整素材目录兜底，任意跨目录动态依赖仍需显式可发现的静态引用。
- 外部 CDN/API 不下载，仍依赖原网络环境。历史沙箱不继承原站点 cookies/localStorage，这与活跃工作副本的身份环境不同。
- 正常工作副本、普通页面、Agent/Prompt/Skill、真实业务 projects.json 与 Portal 元数据快照均未因 S2 被改写。ZIP/分享默认只含当前可运行版本，正式历史的可选打包与历史 UI 在后续阶段接入。

下一阶段 S3 在这些 API 上接入现有 Action、画板历史/比较与画布版本元信息、轻量 PRD 关联，继续复用现有 Agent。S2 不新增侧栏、图层面板或第二套会话。
