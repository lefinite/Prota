# Prota Demo 埋点设计与可视化模式：完整技术执行方案

> 状态：**已在 `feat/demo-event-tracking-skill-plan` 实施**。包括 Skill、事件协议校验、右侧埋点 Tab、普通 Demo/无限画布的 iframe 双向定位、单页与文件夹分享快照、ZIP 离线 `review.html`、GitHub Actions 测试。上线前仍需完成 PR 审核并合并到 `main`。
>
> 范围：只描述、定位、交付 Demo 埋点，不对接 GA4/神策/友盟等 SDK，不采集真实用户数据，不增加服务器/数据库成本。

## 一、结论

**可行。采用“Skill 负责筛选并生成埋点规范；Portal 负责读取规范、显示标记和双向定位；分享快照负责只读交付”的三层设计。**

设计取舍：

1. 埋点设计不等于代码埋点。Demo 中只生成 `tracking/events.json`，必要时为原型控件加不可见的 `data-prota-track-id`，**不插入统计 SDK、网络请求、埋点监听器**。
2. 只埋值得开发的事件。Skill 用业务价值、决策可执行性、数据缺口、维护成本、重复性评分；推荐每页 3–8 条，硬上限 12 条；零条也允许。
3. 复用现有**右侧文档抽屉**，增加第三个“埋点” Tab。仅在 Tab 激活时渲染颜色克制的数字徽标、高亮，关闭即清除；不恢复常驻右侧栏、图层树或 Design Tab。
4. 标注和埋点属于两个独立模式。共享 iframe 目标定位及屏幕坐标换算，但不共享列表数据、编辑状态或选择器生命周期。
5. 版本隔离以**页面业务版本**为单位；无限画布内进一步绑定 `boardId` / `nodeId`；编辑器 Runtime 作为工具层统一升级，不能把标记硬编码进业务页面 CSS。
6. 分享必须自包含。Vercel 使用发布时的只读埋点快照，ZIP 包含规范，且提供可离线打开的查看入口；分享不依赖作者 Prota 或任何在线埋点服务。

## 二、已核实的代码现状

| 能力 | 当前代码 | 与本方案的关系 |
| --- | --- | --- |
| Skill 自动发现 | `server/agent-server.mjs` 的 `PROJECT_SKILLS_DIR`、`refreshProjectSkills()` | 根目录 `.claude/skills/{name}/SKILL.md` 自动出现在 Skill 菜单和 `/name` 命令，无须写死到菜单 |
| Skill 管理入口 | `portal/shell.js` 的 `loadAgentSkills()`、`renderAgentSkillMenu()` | 新 Skill 直接复用现有能力；Pi 启动禁用其自身 Skill 发现，但 Prota Gateway 有独立注册表 |
| 右侧抽屉 | `portal/index.html` 的 `annotationDrawer`、`doc-tabs`，`portal/shell.js` 的 `docDrawerMode` | 现有“需求文档/交互标注”两 Tab；增加 `tracking`，不要建第二个抽屉 |
| 标注可视化 | `portal/shell.js` 的 `renderAnnotationMarkers()`、`getMarkerGeometry()` | 已有外层 DOM 标记和 iframe 坐标映射，可抽象复用 |
| 无限画布 | `src/templates/infinite-canvas/app.js` 的 `getBoardFrame()`、`getActiveBoard()`、`prota:canvas-view` | 已能获取 board iframe、定位节点并感知 pan/zoom，当前 Runtime 标为 33 |
| 标注作用域 | `portal/shell.js` 的 `getAnnotationFrameContext()`、`resolveBoardMessageTarget()` | 已有板内 iframe 身份核验，埋点要建立同等级边界，不能只按选择器匹配 |
| 存储/版本 | `AGENTS.md` 与 `src/pages/{project}/{page}/{version}/` | V1/V2 各自完整，业务目录位于工作区而非产品安装目录 |
| 静态分享 | `server/bridge.py` 的 `read_share_annotations()`、分享页/文件夹 payload 组装 | 同样读取 `tracking/events.json` 固化到分享 payload |
| ZIP | `server/bridge.py` 的 `build_page_zip_bytes()`、`portal/modules/sharing/download.js` | 目前 ZIP 包含版本目录与 docs，新增 JSON 自然会进入；可视化离线查看器需另加 |

**特别说明：**当前 Prota 仓库未发现 `/event-tracking` 现成 Skill，因此不能假设其生产埋点协议。这里建立独立的 `/demo-event-tracking`，以后如果要导出到生产埋点平台，再做映射层。

