---
name: create-new-page
description: 在多页面原型项目中创建全新的手机端或 Web B 端页面。用户说“新增页面”“创建页面”“新建页面”“加一个页面”时使用；页面 targetDevice 决定生成逻辑，mobile 完整保留原有手机模板、风格选择与流程，web 必须执行顶部选择器绑定的唯一前端框架 Prototype Skill；新页面默认 mobile；只负责新建页面与首版可运行 Demo，不负责优化现有页面或创建迭代版本；执行过程、对用户说明和页面文案默认使用中文。
---

# 创建新页面 Skill

你当前在一个多页面原型项目中工作。这个 skill 只负责创建一个全新的页面，并生成首版可运行 Demo。页面可能是手机端，也可能是 Web B 端。

## 语言要求

- 与用户沟通、阶段性说明、最终总结必须使用中文。
- 页面内面向用户的文案默认使用中文，除非用户明确要求英文或中英混排。
- 代码标识、文件名、`page_id`、CSS class、JS 变量仍使用英文或项目既有命名风格。

## 项目结构约定

默认项目结构如下：

```text
src/pages/{project_id}/{page_id}/{version}/
```

其中：

- `{project_id}` 为当前活动项目 ID。Portal 发起任务时，消息外的执行上下文会提供当前 `projectId`，必须以它为唯一准则；仅在没有 Portal 运行上下文时，才读取 `data/projects.json` 的 `activeProjectId`。**严禁把 `readify` 当默认值**——用户会创建很多项目。
- `{page_id}` 是页面 ID，使用语义清晰、短小、全小写、连字符或英文单词风格命名。
- `{version}` 默认从当前活动版本读取；新页面固定从 `v1` 开始。

如果当前仓库使用了等价但不同的配置文件或目录结构，优先遵循仓库内已有模式，不要硬套本路径。

## 页面端类型与模板

页面模板由 `data/projects.json` 中 page 记录上的 `targetDevice` 决定：

- `mobile`：手机端页面，模板源为 `src/templates/mobile-frame/`
- `web`：Web B 端页面，`src/templates/web-frame/` 提供无业务倾向的自包含运行骨架；页面结构与视觉必须由顶部“前端框架”选择器绑定的 Skill 生成
- 历史页面或缺失 `targetDevice` 的页面，按 `mobile` 处理，并在配置同步时补上 `targetDevice: "mobile"`
- 新增页面默认 `targetDevice` 为 `mobile`；只有用户明确要求 Web B 端时，才把新 page 记录写成 `targetDevice: "web"`

### 端类型上下文隔离（强制）

必须先确定 `targetDevice`，再加载端类型相关规则。两条分支不得互相污染：

- `mobile`：严格执行本 Skill 原有手机页面流程和风格选择；不要读取、调用、提及或套用任何 Web 框架 Prototype Skill，不要改变手机模板、页面结构、设计判断、交互要求或上下文读取范围。
- `web`：用户消息会包含顶部选择器绑定的框架名称、Skill ID 和 `SKILL.md` 路径。必须完整读取并只执行该框架 Skill；不得自动改选、混用第二套 UI 框架或无条件回退到 Ant Design。
- Web 框架 Skill 是模板内置资源，统一位于 `src/templates/framework-skills/`，且只收纳 Portal 实际支持的 Web 框架；它们不属于 `.claude/skills/` 中的普通可发现 Skill。只能在 Portal 已明确选择框架后，按消息提供的精确路径读取。
- 用户未明确要求 Web B 端时，仍按 `mobile` 处理；不得仅因需求中出现“列表”“数据”“看板”“管理”等词就擅自切换为 `web`。

页面属性必须体现在创建页面使用的模板上：

- `mobile` 页面必须保留 `.demo-stage`、`.phone-shell`、`.phone-screen`、`.status-bar`、`.app-content` 这套手机外框结构。
- `web` 页面不要套手机外框；必须使用已选框架的视觉语言、组件角色、页面 Recipe 与质量门槛，不预设侧栏、顶栏、看板、表格或卡片。
- 两类页面都必须保持 `v1/` 自包含，运行时只引用新页面目录内自己的 `./styles.css` 与 `./app.js`。

## 工作模式判定

当用户表达“新增页面”“创建页面”“新建页面”“加一个页面”等意图时，执行创建页面流程。

