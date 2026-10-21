---
name: ant-design-skill
description: 使用 Ant Design 为产品经理、设计评审、方案演示和原型平台快速生成高保真企业级原型 Demo。重点不是生产工程，而是把产品需求转化为像真实产品一样完整、专业、可点击演示的一个或多个页面。适用于管理后台、ERP/CRM、运营平台、数据看板、AI 工作台、项目详情、审批、配置、监控、内容管理、列表/表单/详情等场景。用户提到 Ant Design、antd、中后台、后台页面、管理系统、原型、Demo、产品原型、数据看板、表格页、详情页、工作台、配置页、AI 页面或希望快速做一个可看的企业级页面时使用。若用户明确指定其他 UI 框架，则不要强制使用本 Skill。
---

# Ant Design Prototype UI Skill

## 1. 目标

本 Skill 的目标不是生成 production-ready 系统，而是：

> **把产品需求快速变成高保真、业务合理、视觉完整、可本地预览和演示的 Ant Design 原型；页面数量由产品意图决定，可以是单页，也可以是多页。**

评价优先级：

1. **产品表达是否清楚**：一眼能看懂这个页面解决什么问题、核心对象是什么、主要操作是什么。
2. **页面是否像真实产品**：字段、状态、数据、操作、文案要有业务真实感，而不是通用 AI 占位符。
3. **视觉是否完整专业**：信息层级、留白、对齐、密度、状态色、卡片与表格关系合理。
4. **关键交互是否可演示**：按钮、筛选、Tab、Drawer、Modal 等核心路径能点击展示即可。
5. **代码是否能在原型平台本地运行**：能渲染、无明显报错即可；不追求生产级架构、测试与工程完备性。

默认不优化：真实后端、权限系统、路由架构、接口错误恢复、数据持久化、SSR、性能工程、自动化测试、生产部署、长期可维护性。

---

## 2. 核心原则

### 2.1 产品意图与页面体系优先，而不是组件优先

不要从“这是 Table 还是 Form”开始，也不要预设“只能做一个页面”。先回答：

- 谁在使用这个页面？
- 他进入页面时最想完成什么任务？
- 页面最重要的信息是什么？
- 需要哪些页面、哪些页面区域，才能把产品方案讲清楚？

先确定 **Prototype Scope + Page Archetype + Information Architecture**，再组合 Table / Card / Form / Statistic / Descriptions / Tabs / Timeline / Drawer 等组件。一个页面无法自然表达完整意图时，主动拆成多个页面。

### 2.2 Prototype Completeness：主动补齐需求

用户通常只会描述产品意图，不会给完整 UI 字段。原型模式下必须主动做合理产品推断。

例如用户只说“做一个直播活动管理页”，不要只生成：名称 / 状态 / 日期 / 操作。应合理补齐直播场景中真正有价值的信息，例如：

- 直播名称、封面、直播时间、状态
- 观看人数、报名人数、负责人、直播类型
- 未开始 / 直播中 / 已结束等状态
- 搜索、状态、时间、负责人等必要筛选
- 进入直播、数据分析、编辑、更多等操作

**合理推断优先于追问。** 只有缺失信息会根本改变页面形态时才需要澄清。

### 2.3 Prototype Scope：页面数量由产品意图决定

**禁止预设单页。** 默认目标不是“尽量塞进一个页面”，而是“用最少且足够的页面把产品意图表达完整”。

优先单页的情况：

- 主任务单一，列表 + Drawer / Modal 已能完整演示
- 详情只是轻量预览，不需要独立上下文
- 配置项很少，可在当前页面自然承载

应主动拆成多页的情况：

- CRUD 中“列表 / 新建编辑 / 详情”承载的信息密度明显不同
- 详情页包含大量业务信息、记录、关联对象或独立操作
- 配置页具有独立的信息架构，不适合塞进主业务页
- 不同流程阶段需要明显不同的工作区，例如列表 → 详情 → 处理 / 配置
- 不同用户任务之间会争夺同一个页面的视觉主角
- 为了塞进单页而被迫增加过多 Tab、Drawer、折叠区或复杂条件展示

多页原型规则：

1. **页面数量没有固定上限，但保持克制。** 只生成能明显提升产品表达的页面。
2. **Agent 可主动新增页面。** 用户没有逐页指定时，也应根据产品逻辑补齐必要页面。
3. **每个页面仍然只有一个主要任务和视觉主角。** 不因为允许多页就随意拆碎。
4. **页面之间要有最小可演示跳转。** 例如列表“查看详情”进入详情页，详情“编辑配置”进入配置页。可用本地 state、简单 route 或原型平台支持的页面切换方式实现。
5. **优先复用 `scripts/pages/` 页面模板。** 同一个原型可重复使用不同 archetype 模板组成完整页面流。

