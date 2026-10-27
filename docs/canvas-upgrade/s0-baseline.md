# S0：Canvas Runtime v4 基线

日期：2026-10-27（Asia/Shanghai）。仅完成 S0，S1～S9 未验收。

## 基线与工作区隔离

- 方案、本地 HEAD、GitHub `lefinite/Prota` 远端 main 均为 `ed9a52cb488e6ac2cb6458ca14446bc2f53f5600`。远端通过 GitHub API `/repos/lefinite/Prota/branches/main` 核实；本机 Git HTTP 代理 127.0.0.1:1082 不可达。
- 当前分支为 `codex/open-source-product`。开始前已有 11 个跟踪文件修改，以及预览/PRD 未跟踪文件。保留原样；本阶段只新增独立文件，不把已有修改带入 S0 PR。
- 原四项回归同时在工作区和基线临时源码副本运行。临时副本取自 Git HEAD，仅叠加 S0 新文件，复用已安装 node_modules，不包含现有预览/PRD 修改。
- 性能报告使用 HEAD 的原始前端模板；测试 bridge/存储服务来自当前工作区，因此不是全产品干净 checkout 的性能结果。工作区脏文件清单与机器信息保存在原始 JSON 中。
- 所有测试业务页面、素材、元数据、配置、布局历史均创建在系统临时工作区；未写入真实业务工作区、产品 data/projects.json 或 Portal 元数据快照。未创建业务页面，无需修改页面注册配置。

## 代码与文件清单

| 位置 | 当前职责及后续边界 |
| --- | --- |
| src/templates/infinite-canvas/index.html、styles.css、icons.js、LICENSE.lucide | 自包含运行时与本地图标；S0 不改动 |
| src/templates/infinite-canvas/canvas-data.js | Schema v1，revision、nodes、viewport；不迁移业务数据 |
| src/templates/infinite-canvas/canvas-core.js | 验证、父子关系、世界坐标、复制、变换、三方合并；1000 节点上限 |
| src/templates/infinite-canvas/app.js | Action、交互、全量 DOM 更新、lazy iframe、300ms 自动保存、本地草稿、冲突恢复、Agent 完成刷新 |
| server/canvas_store.py | 当前版本内原子布局保存、最近 10 次历史、cloneFrom 复制、素材、运行时修复 |
| portal/shell.js、scripts/iterate.sh | 页面版本、Agent 上下文、版本目录复制；产品默认数据与业务元数据需隔离 |
| portal/modules/prd/manager.js | 页面 docs 文档读取与选择；现有用户修改另行保留 |
| server/agent-server.mjs | 现有 Agent 会话与固定任务上下文；S0 不改 Prompt、Skill 或调用权限 |
| server/bridge.py、server/deployer.py、server/share_manager.py | 本机 API、ZIP、分享构建、发布/撤回；S0 不发布业务内容 |
| server/workspace.py | 真实工作区路径解析与隔离 |

新增交付：

- `server/canvas-features.mjs`：12 个升级开关名称、全 false 默认值、显式测试工作区白名单解析。**目前仅契约，尚未接入运行时或配置 API，也不会关闭/覆盖已有渐进预览设置。** 后续功能在所属阶段接入，不能把该文件作为已具备完整灰度能力的证明。
- `tests/fixtures/canvas-v1/`：固定 revision=7、负坐标、分组、稳定 ID、可运行 HTML/CSS/JS 和相对素材的旧版档案。
- `tests/canvas-baseline.test.mjs`：只读加载、身份保留、容量边界及开关隔离。
- `tests/test_canvas_baseline.py`：真实磁盘编辑保存、历史备份、409 不覆盖、升级保留完整业务目录；服务端容量边界。
- `tests/canvas-performance.browser.mjs`：隔离测试服务、固定数据生成器、机器信息、真实交互、局部 Agent 完成刷新、真实保存与 JSON 指标输出；允许从指定 Git 提交提取原始模板。

## 验证命令

在产品根目录执行；浏览器测试需要可用的 Playwright Chromium 和本机监听权限，不调用收费模型。

```sh
node --test tests/canvas-core.test.mjs tests/canvas-baseline.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_canvas*.py'
node tests/infinite-canvas.browser.mjs
node tests/page-presentation.browser.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_page_presentation.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_workspace_paths.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_share_security.py
node tests/canvas-performance.browser.mjs --runtime-ref=ed9a52cb488e6ac2cb6458ca14446bc2f53f5600 --output=/private/tmp/prota-canvas-s0.json
```

