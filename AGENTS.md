
# Demo 项目规约

## 1. 目录结构强制要求

- 所有 Demo 页面必须放在：`src/pages/{project_id}/{page_id}/{version}/`
  - `project_id`：当前活动项目的唯一标识；Portal 发起任务时，以运行上下文中的 `projectId` 为准
  - `page_id`：唯一标识（如 `reader`, `library`）
  - `version`：小写 `v` + 数字（如 `v1`, `v2`）
- 普通 Demo 每个版本目录**完全自包含**：必须有自己的 `index.html`, `styles.css`, `app.js`；无限画布采用第 2 节的共享编辑器与独立业务文档规则
- **严禁**跨版本引用 CSS/JS 文件

## 2. 页面端类型

- `data/projects.json` 中每个 page 记录必须有 `targetDevice`：
  - `mobile`：手机端页面，使用 `src/templates/mobile-frame/`
  - `web`：Web 页面，使用框架无关的 `src/templates/web-frame/`
  - `canvas`：自由画布，使用中性的 `src/templates/canvas-frame/`；不强制设备外框或 UI 框架
- 历史页面、缺失 `targetDevice` 的页面一律视为 `mobile`，同步配置时需要补上该属性。
- 创建项目时不选择端类型。**所有新建页面统一创建无限画布**，顶层保存 `targetDevice: "canvas"`、`pageMode: "infinite-canvas"`。
- Agent 在内部根据需求智能判断各业务画板适合手机 H5、桌面 Web、自定义尺寸还是混合展示；模板只为业务画板提供视觉/组件参考，不决定页面模式，也不改变编辑器样式。
- `mobile`、`web`、旧 `canvas` 的端类型继续用于读取历史页面；后续迭代沿用历史页面已有方式，不重新推断或批量改写。

### 页面级无限画布

- 无限画布是所有新页面的统一模式：保存 `targetDevice: "canvas"`、`pageMode: "infinite-canvas"`，只复制 `src/templates/infinite-canvas-document/` 的轻量文档入口。编辑器由产品共享 Runtime 提供，不复制或修改页面内的编辑器 JS/CSS；编辑器唯一源码为 `src/templates/infinite-canvas/`，启动器为 `src/canvas-runtime/boot.js`。分享和 ZIP 由统一打包器固定并内置 Runtime。既有 `canvas` 页面继续使用中性 canvas-frame，不自动升级。
- 内部画板和素材属于当前页面版本；画板代码放 `boards/{board_id}/`，图片放 `assets/`，布局保存为 `canvas-data.js`。不将内部画板注册为顶层页面。
- 迭代、下载和分享包含完整版本目录。修改前读取最新布局，保留无关对象与稳定 ID；不覆盖浏览器未保存的布局。

## 3. 迭代版本（用户说“迭代版本”时）

1. 确定新版本号 = 当前最大版本号 + 1（例：`v2` → `v3`）
2. 复制整个当前版本目录（如 `v2/`） → 新目录（如 `v3/`）
3. **必须更新两处配置**：
   - `projects.json` 中的 `versions` 数组
   - `portal/shell.js` 中的 `defaultData` 对象（支持 `file://` 协议离线访问）
4. 之后所有修改**只改新版本目录**，旧版本保留不动

## 4. 新增页面（用户要求“新增页面”时）

1. 在 `src/pages/{project_id}/` 下创建：`{new_page_id}/v1/`；`project_id` 必须使用 Portal 运行上下文中的当前活动项目，不得硬编码 `readify`
2. 只复制 `src/templates/infinite-canvas-document/` 作为首版文档入口，编辑器由产品共享 Runtime 提供；根据需求创建一个或多个 `boards/{board_id}/`，每个业务画板有独立 HTML/CSS/JS 并关联 `canvas-data.js`，支持混合手机、Web、自定义形式。
3. 在 `projects.json` 和 `portal/shell.js` 的 `defaultData` 中注册一个新页面，设置 `targetDevice: "canvas"`、`pageMode: "infinite-canvas"`；画板不注册为顶层页面。用户选择模板时仅读取相关设计规范并应用于合适的画板。

## 5. UI 交互规则

- 版本切换器：使用**顶部下拉菜单**
- 每个 Demo 必须加载在 `<iframe>` 中（保证样式隔离）
- 移除“多端切换”功能，响应式由各 Demo 自己实现

## 6. 关键配置文件（每次操作后检查）

- `projects.json`：记录所有页面和版本
- `portal/shell.js`：其中的 `defaultData` 对象必须与 `projects.json` 保持同步
- 项目根目录没有 `shell.js`；不要读取或修改 `/shell.js`，所有 Shell 相关修改都在 `portal/shell.js`

## 7. Web 框架模板 Skill 隔离