必须严格遵循以下规约：

1. 新页面目录必须创建为 `src/pages/{project_id}/{new_page_id}/v1/`（其中 `{project_id}` 为当前活动项目 ID，优先从配置、当前页面路径或用户上下文判断）
2. `v1/` 必须完全自包含，至少包含：
   - `index.html`
   - `styles.css`
   - `app.js`
3. 严禁跨版本引用 CSS 或 JS
4. 所有新增页面必须按页面端类型执行对应初始化方式：
   - `mobile`：从 `src/templates/mobile-frame/` 复制 `index.html`、`styles.css`、`app.js` 到新页面 `v1/`
   - `web`：从 `src/templates/web-frame/` 只复制无业务倾向的 `index.html`、`styles.css`、`app.js` 运行骨架；随后必须根据已选框架 Skill 重建页面内容
   - 新 page 记录必须写入 `targetDevice`，默认 `mobile`
   - 运行时只能引用新页面目录内自己的 `./styles.css` 与 `./app.js`
   - `mobile` 页面独有内容放在 `.app-content` 内，页面独有样式追加在 `styles.css` 的 `Page content` 区域
   - `web` 页面独有内容必须覆盖当前页面的真实核心任务、关键状态和必要交互，不得默认拼装“指标卡 + 表格 + 审批”等通用后台组合
5. 创建完成后，必须同步更新两处配置：
   - `data/projects.json`
   - `portal/shell.js` 中的 `defaultData` 对象
   - 注意：项目根目录没有 `shell.js`，不要读取或修改 `/shell.js`
6. 页面需要能在 shell 的 `<iframe>` 中正常加载
7. 如果用户没有明确给出 `page_id`：
   - 先根据页面功能生成一个语义清晰、短小、全小写、连字符或英文单词风格的 `page_id`
   - 例如 `library`, `bookshelf`, `profile-center`
8. 页面文案、风格和交互要与用户描述一致，但输出先以“可运行 Demo”优先。
9. 创建页面不是只铺空模板，必须继续完成首版原型内容：
   - 明确页面核心意图
   - 构建真实可交互的内容区
   - 强化层级、状态反馈、交互反馈与移动端观感
   - 保持 `v1` 自包含，不跨版本引用 CSS 或 JS

### Web 页面：前端框架 Skill 路由（仅 `targetDevice: "web"`）

顶部“前端框架”选择器是强绑定输入。进入 Web 分支后，消息中的 `### 前端框架` 会提供唯一框架 Skill 路径；该 Skill 是本次 Web Demo 的产品表达、页面结构、组件映射、视觉语言、交互和质量门槛的最高优先级。

当前可选 Web 框架包括：`ant-design-skill`、`arco-design-prototype`、`element-plus-prototype`、`material-ui-prototype`、`chakra-ui-prototype`、`mantine-prototype`、`semi-design-prototype`、`shadcn-prototype`、`tdesign-web-prototype`。

#### 1. 选择结果处理

1. 完整读取消息中指定的 `SKILL.md`，以及该 Skill 明确要求的 references；不得只凭框架常识模仿外观。
2. 只激活一个主要 UI 框架 Skill。图标、图表或业务工具不算第二套 UI 框架，但不得混入另一框架的组件与视觉语法。
3. 选择 Ant Design 时执行 `ant-design-skill` 的 Prototype Scope、Page Archetype、页面级模板、Mock、交互与视觉验收流程。
4. 选择其他框架时执行对应 Skill 的 `IMPLEMENTATION.md`、`PAGE_RECIPES.md`、`VISUAL_LANGUAGE.md`、`COMPONENTS.md` 和 `QUALITY_GATE.md` 路由规则；读取顺序以该 Skill 自身说明为准。
5. UI 已完成框架选择，不要再次询问、比较或调用 `ui-prototype-router` 自动改选。

#### 2. 框架差异必须真实可见

框架选择不是换一组颜色。页面必须体现所选框架在以下方面的真实差异：

- 宏观布局、导航和内容密度
- 容器、边框、圆角、阴影与留白节奏
- 表单、表格、列表、反馈和浮层的原生组件语法
- 字体层级、状态表达、主题 Token 与交互反馈
- 该框架 Skill 推荐的页面 Recipe 和适用产品气质