## 三、数据归属与目录

```text
产品安装目录（工具层）
├── .claude/skills/demo-event-tracking/
│   ├── SKILL.md
│   ├── references/contract.md
│   ├── scripts/validate.mjs
│   └── agents/openai.yaml
├── portal/modules/tracking/                 ← 待新增的管理器
├── portal/index.html / shell.js / shell.css ← 增加已有抽屉 Tab
└── src/templates/infinite-canvas/app.js     ← 如需只读检查激活接口再小幅扩展

用户工作区（业务数据）
└── src/pages/{projectId}/{pageId}/
    ├── v1/
    │   ├── index.html / styles.css / app.js
    │   ├── boards/{boardId}/...             ← 无限画布时存在
    │   └── tracking/events.json             ← V1 专有
    ├── v2/
    │   └── tracking/events.json             ← V2 专有
    └── docs/                               ← 原 PRD 保持不变
```

**绝不能**写入 `src/templates/infinite-canvas/` 下的业务事件数据，也不要把埋点写入全局 `data/projects.json` 或 `canvas-data.js`。编辑器 Runtime 的版本号与埋点规范 schema 版本必须独立。

### 3.1 Manifest v1

正式数据约束见 [Skill 合约](../.claude/skills/demo-event-tracking/references/contract.md)，核心结构：

```json
{
  "schemaVersion": 1,
  "scope": { "projectId": "demo", "pageId": "login", "version": "v2", "pageMode": "infinite-canvas" },
  "events": [
    {
      "id": "login_submit",
      "name": "login_submit",
      "title": "提交登录",
      "purpose": "衡量核心登录尝试",
      "question": "用户进入页面后是否愿意尝试登录？",
      "decision": "决定是否降低登录门槛",
      "score": { "impact": 3, "actionability": 3, "gap": 2, "cost": 1, "duplicate": 0, "total": 7 },
      "priority": "P0",
      "signal": "attempt",
      "trigger": { "type": "submit", "when": "有效表单提交；不等于登录成功" },
      "parameters": [],
      "targets": [{
        "kind": "canvas-board",
        "boardId": "login",
        "nodeId": "board-node-id",
        "path": "boards/login/index.html",
        "anchor": { "method": "data-attribute", "value": "login-submit" },
        "confidence": "high",
        "status": "bound"
      }]
    }
  ],
  "omitted": [{ "candidate": "password_focus", "reason": "无法支持实际决策" }]
}
```

### 3.2 事件与标记不是一对一强制关系

- 一个语义事件可绑定多个控件，Tab 中只显示**一条事件**、展开多个目标。徽标序号可以相同（如两处都是 2），点击后自动展开并定位正确目标。
- 业务成功/失败、API 响应等是**逻辑事件**，未必存在可点击控件。其 `targets: []`，列表显示“逻辑事件”，不凭空打徽标。
- 找不到 DOM、匹配多处、目标隐藏或跨域时显示“需确认/不可定位”，严禁悄悄指向一个看似相近的按钮。
- `data-prota-track-id` 仅用于 Review，不能让开发误以为 `click` 已实际上报。

## 四、Skill 自动筛选算法

执行 `/demo-event-tracking` 时：

1. 读取活动上下文与 PRD、业务源码、板内状态、现有事件；理解真实用户任务和业务结果。
2. 枚举候选：关键漏斗进入、核心提交、最终结果、关键失败。**不要从所有 DOM 控件反推“所有点击都要埋”**。
3. 每条必须回答“它解决什么产品问题？统计后能做什么决策？”答不出来直接淘汰。
4. 按 0–8 正向、0–4 负向的评分规则计算 `total`。保留 ≥5；≥7 P0，5–6 P1。推荐 3–8 条；最多 12 条。
5. 同义事件去重，尽量用一个事件加 `method`、`source`、`result` 等有限枚举参数；不收集手机号、邮箱、密码、Token、全文、输入值、完整 URL。
6. 识别准确触发：点击按钮仅代表 **attempt**；流程成功用 **outcome**；无法从 Demo 逻辑确认结果时不声称已触发。
7. 给可见控件增加稳定锚点，尽量不改原样式、JS/事件处理。保留 ID，重跑只做差异修订。
8. 输出 `events.json` 与 `omitted` 淘汰理由；运行 Validator；浏览器可用时逐目标查唯一性。
9. 向用户汇报建议埋点、为何埋、为何不埋、仍未绑定的目标。