- Portal 支持的 Web 框架模板 Skill 必须放在 `src/templates/framework-skills/{skill_id}/`，不得放入 `.claude/skills/`。
- 此目录只收纳 `NEW_PAGE_WEB_FRAMEWORKS` 实际使用的 Web 框架 Skill，不放移动端框架包或自动路由器。
- `.claude/skills/` 只存放首页 Skill 管理和 Agent Skill 选择中可见、可主动触发的普通 Skill。
- 模板 Skill 不参与全局自动发现；只有创建 Web 页面且 Portal 已选定框架时，才能按 `portal/shell.js` 中 `skillPath` 指向的精确路径读取。
- 新增或更换框架模板时，必须同步更新 `NEW_PAGE_WEB_FRAMEWORKS` 的 `skillPath`，并检查该路径不位于 `.claude/skills/`。


## 8. 产品代码与业务工作区隔离

- 当前工作区由 `~/.config/prota/workspace.json` 或 `READIFY_WORKSPACE` 指定；业务路径均相对于该工作区。
- `src/pages/`、业务 `data/projects.json`、会话、附件、PRD、分享产物只写入工作区，不写入产品安装目录。
- 第 3、4、6 节的双份配置同步指工作区内的 `data/projects.json` 与工作区内 `portal/shell.js` 元数据快照。产品安装目录的 `portal/shell.js` 只保留空白默认数据。
- 内置模板与普通 Skill 从产品安装目录读取；不得复制或改写业务数据到模板示例。
- 静态分享使用独立 Build Output 目录直接部署 Vercel，禁止通过产品 Git 仓库发布业务内容。
- 开源使用 `tools/public-release.py` 白名单导出并审查，禁止继承旧业务仓库历史。


## 9. 界面表达原则

- Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.（避免不必要的次要标签和描述，让布局本身来传达信息。）


## 10. 人工文案修改保护

- 人工直改通过 `/api/copy-edits/v2` 写入真实业务源码，只有重新加载验证通过才显示“已保存”。不得新增 `READIFY_COPY_PATCHES` 或其他 DOM 文案覆盖补丁冒充源码持久化。
- `data/user-edits.sqlite3` 与 `data/user-edit-assets/` 是工作区的长期恢复材料。Agent 不得改写、删除、清理或打包公开这些内容；整工作区迁移需通过 SQLite backup API 保留 WAL 中的记录。
- Agent 运行通过持久租约与后置扫描协调人工编辑；出现冲突须保留原/新文案和源码快照并在修改历史中提示。不得用整文件回滚覆盖之后的合法修改。
- 无限画布根运行时不是业务文案目标；内部画板直改在精确身份与源码定位验收之前保持关闭。发现旧补丁时，先备份与审查，再决定迁移，不得随升级直接移除。
## 11. Prota 产品 UI 规范与自审（必读）

- 对 **Prota 产品自身 UI**（Portal 首页、Agent 工作台、设置、分享、PRD、流程图外壳、无限画布编辑器工具层）做设计、开发、改版或评审前，先读 `docs/prota-ui-guidelines.md`；当前设计债务与迁移边界见 `docs/prota-ui-audit-2026-11-10.md`。
- 新 UI 默认复用根 Token、现有产品组件和交互范式。新增另一套强调色/按钮/弹窗、重复的常驻侧栏、无意义说明文字或末尾 `!important` 补丁时，必须给出必要性并消除冲突。
- 开发完成后必须执行规范第 7 节 **Review → 修复 → 复检**：记录 P0/P1/P2 证据，修复 P0/P1，检查实际渲染、重要状态、键盘操作与适用视口。只做静态代码检查不得宣称 UI 已通过。
- 用户说“UI 不好看”“不统一”“按规范 review / 优化”时，直接按第 7 节对**本次涉及的产品 UI** 自审与修复，输出差异、修改文件和验证结果；不只给口头建议。
- 本规范**不强制套用于用户生成的业务 Demo、画板 HTML/CSS/JS、品牌模板**。这类内容仍按用户指令和所选设计系统自主设计；产品 UI 调整不得改动历史业务页面、破坏 iframe 样式隔离、版本独立和静态分享。
- UI 实现以 `design-system/product.tokens.json` 为唯一 Token 源，组件参考 `portal/ui/components.css`，交互预览见 `portal/ui/showcase.html`。修改 Token 后运行 `npm run ui:tokens`，不要直接编辑生成文件。完整架构说明见 `design-system/README.md`。
- 产品 UI PR 必须运行 `npm run ui:tokens:check`、`npm run ui:test` 与增量 `npm run ui:lint -- --base <base-ref>`；可见 UI 变更还需运行 `npm run ui:browser`，对实际功能页面补充截图和状态/交互回归。自动检查只覆盖规则子集，不代替视觉评审。