详细拆页规则见 `references/prototype-flow.md`。

### 2.4 页面模板优先，组件模板第二

优先级：

1. `scripts/pages/`：完整页面原型模板
2. `references/page-archetypes.md`：页面类型和信息架构
3. `references/prototype-principles.md`：原型设计原则
4. `references/mock-data.md`：业务 Mock 规则
5. `references/demo-interaction.md`：演示交互规则
6. `scripts/table|form|list|charts|description-list/`：组件级模板
7. 原有 `references/components_*.md`：遇到具体视觉问题时按需读取
8. Ant Design 原生组件能力

**有接近的页面模板时，复制页面模板并删改，而不是从零拼页面。**

### 2.5 原型允许“作弊”

为了让 Demo 能演示，允许：

- 静态 Mock Data
- 本地 `useState` 模拟保存、启停、删除、筛选
- `setTimeout` 模拟加载 / AI 分析 / 提交过程
- hardcode 演示数据与局部样式值
- 按钮只驱动本地 Drawer / Modal / Toast / 状态变化
- 假分页、假进度、假趋势数据

不要为了“工程正确”牺牲原型完成速度和表达质量。

### 2.6 克制：不要为了“高级感”堆组件

默认页面只需要：

- 1 个主要目标
- 1 个主要内容区
- 1 个明确主操作
- 0～1 个辅助信息区

除非业务确实需要，不要自动添加：

- 大量 KPI
- 无意义趋势图
- 多层 Tab
- Breadcrumb + PageTitle 双标题
- Quick Action 大杂烩
- “AI 洞察”装饰块
- 过量 Badge / Tag / 渐变色

---

## 3. 默认执行流程

收到需求后按以下顺序执行。

### Step 1：理解产品任务

内部先形成一句话：

> `[用户角色]` 通过 `[核心对象/内容]` 完成 `[主要任务]`；必要时涉及 `[页面流 / 多阶段任务]`。

例如：

> 运营人员在直播活动管理页快速查看直播状态、筛选活动并进入编辑或数据分析。

### Step 2：判断 Prototype Scope

先判断一个页面是否足够。

- 足够：继续单页原型。
- 不足：规划 2 个或更多必要页面，并明确页面关系，例如 `列表 → 详情 → 配置`。
- 用户没有明确要求页面数量时，Agent 自行判断，不需要为了“只做一页”牺牲表达。

读取 `references/prototype-flow.md`，为每个页面分别选择 Page Archetype。

### Step 3：选择 Page Archetype

优先从以下类型选择，详细规则见 `references/page-archetypes.md`：

- Data Management / 数据管理页
- Object Detail / 对象详情页
- Create & Edit / 创建编辑页
- Dashboard / 数据看板
- Project Workspace / 项目工作台
- Analysis Result / 分析结果页
- Settings / 配置页
- Approval / 审批处理页
- Monitoring / 监控页
- Content Management / 内容管理页
- AI Workspace / AI 工作台
- File / Resource Management / 文件资源页

如果一个页面同时有多种特征，选择“用户主任务”对应的 archetype 作为骨架，再嵌入其他组件。

### Step 4：构造信息架构

先规划 3～6 个页面区域。常见顺序：

```text
Page Header / Context
→ Summary / Status（可选）
→ Search / Toolbar（可选）
→ Primary Content
→ Secondary Detail / Drawer / Modal（按需）
```

每个区域必须能解释为什么存在。没有作用的区域直接删除。

### Step 5：补齐业务信息

根据领域合理推断：

- 核心字段
- 状态枚举
- 主要操作
- 次要操作
- 筛选条件
- 空状态 / 异常状态（需要时）
- 业务文案
- Mock Data

Mock 规则见 `references/mock-data.md`。

### Step 6：选择模板

优先查看 `scripts/pages/`：

| 页面 | 模板 |
|---|---|
| 数据列表 / 运营管理 | `01-DataManagementPage.tsx` |
| 对象 / 客户 / 项目详情 | `02-ObjectDetailPage.tsx` |
| Dashboard / 数据概览 | `03-DashboardPage.tsx` |
| 项目处理 / AI 处理 / 任务工作区 | `04-ProjectWorkspacePage.tsx` |
| 系统 / 产品配置 | `05-SettingsPage.tsx` |
| AI 对话 / Agent / 智能助手工作区 | `06-AIWorkspacePage.tsx` |

没有完全匹配时，选择结构最近的模板，删除多余区域、添加少量所需组件。

### Step 7：加入最小必要交互

优先让以下交互真实可演示：

- 搜索 / 筛选
- 状态切换
- Tab 切换
- 新建 / 编辑 Drawer
- 详情 Modal
- 批量选择
- 进度 / 运行状态
- AI 生成 / 分析过程