核心/基线 Node 测试：14/14；存储/基线 Python 测试：10/10。额外页面元数据 2/2、工作区路径 1/1、分享安全 6/6。现有两项浏览器套件在工作区通过，干净副本画布套件通过。干净副本 Portal 分享场景曾发生一次 widget-v1-local.html 等待超时，诊断重跑通过，随后恢复原始测试并原样复跑通过；保留为后续稳定性风险，未据此修改产品逻辑。覆盖范围包括真实 Portal/iframe 消息链、Agent 作用范围、409 恢复、响应式、普通页面/画布隔离、页面/目录分享。

## 性能实测

固定环境：Apple M4，10 核，16 GiB，macOS Darwin 24.3.0 arm64，Node 24.16.0，Chromium 148.0.7778.96 headless，1440×1000。每场景单次导航，缩放分别为 10%/100%/200%，每档 48 次平移和 48 次 Ctrl-wheel 缩放，保存 5 次。没有设置防抖/性能达标的 CI 断言；基准用于后续同机同浏览器对照。

| 节点数 | 画板数 | 就绪 ms | 帧间隔 p95 ms（最差档） | 输入 p95 ms（最差档） | 保存 p95 ms | 采样主页面堆 MiB | 挂载 / 已加载 iframe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 0 | 160.4 | 26.1 | 39.8 | 8.8 | 6.0 | 0 / 0 |
| 200 | 0 | 59.0 | 26.1 | 37.9 | 3.7 | 6.7 | 0 / 0 |
| 1000 | 0 | 83.7 | 26.2 | 42.0 | 7.8 | 5.2 | 0 / 0 |
| 3000 | 0 | 容量拒绝 | — | — | — | — | — |
| 50 | 5 | 88.2 | 26.2 | 36.7 | 3.2 | 15.7 | 5 / 5 |
| 200 | 20 | 110.7 | 26.1 | 38.4 | 3.8 | 43.5 | 20 / 20 |
| 1000 | 50 | 163.9 | 26.2 | 42.6 | 6.2 | 41.9 | 50 / 50 |

[完整机器信息与各缩放档原始结果](s0-performance.json)。测试也记录框选、拖拽整体耗时和单画板局部刷新耗时，并验证局部刷新保留其他 iframe DOM 身份。当前 1000 节点/50 画板全部挂载 50 个 iframe，lazy loading 不等于虚拟化。

测量限制：

- 就绪时间是导航至 runtime API 可用并经过两帧的近似值，不包含视口外 iframe 全部加载，也不是经用户实验确认的 TTI。
- 帧间隔由 rAF 采集，包含浏览器与 Playwright 调度；输入延迟为事件时间戳到下一帧，不是操作系统至屏幕延迟。框选/拖拽耗时包含发送 20 个自动化输入的时间，不能当成单帧渲染耗时。
- 内存是多时点采样的主页面 JS heap 最大值，不是浏览器进程/所有 iframe 的总峰值。总内存峰值与真实设备交互仍须在 S5/S9 用系统级 profiler 补测。
- 3000 节点仅测试前后端容量拒绝，不能报告成可交互性能。现有 1000 节点上限不变。
- 最差档帧间隔约 26ms，尚未证明满足方案的 16.7ms/接近 60fps 目标。S5 需排查渲染与调度开销并以同口径对照，S0 不作性能达标承诺。

## 风险、回退及下一阶段

1. 工作区已有 S4 相关修改，不视为完成 S4；后续要对齐 observer、版本存储与正式快照语义，不能把中间预览当成 BoardRevision。
2. `.canvas-history` 只包含布局，不保证业务代码历史；复制 cloneFrom 在最终提交前可能留下孤儿目录。S2 建立事务和引用闭包后才能做 GC。
3. iframe 当前同时允许 scripts/same-origin，需要在 S8 对 Portal 管理 API 边界与消息来源做实测审计。S0 没有修改安全行为。
4. 本阶段不迁移、不写业务目录、不接入开关；回退只需撤回新增测试、样例、契约与报告。后续 Schema 回退不能靠丢弃新字段实现。
5. S1 先固定 nodeId/boardId/boardRevisionId 契约，补充 v1→v2 的内存只读迁移、首次保存事务备份、未知字段保留、失败不覆盖和前后端一致性测试。测试通过并完成阶段审阅后再推进 S2。

PR 切分保持 S0 独立：本 PR 仅测试/样例/开关契约/报告。后续 S1 数据内核、S2 版本事务、S3 版本 UI 依次交付；S4～S9 按总方案依赖顺序执行，不一次合并所有模块。