禁止把同一份 DOM/CSS 只替换主色后称为不同框架，也禁止所有框架都生成 Ant Design 式后台。

#### 3. 适配当前自包含 Demo

`src/templates/web-frame/` 是框架无关的中性运行骨架。当前仓库最终仍交付原生 HTML、CSS、JavaScript：

- React/Vue 框架 Skill 中的组件结构、页面 Recipe 与视觉规范必须等价落地到语义化 HTML 和页面自己的 CSS。
- `useState`、Vue state、Drawer、Dialog、Toast、筛选和异步过程用原生 DOM state、class、overlay、toast 与 `setTimeout` 等价实现。
- 不安装框架运行时依赖，除非用户明确要求改变项目技术栈；但不得因此把所有框架降级成同一套通用 HTML 视觉。
- 将所选 Skill 的 Token 和必要视觉规则收敛进新页面自己的 `styles.css`；禁止运行时引用 Skill 目录、模板目录或其他页面。
- 页面完成后移除骨架占位内容，确保 `v1/` 只引用自己的 `./styles.css` 与 `./app.js`。

#### 4. 页面范围与连续性

- 对应 Skill 以单页 Demo 为目标时，优先用本地状态、Drawer/Dialog 和二级视图表达完整主任务。
- Ant Design Skill 判断需要多视图时，默认仍在同一个 `{page_id}/v1/` 内实现可点击视图流；只有用户明确要求时才注册多个 Portal 页面。
- 只检查同项目已有 `targetDevice: "web"` 页面以继承品牌与上下文；不得读取 mobile 页面决定 Web 样式。
- 已有 Web 页面使用不同 UI 框架时，以本次顶部选择为准，不得为了视觉连续性偷偷改回旧框架。

#### 5. 完成标准

除所选框架的 `QUALITY_GATE` 或视觉清单外，还必须确认：页面 5 秒内可理解；主操作可点击；Mock Data 有业务真实感；框架视觉辨识度明确；HTML/CSS/JS 自包含；没有死按钮、无意义 KPI、重复标题或第二套 UI 框架痕迹。

创建页面工作方式：

- 先用一句话说明你准备在哪个项目下创建什么页面、页面端类型和 `page_id`；Web 页面还要声明顶部已选框架 Skill 和页面主任务
- mobile 从手机模板初始化并保留原风格流程；Web 只从中性运行骨架初始化，再完整执行顶部已选框架 Skill
- 再同步更新 `data/projects.json` 与 `portal/shell.js`
- 最后确认新页面入口已经可在导航中出现，并说明本次触碰的文件

如果用户描述不完整，也不要停下来等待，先基于合理假设生成第一版可运行页面。

## 首版页面质量要求

新建页面不是只铺空模板，必须满足：

- 优先做有明确方向的界面，而不是套用通用布局。
- 页面结构必须服务用户描述中的核心场景。
- 强化信息层级、布局构图、状态反馈和交互清晰度；手机端强调移动端观感，Web B 端强调信息密度、可扫描性、批量操作和业务状态。
- 在关键操作处补齐即时反馈，例如选中态、加载态、空状态、成功态、错误态或过渡动效。
- 不要默认输出平淡、模板化、明显“AI 味”的界面。

## 执行流程

1. 先从 Portal 执行上下文确定当前活动项目 ID；没有该上下文时才读取 `data/projects.json` 的 `activeProjectId`（缺失或指向已删除项目时，回退到 `projects` 数组中第一个未删除项目，不要默认 `readify`）。再确定新页面 `page_id` 与页面端类型，端类型缺省使用 `mobile`。确定端类型前不要加载任何端类型专属 Skill。
2. 若为 `mobile`，只读取手机模板并执行原有风格流程；若为 `web`，从消息的“前端框架”段读取唯一 Skill 路径，完整执行该 Skill 后再使用中性 Web 运行骨架承载实现。
3. 编辑前用中文简短说明页面目标、准备修改或创建的位置，以及下一步动作。
4. 完成文件创建、页面实现、配置同步和交互补齐。
5. 完成后用中文总结：
   - 改了什么
   - 触碰了哪些文件
   - 新增的 `v1` 页面路径
   - 新页面是否已经注册到导航
