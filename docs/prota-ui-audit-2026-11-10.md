# Prota UI 基线审计（2026-11-10）

> 基于 `lefinite/Prota` `main` 提交 `23eb68b0ab1863ee6bca6b94c6efa20251c45d5f` 的静态代码审查。目标是识别产品 UI 体系、设计债务和迁移顺序。**尚未在多视口启动完整应用或验证实际截图**，因此以下是代码层面的事实与风险，不将推测写成已复现的视觉 Bug。

## 1. 审查范围

检查了整个仓库目录树，并重点阅读：

- `AGENTS.md`、`docs/unified-settings-design.md`、`docs/canvas-upgrade/**`、`src/templates/infinite-canvas/README.md`；
- `portal/index.html`、`portal/shell.css`、`portal/shell.js` 的导航、首页、工作台、弹窗与 Agent 相关区域；
- `portal/modules/settings/`、`sharing/`、`prd/`、`drawio/`、`mindmap/` 的主要 CSS 与部分交互实现；
- `src/templates/infinite-canvas/` 的编辑器样式/结构、`src/templates/{mobile-frame,web-frame,canvas-frame}/` 的分层规则；
- `.claude/skills/create-new-page/SKILL.md`、`frontend-design/SKILL.md` 与模板设计目录结构。

**关键边界**：`src/templates/design-systems/` 是用于生成各类业务 Demo 的风格库，**不是 Prota 产品 UI 的统一配色规范**。业务画板的 HTML/CSS/JS 必须与产品外壳分离。本文主要审计 Prota 产品自身，而非给每个生成样例打分。

## 2. 当前已经存在、应保留的好基础

1. `portal/shell.css:7–28` 已有浅色工作台基础变量（背景、主次文本、强调色、边框、布局宽度）；无需从零造一套设计语言。
2. `docs/unified-settings-design.md` 已明确“浅色、克制、稳定、信息密度中等”的设计方向；`portal/modules/settings/` 已把多个配置入口收进统一窗口。
3. `portal/modules/drawio/editor-prota.css` 只覆盖 draw.io 应用外壳，注释明确不改变图形与文档颜色；这是正确的隔离原则。
4. `src/templates/infinite-canvas/README.md` 已确立无常驻侧栏、底部创作工具、上下文工具栏、右键菜单与命令面板；还约束了选择状态、撤销/恢复、分享和版本隔离。
5. 多处已有 `:focus-visible`、`prefers-reduced-motion`、`aria-*`、Escape 处理，说明不需要重建交互模式，而需要补齐一致性。

## 3. 主要不一致与技术原因