例：登录 Demo 通常应优先测“提交尝试 / 验证结果或失败类别”，不会为“切换密码可见、聚焦输入框、展开说明”逐一建事件。实际保留数量依产品目标与页面行为决定，不强行凑数。

## 五、右侧“埋点” Tab：交互规格

### 5.1 入口

- 在 `portal/index.html` 的现有 `.doc-tabs` 内增加 `<button data-doc-tab="tracking">埋点</button>`，顺序：**需求文档 | 交互标注 | 埋点**。
- 已打开的右侧抽屉可切换，其他布局不变；Tab 不是新抽屉。空列表显示“尚未生成埋点”及一个可调用现有 Agent 的 `/demo-event-tracking` 入口（复用既有 Skill 执行，不增加 Agent）。
- 切入 Tab 才启用 Review overlay，离开即销毁标记、事件捕获和 observer；不与交互标注模式并存。
- 在分享模式：只读显示，隐藏生成/编辑入口；没有分享埋点则不显示埋点 Tab，保持原两 Tab。

### 5.2 列表内容

顶部：`当前画板/全部` 筛选、`P0/P1`、已绑定/需确认计数，以及“复制事件清单”操作。默认先展示活动画板的事件，可切全部；当无活动画板时显示全部。

每张卡片：

- 左侧徽标 `①` 与 P0/P1，主标题为中文事件名，副标题为 `login_submit`。
- 1 句话说明“为什么埋”和具体触发时机。
- 展开后显示：产品问题 → 决策用途、触发条件、参数及允许值、页面/画板、DOM 锚点、绑定状态、复制事件名/导出 JSON。
- UI 不展示长篇推理或所有淘汰候选；淘汰汇总放折叠区“已排除 N 个低价值事件”。
- 未定位：黄色“需确认”；逻辑事件：灰色“无控件”；绝不能伪造高亮。

### 5.3 页面标记与点击

1. Tab 激活，Portal 外层 `annotationMarkerLayer` 的相邻独立 `trackingMarkerLayer` 显示小型琥珀色数字徽标及选中轮廓，位置按 DOM `getBoundingClientRect()`，跟随缩放、平移、滚动、动画和 iframe 重载。
2. **点击徽标**：展开对应事件卡片、滚动到可视区域、高亮该行。**点击列表**：激活相应画板、聚焦目标并高亮徽标。
3. **“选择控件”检查状态**默认在埋点 Tab 开启。点击已绑定控件时优先选中清单，不触发实际业务动作（尤其提交/跳转/危险按钮）；只拦截匹配目标的 click/submit/pointer 激活链，避免影响未绑定的 Demo。
4. 用户需要操作原型时切换到“预览交互”；此时页面原有点击、键盘、输入与业务跳转恢复，埋点仅作为只读徽标，不记录用户行为。
5. 禁止把高亮样式、徽标节点或点击拦截代码写入业务 `styles.css`、`app.js`。仅允许安全的 `data-prota-track-id` 标识属性。
6. 对于一个 `submit` 事件若锚点是表单/按钮，仅在选择状态选中控件；**不能把这个选择动作计入用户埋点**。

### 5.4 兼容性与冲突

- `docDrawerMode` 添加 `tracking` 至白名单；`readDocDrawerMode()` 也支持该值，保持工作区级偏好。
- `renderAnnotationDrawer()` 改为协调器，新增 `renderTrackingDrawer()` 分支；保留 PRD/Draw.io/MindMap 的独立生命周期。
- 交互标注开启时退出埋点检查；埋点开启时先安全关闭 Inspector，并恢复其鼠标和快捷键；切 Tab/页面/版本/抽屉关闭全部释放资源。
- `canAgentAndDrawerCoexist()` 将 `tracking` 作为窄抽屉宽度处理，与当前注解一致；窄屏遵循现有 Agent/抽屉互斥规则。
- `isShareMode` 禁止任何 Skill 执行或写入。分享页只读。

## 六、嵌套 iframe 定位实现

**不能只保存 CSS selector。** 无限画布里两个画板都可能有 `.primary-btn`。

目标实际身份为：

```text
projectId / pageId / version
    └── boardId / nodeId / boardPath（无限画布）
          └── anchor.method + anchor.value（该 iframe 的 DOM）
```

实现建议：增加 `portal/modules/tracking/{index.js,manager.js,tracking.css}`，把列表、解析与生命周期从接近 900 KB 的 `portal/shell.js` 分离。