不需要实现完整业务闭环。规则见 `references/demo-interaction.md`。

### Step 8：应用视觉底座

- 优先复用 `references/global-style.css`
- 组件视觉遵循 Ant Design 默认体系
- 需要复杂 Table / Form / List 细节时再读取对应 `components_*.md`
- 原有 reference 中的工程性强约束低于本 `SKILL.md`；只保留影响肉眼质量的规则

### Step 9：视觉自检

输出前只做原型级检查：

1. 5 秒内能看懂页面是干什么的吗？
2. 视觉焦点是否明确？
3. 信息是不是太多或太空？
4. Mock Data 像真实业务吗？
5. 主操作明显吗？
6. 页面是否存在重复标题、重复容器、无意义 Tab / KPI？
7. 表格操作是否挤压、换行或布局破坏？
8. Drawer / Modal 打开后是否能清楚展示演示内容？
9. 点击关键按钮是否有视觉反馈？
10. 页面能否直接拿去做产品演示？
11. 如果当前原型只有一页，是否为了塞进单页而牺牲了详情、配置或流程表达？
12. 如果是多页，页面拆分是否都有明确理由，跳转关系是否清楚？

通过即可，不做 production QA。

---

## 4. 页面数量与视觉上下文

本 Skill **不限制页面数量**。单页或多页都可以，默认选择“最少但足以完整表达产品意图”的页面集合。

### 默认策略

- 一个页面足够表达：生成完整单页 Demo，不强制真实 Router。
- 一个页面不够：Agent 主动新增必要页面，例如列表页、详情页、创建/编辑页、配置页、结果页，并建立最小可演示跳转。
- 需要让页面“看起来属于后台系统”：可添加轻量 Side / Top Shell，只作为视觉上下文；多页原型应保持 Shell、标题体系与视觉规范一致。
- 用户明确要求完整后台框架时，再读取 `references/layout.md` 和 `scripts/layout/`。

不要因为是 CRM / ERP 就自动生成复杂导航系统，也不要为了避免 Router 而强行把所有功能塞进一个页面。

### Layout 只需要满足演示

允许：

- 菜单为静态数组
- 点击菜单只切 active 状态或不实现跳转
- 用户头像 / 搜索为演示视觉
- 折叠只做本地 state

不需要：

- 真实 Router
- 权限 Route Guard
- 菜单 API
- URL 状态同步
- 持久化折叠状态

---

## 5. 页面类型与组件组合

### 5.1 数据管理页

核心结构：

```text
标题 + 主操作
[可选] 轻量汇总 / 状态 Tab
搜索 / 筛选 / Toolbar
Table / List
编辑 Drawer / 详情 Modal
```

优先使用 `scripts/pages/01-DataManagementPage.tsx`。

### 5.2 对象详情页

核心结构：

```text
返回 / 标题 / 状态 / 主要操作
关键摘要
基础信息
业务分组信息
记录 / Timeline / 关联数据
编辑 Drawer
```

优先使用 `scripts/pages/02-ObjectDetailPage.tsx`。

### 5.3 Dashboard

先问“用户看完数字后要做什么”。只展示真正影响判断的指标。

核心结构：

```text
时间/范围控制
3～5 个核心指标
1～2 个主要图表
异常 / 排名 / 明细（最多一个辅助区）
```

优先使用 `scripts/pages/03-DashboardPage.tsx`。

### 5.4 项目工作台

适合 AI 分析、视频处理、任务拆解、流程工具。

核心结构：

```text
项目上下文 + 状态 + 操作
左/上：原始对象或输入
中：主要工作区 / 结果列表
右/下：属性、处理状态或辅助操作
```

优先使用 `scripts/pages/04-ProjectWorkspacePage.tsx`。

### 5.5 配置页

配置按用户心智分组，而不是按数据库字段分组。

核心结构：

```text
页面标题
设置导航 / 分区标题
2～5 个配置组
即时保存或底部保存按钮
```

优先使用 `scripts/pages/05-SettingsPage.tsx`。

### 5.6 AI Workspace

不要只做一个聊天框。需要体现 Agent 的能力、上下文和工作状态。

核心结构：

```text
对象 / 会话上下文
消息或任务主区
Agent 当前状态 / 调用步骤（需要时）
输入区
相关资料 / 结果侧栏（需要时）
```

优先使用 `scripts/pages/06-AIWorkspacePage.tsx`。

---

## 6. 组件规则：只保留高价值约束

### Table / List

保留：

- 重要列优先，次要信息降级展示
- 操作列不要换行
- 3～4 个简单筛选优先单行；复杂筛选再 QueryFilter
- 状态用 Tag / Badge，但颜色不要过多
- 长文本需要 ellipsis / tooltip
- 表格数据必须有真实业务差异

