---
name: create-new-page
description: 在当前项目中新建可运行的无限画布首版原型，由 Agent 自动判断内部手机 H5、Web、自定义或混合画板，支持可选视觉模板与 Web 框架参考。适用于“新增页面”“创建页面”“加一个页面”；不负责现有页面优化或迭代版本。
---

# 创建新页面

在当前项目中新建页面并交付可交互的首版 Demo。对用户说明与页面文案默认中文；标识符和文件名使用英文。

## 统一创建模式

**所有新建页面都使用无限画布**。顶层页面始终保存 `targetDevice: "canvas"`、`pageMode: "infinite-canvas"`；手机 H5、桌面 Web、自定义布局只是内部画板的表现形式，不能注册为独立顶层页面，也不能写入顶层 `targetDevice`。

1. 根据用户需求和项目上下文判断**每个画板**的合适尺寸、内容、交互与位置。手机 App 流程适合手机尺寸的 H5 画板；网站与管理后台适合桌面 Web 画板；小组件、设计系统、对比与实时配置等适合自定义画板；同一画布可混用。
2. 单界面需求只创建一个业务画板；明确列出多个界面则创建所需的各画板；完整业务流程自主决定合理界面数量。不要凑数量、简化生成质量或要求用户逐个重复操作。
3. 用户明确的文字要求高于 Agent 推断；没有指定的技术选型与视觉方向完全自主决定。不要把旧 `mobile-frame` / `web-frame` / `canvas-frame` 当作新的顶层页面类型。
4. 生成的 HTML、CSS、JS 及交互不被预设 UI 框架或设备外框限制；局部可以出现设备外观，画布本身不要套上手机框。
5. 模板只约束合适业务画板的视觉表达，**不得改变画布编辑器的工具栏、右键菜单、样式**。未选模板即为 Agent 智能选择，不受旧缓存选项影响。

### 可选模板

- **视觉风格**：当 Portal 给出 `### 选定的视觉模板` 时，读取该模板的 DESIGN.md、USAGE.md 及必要设计资源；把 Token、排版与视觉语言应用到适合的业务画板。模板原先按“移动端”归类不意味着新画布只能创建手机画板。
- **Web 框架参考**：当 Portal 给出 `### 选定的 Web 框架参考` 时，读取精确指定的 `src/templates/framework-skills/{id}/SKILL.md` 和 [Web 框架执行规则](references/web-framework.md)。所选框架的设计语言与组件行为应用于适合的 Web 画板，其余画板仍由 Agent 自主设计。
- 不得同时混用多套 Web 主 UI 框架，不得把模板资源放到业务版本外或引入运行时对 Skill 文件的引用；参考框架需要转成画板自己的静态 HTML/CSS/JS。

## 运行上下文与交付约束

- Portal 执行上下文中的 `projectId` 是当前项目的唯一依据，不从配置重新推断；没有上下文时才读取工作区 `data/projects.json` 的 `activeProjectId`，无效时取第一个未删除项目，禁止硬编码 `readify`。
- 模板和内置 Skill 从产品安装目录读取；页面、配置、会话和附件写入运行上下文指定的工作区，不写入产品安装目录。
- 新页面创建于 `src/pages/{project_id}/{page_id}/v1/`。未给定 `page_id` 时按功能取唯一的语义化英文标识。
- 每个版本自包含无限画布 Runtime 和全部 `boards/`、`assets/`；每个业务画板自包含 `index.html`、`styles.css`、`app.js`。不得跨页面或版本引用 CSS/JS，运行时不引用模板或 Skill 目录。
- 同步工作区 `data/projects.json` 与工作区 `portal/shell.js` 的 `defaultData` 元数据快照，保存 `targetDevice: "canvas"`、`pageMode: "infinite-canvas"`。产品安装目录的 `portal/shell.js` 保持空白默认数据。
- Demo 仍在 iframe 内加载，保留版本切换、标注、截图和分享能力。

## 实现无限画布

- 是项目下的一种页面模式，不是项目总览。注册为一个 page，保存 `targetDevice: "canvas"` 和 `pageMode: "infinite-canvas"`；不得把 infinite-canvas 写进 targetDevice。
- 完整复制产品安装目录 `src/templates/infinite-canvas/` 到新页面版本目录，并阅读其中 README.md；保留编辑器工具栏、布局保存和交互。
- 在 `canvas-data.js` 中添加画板与素材对象。画板业务界面在本版本 `boards/{board_id}/index.html`、`styles.css`、`app.js` 中实现，节点 src 指向 `boards/{board_id}/index.html`。子画板不在项目配置中注册。
- 图片等资源放本版本 assets/，禁止跨版本引用。迭代复制整个版本，包括布局、画板和图片。
- 对所有新建页面使用此模式；历史 mobile、web、canvas-frame 页面及其版本不做自动升级或重写。
- 修改已有画布前读取最新 canvas-data.js，保持未涉及对象与 ID，不覆盖浏览器未保存的布局。
- 编辑器运行时需包含 canvas-core.js。parentId 表示容器关系，坐标使用世界坐标；用户选中对象时默认只修改该对象及其后代。生成画板界面后自动设置 src，不让用户手填路径；不得替换编辑器运行文件。

## 完成检查

- 首版有真实内容与核心交互反馈，无空模板、死按钮或无意义的业务模块。
- 预览在所选呈现方式下完整可见，窄窗口不遮挡主要操作；自由画布不被整体缩进手机框。
- 新页面已注册到正确项目，`targetDevice: "canvas"`、`pageMode: "infinite-canvas"`，两份工作区配置同步。
- 自包含资源可独立打开，分享与截图保留实际呈现方式。
- 总结所选呈现方式、页面路径、关键交互与验证结果。