```js
// 示意接口；不是当前已经存在的代码
const tracking = new TrackingManager({
  getContext: () => ({
    projectId: shell.activeProjectId,
    pageId: shell.activePageId,
    version: shell.activeVersion,
    isInfiniteCanvas: shell.isInfiniteCanvasPage(),
    isShareMode: shell.isShareMode
  }),
  resolveBoard: (nodeIdOrBoardId) => shell.getCanvasBoardFrame(nodeIdOrBoardId),
  getMarkerGeometry: (element, context) => shell.getMarkerGeometry(element, context),
  focusBoard: (nodeId) => shell.mainIframe.contentWindow.protaCanvas.focus([nodeId])
});
```

核心职责：

- `load(context)`：本地 fetch 版本 JSON，分享从 `shareConfig` 或文件夹当前页 metadata 读取；校验 schema 和 scope；失效前次请求用 `AbortController`。
- `resolveTargets()`：普通页面用 `mainIframe.contentDocument`；无限画布从 `protaCanvas.getBoardFrame(boardId/nodeId)` 取得嵌套 iframe。优先 `[data-prota-track-id="..."]`，fallback selector 要求唯一，失败记 `needs_review`。
- `renderMarkers()`：独立 overlay；复用现有 `getMarkerGeometry()` 的 50%/100%/200% 缩放与板内裁切算法；`requestAnimationFrame` 合并刷新。
- `selectEvent(id,targetIndex)`：双向选中、滚动卡片、局部目标高亮，定位失败给提示。
- `attachInspectFrame(frame)`、`detach()`：监听目标 click、keydown、必要的 pointerdown/submit，捕获期阻止被选目标的业务动作；普通预览模式完全不拦截。iframe load、board 切换、版本切换重绑；`AbortController` 清理监听。
- `destroy()`：清 overlay、observers、定时器、事件监听、状态，防止历史画板泄漏。

如果在未激活画板上无法直接交互，给 `src/templates/infinite-canvas/app.js` 的 `window.protaCanvas` 增加**只读检查激活**方法 `enterReviewBoard(nodeId)`、`exitReviewBoard()`，只切换查看态，不触发画板编辑/保存/撤销。沿用现有 Runtime 升级路径，按当前 33 → 后续实际版本号递增，**不要硬编码 V5/V8**。保留 `canvas-data.js`、`boards/`、`assets/`、`annotations.json`、`tracking/events.json` 原字节；遇未保存草稿延迟升级。

安全边界：只处理同源、当前页面、当前版本、当前 board iframe 的事件。跨域 iframe 标记为不可定位；不透传 DOM 全文，不信任来自其他板的 `postMessage`。若离线 `file://` 环境不能跨 iframe 读取 DOM，则仅在**构建产物**注入受限的只读 Bridge，不向源业务文件注入。

## 七、分享与 ZIP 自包含方案

### 7.1 Vercel 静态分享

1. 在 `server/bridge.py` 增加 `read_share_tracking(version_dir)`，读取并验证 `tracking/events.json`（限制大小与个数，安全失败为空并报告 warning）。
2. 单页面分享与文件夹分享 payload 均加入 `tracking`，固定在生成时，和现有 `annotations`、`prdContent` 同级。
3. 现有 `window.__READIFY_SHARE__` 传递只读版本快照；`portal/shell.js` 读取该快照，而不是请求作者本地文件。
4. 分享站点只使用发布时的 Demo、Runtime、埋点规范。复用已有密码、有效期与资源白名单，不额外开一个公开 API，也不泄漏开发路径。

### 7.2 下载 ZIP / 离线文件

`build_page_zip_bytes()` 已递归打包版本目录，所以 `tracking/events.json` 自然随包交付；但**单有 JSON 不等于离线可视化**。

需要在 ZIP 中新增 `review.html` + 本地脚本/样式，打开后可以左侧预览 Demo、右侧查看埋点清单和徽标。现有版本 `index.html` 仍直接可运行，不能被覆盖。把 JSON 内容以内嵌只读方式放到 viewer，避免 `file://` 的 fetch 限制。

对 `file://` 下跨源限制：在构建 ZIP 的临时副本中注入极小的 Review Bridge，用受限消息协议把目标 rect 与点击选择回报给 `review.html`；只接受已知 iframe `event.source`、预期版/板与会话 nonce；不依赖 localhost、CDN、分析 SDK 或 Prota。这个步骤只改**打包副本**，绝不写回用户的业务源码。离线冒烟测试要分别验证 Chromium 和 Safari（至少一个系统），不能把普通浏览器本地文件权限当成既定可行。