| 级别 | 发现（代码证据） | 判断 | 建议 |
| --- | --- | --- | --- |
| P1 | `portal/shell.css` 根 `--accent:#6366f1`，`src/templates/infinite-canvas/styles.css:10` 又设 `--accent:#5765ce`；`portal/modules/drawio/editor-prota.css` 再复制一套 `--primary-color:#6366f1` | 产品外壳强调色已有分叉；第三方适配无法自动跟随统一 Token | 保留 iframe 隔离，但为**产品运行时**建立一致的语义映射；不改用户业务画板主题 |
| P1 | 主 `.btn`（`portal/shell.css:2648` 起）、首页 `.home-action-btn`、`.project-card__open`、设置 `.us-primary/.us-secondary`、分享 `.sm-dialog button`、画布通用 `button` 都有自己的高度、圆角、悬停 | 同语义控件没有稳定的尺寸/状态合同，新增模块自然继续复制 | 先统一 Button/IconButton/Input 规则，允许工具栏紧凑变体，不强行合并所有 DOM |
| P1 | `portal/shell.css` 中多轮首页改版叠加：如 `:9368` 初版主按钮、`:11237` “Final management-page refinements” 使用 `!important` 覆盖先前黑色主按钮；后续还有 `:11621` 起的卡片细调 | 样式优先级依赖加载顺序和后置补丁；局部修改可能不生效或影响其他页面 | 按组件归并最终生效规则；每次迁移前对同一视图截图对照，分批删除过时覆盖 |
| P1 | `portal/shell.css` 约 **238 处 `!important`**；`portal/index.html` 约 **15 处 `style=` 属性（含编辑/弹窗布局） | 维护风险高，难推断最终样式；并不等于这些规则全部错误 | 新 UI 不再扩大数量；旧区域改动时记录最终生效选择器，消除冲突后再移除补丁 |
| P1 | `portal/shell.css` 常用 `0.68–0.78rem`，也出现 `0.62rem`；在通常的 16px 根字号下约 **9.9–12.5px** | 密集工具区的可读性边界不统一，部分常规信息可能过小；实际体验需截图复核 | 设 12px 辅助文字与 13–14px 正文基线，仅极少量元数据允许 11px |
| P2 | 对话框：`portal/modules/settings/settings.css` 的 1060px 设置窗口/16px 圆角，`sharing/dialog.css` 的 440px/14px，`sharing/manager.css` 的 860px/14px，以及 `shell.css` 的确认框 | 宽度因任务不同是合理的；但标题、按钮、关闭、边距与层级缺少共用合同 | 保留内容驱动宽度，统一 Header/Action/Focus/关闭规则，不强制所有弹窗同宽 |
| P2 | `portal/modules/settings/settings.css` 在 `portal/index.html:12` 早于主 `shell.css:13` 加载；各模块对根变量有 fallback 或硬编码，`drawio` 与 `infinite-canvas` 各维护本地 Token | 局部样式对选择器特异性与加载顺序敏感，视觉重构很容易“这里改了，那里没变” | 明确共享 Token 与模块前缀规则；迁移后用截图/计算样式验证，而不是盲目全局替换 |
| P2 | 图标：主界面含多个手写 SVG；无限画布 README 使用本地 Lucide；部分按钮仅图标并依赖 `title` | 图标源不是一个，尺寸、描边、tooltip/键盘描述易分叉 | 收敛 16/18px、1.75–2px 描边、无障碍名称与点击热区；优先复用已有图标 |
| P2 | `.claude/skills/frontend-design/SKILL.md` 鼓励“大胆美学、强视觉差异”，与 Prota 产品 UI 的低噪声视觉方向不同 | 若 Agent 无边界地把生成页面指导用到产品工具层，容易产生新的风格孤岛 | `AGENTS.md` 明确产品 UI 规范优先；生成业务 Demo 不继承产品配色 |

### 不要错误归因

- `#1F2937` 等中性色有时用于文本、历史按钮或辅助组件；**不能机械地把所有颜色替换成紫色**。
- 无限画布 iframe 隔离本身正确，风险在**编辑器产品外壳视觉分叉**以及运行时复制后的升级传播机制，而不是要求所有业务画板使用相同设计。
- 仅有静态证据，尚不能断言每个弹窗有焦点 Bug、每个 10px 文案都不可读；这些需真实交互与截图确认。
- 本次不批量修复历史界面、不重写业务 Demo 或自动合并产品运行时，以免影响版本隔离和静态分享。

## 4. 推荐治理顺序（每步独立验证）

### S0：立即生效（本次完成）

- 增加 `docs/prota-ui-guidelines.md` 作为产品 UI 目标规则。
- 在根 `AGENTS.md` 挂接 Review 闭环，使后续 Agent 研发默认读取，并对不满意的新 UI 自查与修复。
- 将本审计作为当前代码债务基线，区分“已实现”与“规范目标”。

### S1：统一最容易看出差异的产品组件（建议后续专项）

1. 先梳理真实 DOM、视觉截图和计算样式，建立共用 Button/IconButton、Input/Select、Dialog/Popover、Toast、Card 的变体与状态矩阵。
2. 优先收敛 `portal/shell.css` 与 `portal/modules/settings/`、`sharing/` 的产品外壳视觉。每次只迁移一个组件族。
3. 将新组件固定在统一语义 Token 下；第三方 draw.io 通过映射变量适配，保留自身画布样式。