不要执着：

- 精确到字符数推导操作列宽
- 为 production 场景设计复杂分页状态
- 服务端排序 / 服务端筛选实现

### Form

保留：

- 字段按业务语义分组
- 必填项克制
- 操作按钮位置清晰
- Drawer / Modal 中只放完成任务所需字段
- 4 步及以上、描述较长时优先竖向 Steps；3 步以内优先横向

原型中可以不实现完整 validation，只做关键字段提示。

### Descriptions

保留：

- 一个对象的核心信息优先
- 语义分组清楚
- 不要把所有字段平铺成“数据库详情页”

### Chart / Statistic

保留：

- 指标必须服务决策
- 图表必须表达趋势、构成或对比中的一种
- 不为了占空间生成图表
- 3～5 个核心指标通常足够

---

## 7. Mock Data 是原型的一部分

禁止使用低质量占位内容：

```text
Test 1
Test 2
User A
Company A
Lorem ipsum
2024-01-01 全部同一天
全部状态都是“正常”
```

Mock Data 应包含：

- 符合业务语境的名字与文案
- 合理的时间分布
- 不同状态
- 长短不一的内容
- 数值的数量级差异
- 至少一个需要注意的边界 / 异常状态（业务需要时）

详细见 `references/mock-data.md`。

---

## 8. Demo Interaction

原型交互的目标是：**让演示者点击之后有合理反馈。**

推荐实现：

```tsx
const [open, setOpen] = useState(false);
const [status, setStatus] = useState('running');
```

配合：

- `message.success()`
- `Drawer`
- `Modal`
- `Tabs`
- 本地数组过滤
- 本地状态修改
- `setTimeout()` 模拟 AI / 上传 / 分析

不要实现真实 API，除非用户明确要求。

---

## 9. 读取策略：保持上下文干净

禁止一次读取所有 reference 和 templates。

推荐：

### 普通数据管理页面

```text
SKILL.md
→ page-archetypes.md 的 Data Management
→ 01-DataManagementPage.tsx
→ 如果 Table 有特殊能力，再读 components_Table.md 对应小节
```

### AI 项目工作台

```text
SKILL.md
→ page-archetypes.md 的 Project Workspace / AI Workspace
→ 04-ProjectWorkspacePage.tsx 或 06-AIWorkspacePage.tsx
→ demo-interaction.md
```

### 复杂详情页

```text
SKILL.md
→ page-archetypes.md 的 Object Detail
→ 02-ObjectDetailPage.tsx
→ 必要时读 components_DescriptionList.md
```

原则：**先页面，后组件；先业务，后 API。**

---

## 10. 文件索引

### 原型核心规范

| 文件 | 用途 |
|---|---|
| `references/prototype-principles.md` | 原型页面设计与取舍原则 |
| `references/page-archetypes.md` | 页面类型、信息架构和选择规则 |
| `references/mock-data.md` | 高真实感 Mock Data 生成规则 |
| `references/demo-interaction.md` | 最小演示交互实现规则 |
| `references/visual-checklist.md` | 输出前视觉验收 |
| `references/global-style.css` | 统一视觉底座 |

### 页面级模板

| 文件 | 用途 |
|---|---|
| `scripts/pages/01-DataManagementPage.tsx` | 数据管理 / 列表运营页 |
| `scripts/pages/02-ObjectDetailPage.tsx` | 对象详情 / 客户详情 / 项目详情 |
| `scripts/pages/03-DashboardPage.tsx` | 数据看板 |
| `scripts/pages/04-ProjectWorkspacePage.tsx` | 项目工作台 / 处理工作区 |
| `scripts/pages/05-SettingsPage.tsx` | 配置 / 设置页 |
| `scripts/pages/06-AIWorkspacePage.tsx` | AI / Agent 工作区 |

### 原组件模板

原 `scripts/form/`、`scripts/table/`、`scripts/list/`、`scripts/description-list/`、`scripts/charts/` 保留，作为页面模板之外的补充模块，不再要求每个页面必须从某一个组件模板起步。

### 原详细规范

原 `references/components_*.md` 与 `layout.md` 保留作为“高级视觉细节参考”。其中与工程化、production-ready、严格类型、真实路由、真实接口相关的要求在原型模式下不是强制项；与本 `SKILL.md` 冲突时，以本文件为最高优先级。

---

## 11. 最终判断标准

不要问：

> “这份代码够不够上线？”

要问：

> **“如果产品经理现在把这个页面打开给老板、客户或研发看，对方能不能迅速理解产品方案，并觉得它像一个真实存在的产品？”**

如果答案是“能”，这个原型就完成了。