若当前发布管线为新旧双 Runtime 并存的过渡阶段，应把 Review viewer 跟发布内容一起按哈希锁定，不能使用以后会变的全局 Portal 资源。历史分享不回填新埋点，也不改变其既有页面。

## 八、工程施工顺序（按顺序做，可拆 PR）

| 阶段 | 具体修改 | 交付验收 |
| --- | --- | --- |
| S0 已完成 | 新建 `.claude/skills/demo-event-tracking/{SKILL.md,references/contract.md,scripts/validate.mjs,agents/openai.yaml}` | Prota Gateway 能自动发现 `/demo-event-tracking`；Validator 通过 |
| S1 已实现 · 数据加载 | 新建 `portal/modules/tracking/manager.js` 与 manifest parser；在 `shell.js` 注入活动上下文 | 切项目/页面/版本只载入当前 JSON；格式错误可见，空数据正常 |
| S2 已实现 · 抽屉 | `portal/index.html` 新 Tab；`shell.js` 的 mode 白名单、Tab 事件、drawer renderer；`shell.css` 样式 | 三 Tab 互切，无新常驻栏、无 PRD/标注退化 |
| S3 已实现 · 控件定位 | 复用 `getCanvasBoardFrame()` 与 `getMarkerGeometry()`，独立 overlay、列表→控件、控件→列表 | 双层 iframe、跨板同名 selector、滚动/缩放/重载精准 |
| S4 已实现 · 检查态 | 增加选择控件/预览交互状态；必要时 `app.js` 扩展 `enterReviewBoard()` | 默认点击不会触发提交；关闭状态原交互完全恢复；撤销栈/业务文件不变 |
| S5 已实现 · 分享 | `server/bridge.py` 读 manifest 写入单页/文件夹分享 payload；ZIP 追加离线 `review.html` | Vercel、ZIP 均只读、版本锁定、脱离本机独立打开 |
| S6 已实施 · 回归 | 新增追踪单测/真实浏览器测试；验证旧版本、保存、分享、标注 | 验收矩阵全部通过，正常 Demo 无埋点时与之前一致 |

以上 S0–S6 已合并在本功能 PR 的提交历史中；保留逐阶段结构以便代码审核与回归。

### 8.1 必做测试

新增：

- `tests/demo-event-tracking.test.mjs`：schema、评分/上限、重复 ID、非法路径/参数、0 事件、旧规范兼容。
- `tests/demo-event-tracking.browser.mjs`：普通 Demo 与无限画布两板、同名 CSS、画布缩放 50/100/200、平移、滚动、iframe 重载、目标隐藏/删除、选择列表与徽标、模式切换恢复原交互、跨域拒绝。
- `tests/demo-event-tracking-share.browser.mjs`：单页/文件夹 Vercel payload 固定快照、只读 Tab、ZIP `review.html` 离线打开、无需 localhost；分享密码保护不退化。
- `tests/test_demo_event_tracking_share.py`：Bridge 读入、安全路径、包内侧文件校验、旧分享/空清单。

复用现有回归测试：

```bash
node --check portal/shell.js
node --check src/templates/infinite-canvas/app.js
node --test tests/pi-skills.test.mjs tests/canvas-version-model.test.mjs
node tests/infinite-canvas-annotation.browser.mjs
node tests/board-versions.browser.mjs
node tests/share-creation.browser.mjs
node tests/share-download.browser.mjs
python3 -m unittest tests/test_canvas_store.py tests/test_canvas_versions.py tests/test_canvas_export_versions.py tests/test_share_security.py
git diff --check
```

具体浏览器测试命令需按开发环境的 Bridge/Agent 启动要求执行；不可仅通过语法检查宣布功能完成。

### 8.2 验收清单

- [ ] Skill 在 Prota 首页 Skill 菜单和 `/demo-event-tracking` 均可执行，不依赖 Pi 原生 Skills。
- [ ] 同一个 Demo 再生成只更新必要差异；同名业务事件保持同 ID；低价值候选被解释并淘汰。
- [ ] 每页事件数量 ≤12，P0/P1 评分正确，敏感信息不进入参数。
- [ ] 埋点 Tab 中列表、数字标记、点击选中与反向定位一致；无元素的逻辑事件没有假标记。
- [ ] 独立画板以 `boardId` 精确定位；两个板有相同 DOM selector 时无串板。
- [ ] 切换 Tab/版本/页面后监听与 DOM 全部清理；交互标注/PRD/Agent 功能不受影响。
- [ ] V1 不因 V2 更新被改写；分享固定快照；ZIP 可离线独立打开。
- [ ] 无实际数据上报、无新的后端数据库、无新增服务器费用、无对 Agent 生成质量的侵入。