### S2：消除多轮叠加 CSS

1. 用 DevTools `getComputedStyle` 和规则来源确认最终样式，记录来源与兼容依赖。
2. 合并后置 `!important` 与旧规则，去除废弃选择器；不要用全局替换 238 个 `!important` 这种高风险改法。
3. 用项目、模板、Skill 三个首页 + Agent 工作台 + 设置 + 分享 + PRD 的回归截图对比确认。

### S3：无限画布产品 Chrome 同步

1. 仅统一画布编辑器工具栏、菜单、弹窗、状态提示的颜色/字号/间距；业务画板继续自定义。
2. 通过共享运行时/模板升级策略传播产品工具改进，验证历史页面的内容不变，导出的 ZIP / 分享页面仍独立运行。
3. 验证选中对象、右键标注、保存/恢复、画板版本、分享/导出路径，禁止以“视觉一致”为名覆盖内容。

## 5. 今后每次 UI PR 的证据要求

- 明确变更属于 **产品 UI / 第三方外壳 / 用户生成 Demo** 的哪一种。
- 对照规范提交按严重度排序的差异表（文件/选择器、实际结果、修复办法）。
- 提供实际渲染的前后截图或可复现录屏，并注明视口；对支持窄屏的区域检查窄屏。
- 记录默认/hover/焦点/禁用/加载/错误/空态中**适用的**状态，键盘和中文长文本。
- 说明是否改了共享 Token、是否新增 `!important`、是否触及产品运行时/业务画板隔离。
- 跑与本次改动有关的真实回归；未运行需明确说明，不得以静态检查冒充交互通过。

## 6. 二次 Review：从规范文档到可执行体系

上一版仅有文字规范和 `AGENTS.md`，缺少可被代码与 CI 执行的设计系统。二次 Review 补齐：

| 缺口 | 本次落地 | 仍需继续治理 |
| --- | --- | --- |
| Token 不是代码单一来源 | `design-system/product.tokens.json` + 生成 `portal/ui/tokens.css`；兼容旧变量 | 旧 CSS 大量硬编码与 `!important` 尚未逐一迁移 |
| 主按钮颜色缺少对比度检验 | 品牌色 `#6366F1` 与白字约 4.47:1；新主按钮使用 `#4F46E5`，约 6.29:1；有自动对比度测试 | 旧 `.btn-primary` 等使用 `--accent` 的按钮仍需分组件修正 |
| 新组件无复用入口 | 新增有作用域的 `.pui-*` Button/Input/Dialog/Card 原语及交互参照页 | 旧设置、分享、PRD 等 DOM/样式需按模块有测试地替换 |
| 画布和第三方外壳 Token 分叉 | 同一生成器同步无限画布自包含 CSS 与 draw.io 外壳映射 | 历史版本运行时与共享工具层更新需按兼容策略验证 |
| AI Review 无硬性检查 | 变更行静态 Lint、Token 同步检查、颜色对比度/隔离规则测试、PR 清单、GitHub CI | 真实功能页面的视觉美感与交互完整性仍需 Agent/人工审查 |
| 开源发布可能丢文件 | 更新 `tools/public-release.py` 白名单包含 Token 源、规范和新测试 | 完整发布包仍需独立做一次端到端校验 |
| 分享页相对路径会错位 | `server/bridge.py` 将 `ui/*.css` 绝对化到 `/portal/ui/`，并添加生成分享页的集成测试 | 仍须在正式分享域名上检查实际页面加载 |

新增验证命令：`npm run ui:tokens:check`、`npm run ui:test`、`npm run ui:lint`、`npm run ui:browser`。浏览器检查截图来自 `portal/ui/showcase.html` 的**组件契约页**，不能冒充项目首页、Agent 工作台或旧设置界面的视觉回归。

这一步建立了防止**新增**不一致的系统；**不等于** 238 处旧 `!important` 已清零，也不等于所有旧模块都已换成 `pui-*`。后续大规模旧 UI 迁移应按 S1–S3 的截图、行为回归和分享兼容测试推进。
