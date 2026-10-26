
# Demo 项目规约

## 1. 目录结构强制要求

- 所有 Demo 页面必须放在：`src/pages/{project_id}/{page_id}/{version}/`
  - `project_id`：当前活动项目的唯一标识；Portal 发起任务时，以运行上下文中的 `projectId` 为准
  - `page_id`：唯一标识（如 `reader`, `library`）
  - `version`：小写 `v` + 数字（如 `v1`, `v2`）
- 每个版本目录**完全自包含**：必须有自己的 `index.html`, `styles.css`, `app.js`
- **严禁**跨版本引用 CSS/JS 文件

## 2. 页面端类型

- `data/projects.json` 中每个 page 记录必须有 `targetDevice`：
  - `mobile`：手机端页面，使用 `src/templates/mobile-frame/`
  - `web`：Web 页面，使用框架无关的 `src/templates/web-frame/`
  - `canvas`：自由画布，使用中性的 `src/templates/canvas-frame/`；不强制设备外框或 UI 框架
- 历史页面、缺失 `targetDevice` 的页面一律视为 `mobile`，同步配置时需要补上该属性。
- 创建项目时不选择端类型。
- 创建页面默认“智能判断”（`auto` 仅为创建模式，不写入页面元数据），保留手机、Web、自由画布手动选择。先判断呈现方式再加载对应 Skill；用户本次明确文字要求优先于选择器默认值。普通移动端页面仍采用手机框；根据核心任务选择网页或自由画布，不凭单个关键词切换。
- 创建后保存实际 `targetDevice` 为 `mobile`、`web` 或 `canvas`；后续迭代沿用该方式，除非用户明确要求改变。历史页面不重新推断或批量改写。

## 3. 迭代版本（用户说“迭代版本”时）

1. 确定新版本号 = 当前最大版本号 + 1（例：`v2` → `v3`）
2. 复制整个当前版本目录（如 `v2/`） → 新目录（如 `v3/`）
3. **必须更新两处配置**：
   - `projects.json` 中的 `versions` 数组
   - `portal/shell.js` 中的 `defaultData` 对象（支持 `file://` 协议离线访问）
4. 之后所有修改**只改新版本目录**，旧版本保留不动

## 4. 新增页面（用户要求“新增页面”时）

1. 在 `src/pages/{project_id}/` 下创建：`{new_page_id}/v1/`；`project_id` 必须使用 Portal 运行上下文中的当前活动项目，不得硬编码 `readify`
2. 根据页面 `targetDevice` 复制对应模板并编写基础 Demo 代码：
   - `mobile`：复制 `src/templates/mobile-frame/`
   - `web`：复制 `src/templates/web-frame/`
   - `canvas`：复制 `src/templates/canvas-frame/`
3. 同时在 `projects.json` 和 `portal/shell.js` 的 `defaultData` 中注册新页面

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