## 九、风险与明确的解决策略

| 风险 | 处理 |
| --- | --- |
| 选择器依赖 DOM 结构，Agent 重生成后失效 | 首选 `data-prota-track-id`；重生成复核并标记 `needs_review`，不自动猜测 |
| 强行给所有按钮打点造成膨胀 | 价值评分阈值 + 3–8 推荐/12 硬限 + `omitted` 淘汰表 |
| 无限画布的外层工具被误埋 | 仅检索业务 board iframe；manifest 强制 `boardId`；不允许 `canvas` 外壳 target |
| 标注与检查态快捷键、pointer 冲突 | 两模式互斥，分别维护 `AbortController`，切 Tab 清理 |
| 浏览器缩放/跨层 iframe 坐标错位 | 复用标注现有缩放映射，增真实浏览器多比例测试 |
| 旧版本与分享被编辑器升级污染 | JSON 按业务版本存储；Runtime 升级仅更新编辑器文件；分享按发布哈希锁定 |
| file:// 禁止父窗口直接读取子窗口 DOM | 打包产物 Review Bridge + 静态内嵌 Manifest；在真实浏览器测试 |
| “生成了埋点”被误读为“已经埋代码、产生统计” | UI 明示“埋点方案（待开发接入）”，所有交付文件不含采集 SDK |

## 十、最终交付形态

开发者拿到某个版本的分享链接后，不用连接创建者电脑：打开 Demo → 右侧“埋点” → 点击列表直接定位控件 / 点击控件查看事件定义 → 复制事件名、触发条件与参数；如果是逻辑结果，则看清它所属的页面和触发条件。

**这使 Prota 从“只交付可见原型”增加到“交付原型 + 可审核埋点方案”，而不是变成运行数据分析平台。**

## 十一、2026-11-05 实施记录

**当前分支**：`feat/demo-event-tracking-skill-plan`，对应 PR #5。没有直接修改 `main`，也没有修改用户工作区内任何现有业务版本。

### 已落地源码

- `.claude/skills/demo-event-tracking/{SKILL.md,references/contract.md,scripts/validate.mjs,agents/openai.yaml}`：Demo 埋点生成与验证。
- `portal/modules/tracking/index.js`：独立 TrackingReview 管理器，版本校验、清单呈现、DOM 属性/selector 唯一定位、标记层、点击检查/预览切换、监听释放、画板上下文隔离。
- `portal/index.html`、`portal/shell.js`、`portal/shell.css`：复用右侧文档抽屉新增第三个“埋点”Tab，使用独立 overlay，不修改业务画板的交互和样式。
- `server/bridge.py`：在静态单页/文件夹发布 payload 中固化 `tracking`，下载 ZIP 中包含 `review.html`。
- `server/demo_tracking_review.py`：ZIP 构建时生成离线审阅器，只对 ZIP 内的 HTML 副本注入受限消息桥，保留原工作区文件原样。
- `tests/demo-event-tracking.test.mjs`、`tests/test_demo_tracking_review.py`、`tests/demo-event-tracking.browser.mjs`、`tests/demo-event-tracking-portal.browser.mjs`：结构、离线通信与真实 Portal/Bridge 集成。
- `.github/workflows/demo-event-tracking.yml`：自动运行 JavaScript/Python 静态校验、单测及 Chromium 浏览器测试。

### 验证与限制

- GitHub Actions **Demo Event Tracking** 流程已完成普通 Demo、离线 ZIP 与真实嵌套 iframe 测试；请以 PR 最新 commit 对应的 Actions 结果为合并准则。
- Skill 是**按需执行**而非每次创建页面自动埋点；需要在 Agent 调用 `/demo-event-tracking` 生成对应版本清单。
- 该模式只交付方案，不进行真实 SDK 上报；无后端事件接收服务。
- 静态链接只能审阅发布时快照，不应期待实时同步作者工作区。
- 跨域第三方 iframe 不做侵入式检查；无法唯一定位的目标应在清单里标记“需确认”。
- 此次未重构 `src/templates/infinite-canvas/app.js`，直接复用其现有 `getBoardFrame` / `focus` 与标注的几何映射能力；没有更改 Runtime 版本号。
