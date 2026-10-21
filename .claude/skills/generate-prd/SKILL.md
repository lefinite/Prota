---
name: generate-business-prd
description: Generate Chinese business-focused AI-ready PRDs for prototype demos by synthesizing user prompts, demo annotations, source code, DOM evidence, and raw per-feature screenshots. Use when the user asks for 新框架 PRD, 业务 PRD, 结构化 PRD, AI-Ready PRD, 图文 PRD, 基于标注和源码生成 PRD, or /generate-prd.
metadata:
  version: "1.1"
---
# 生成业务型 AI-Ready PRD

## 目标

为单个原型页面生成或更新以具体需求命名的图文 PRD。文档必须综合用户需求、页面标注、源码行为、DOM 证据和功能截图，输出面向业务和开发 AI 的结构化产品需求。

读者已有交互 Demo 和业务上下文。用最少文字写清本次变化及影响实现的规则；Demo 和截图已表达清楚的操作与界面不再复述。

最终 PRD 面向中文产品、设计和研发协作。除文件路径、图片链接、必要字段名和无法翻译的产品专名外，能用中文表达的地方都必须用中文表达。源码中的英文变量名、枚举值、CSS 类名、DOM 属性名和内部状态名只能作为理解证据，不能原样搬进正文。

截图是硬性要求：描述哪个功能，就插入哪个功能真实界面状态的原始截图。

## 输出范围

只创建或更新页面级文档资产：

```text
src/pages/{project_id}/{page_id}/docs/{需求名称}.md
src/pages/{project_id}/{page_id}/docs/prd-assets/
```

不得创建版本级文档目录。PRD 统一放在页面层级的 `docs` 目录下。

写正文前，用一句话概括“本次改什么”，再提炼成具体需求名称。优先沿用用户给出的需求名；否则用“业务对象 + 变化或规则”，例如“阅读器音量键翻页”“背景乐与朗读音量联动”。名称应能区分同页的其他需求，不用“PRD”“需求说明”“当前需求”或页面目录名作为泛称。

- 新文档保存为 `src/pages/{project_id}/{page_id}/docs/{需求名称}.md`，一级标题使用同一名称。中文文件名可直接使用；去掉路径分隔符及文件名非法字符，不把需求名当目录。
- 正文顶部记录目标页面、Demo 版本和日期；Demo 版本不是文档修订号，不默认拼进名称。
- 写入前检查同目录文档。同名且同一需求时更新；不同需求时补充业务限定词。用户要求保留修订版时增加修订号，不覆盖旧版。
- 用户明确指定已有文档时更新该文件，不擅自移动它或批量重命名历史文档；标题可改为需求名称。

## 工作流程

### 1. 确定目标页面

从用户请求中解析 `page_id` 和 `version`，支持这些写法：

```text
reader v9
reader/v9
v9
```

优先使用用户请求和 Portal 运行上下文中的 `projectId`、`pageId`、`version`；缺少时读取 `data/projects.json` 的活动项目、活动页面及其 `activeVersion`。不得硬编码项目。

必须确认目标版本目录存在以下文件：

```text
src/pages/{project_id}/{page_id}/{version}/index.html
src/pages/{project_id}/{page_id}/{version}/styles.css
src/pages/{project_id}/{page_id}/{version}/app.js
```

### 2. 确定本次 PRD 范围

用户触发 skill 时描述的本轮范围是最高优先级范围信号。`annotations.json` 是重要参考：它代表用户在原型上标出的业务意图、重点区域和可能相关的功能线索，但不是唯一边界，不能机械地用标注把范围框死。

范围可以是：

- 某个功能
- 某个模块
- 某个业务场景
- 整个页面
- 某一组标注或最近迭代内容

范围判定规则：

- 如果用户本轮明确说了范围，以用户本轮范围为准；标注用于校准重点、补充业务意图、发现遗漏状态和截图目标。
- 如果用户本轮范围覆盖了未标注功能，可以写；不要因为功能没有被标注就排除。
- 如果标注中有与用户本轮范围无关的内容，直接省略；需求范围只列本次要实现的功能。
- 如果用户本轮范围比较宽泛或不清楚，再参考标注、最近版本变化和当前页面上下文推断最窄合理范围，并在 PRD 中说明这是推断范围。
- 标注是业务意图和重点区域，不要直接照抄标注文案，要把它转译为范围依据、业务规则、边界条件或截图目标。

### 3. 收集证据

读取目标版本的这些文件：

- `annotations.json`：作为业务意图和重点区域，不要直接照抄标注文案。
- `index.html`：识别功能区、按钮文案、页面状态、数据钩子和 DOM 锚点。写入 PRD 时必须转译成中文业务语义，不要输出 DOM 术语。
- `app.js`：识别状态机、事件、mock 数据、业务规则、依赖关系、计算逻辑、持久化和边界条件。写入 PRD 时必须把英文变量、函数、枚举转成中文规则描述。
- `styles.css`：只关注行为相关状态，例如 hidden、active、disabled、loading、selected、responsive、modal 可见性。
- 既有本地文档：只能作为对照材料，不作为事实来源。

用户明确要求是预期行为，源码是 Demo 现状；冲突时按明确需求写并记录差异。模拟数据、演示延时、占位接口和临时存储不能直接认定为产品规则。缺少依据且影响实现的决定列入“待确认”，不要编造权限、默认值、限额或异常策略。

写 PRD 前，先在内部建立功能地图：

- 功能/用例 -> 为什么属于本次范围 -> 关联标注 -> 源码行为
- 功能/用例 -> 需要截图的准确界面状态 -> 到达该状态需要的用户动作
- 功能/用例 -> 规则 -> 交互与状态补充 -> 边界 -> 数据字段

### 4. 截取原始功能截图

功能截图不是装饰图，是需求证据。必须在功能地图明确后，按功能逐张截图。

只有当功能已经在当前页面状态中可见时，才允许直接截当前状态：

```bash
npm --prefix .claude/skills/generate-prd run capture -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets \
  --shot-name feature-{n}-{short-name}
```

更推荐使用“目标感知截图”。传入标注序号、标注 id、CSS selector、精确文本或功能关键词，截图服务会尝试定位目标；如果目标在二级界面中，会尝试点击可见控件进入对应状态，然后把目标滚动到可见区域再截图：

```bash
npm --prefix .claude/skills/generate-prd run capture -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets \
  --annotation {n} \
  --shot-name feature-{n}-{short-name}

npm --prefix .claude/skills/generate-prd run capture -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets \
  --feature "{功能名或目标文本}" \
  --shot-name feature-{n}-{short-name}

npm --prefix .claude/skills/generate-prd run capture -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets \
  --selector "{CSS selector}" \
  --shot-name feature-{n}-{short-name}
```

如果不确定有哪些标注目标，先列出可用目标：

```bash
node tools/capture/prd-evidence.mjs \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --list-targets
```

如果某个功能必须经过明确路径才能进入，例如打开菜单、切换 tab、选择选项、进入弹窗、触发空态或选中态，必须传入显式动作，不要接受泛泛的页面截图：

```bash
npm --prefix .claude/skills/generate-prd run capture -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets \
  --feature "{功能名或目标文本}" \
  --actions "click:更多;click:背景乐;click:睡眠" \
  --shot-name feature-{n}-{short-name}
```

如果标注只命中功能入口，但该功能还有详情页、二级面板、设置页或选中态，必须把入口状态和后续功能详情状态都截出来。一个功能可以插入多张截图，不要为了“一功能一图”丢掉真实功能页面。使用 `--capture-steps` 时，截图服务会在每个显式动作执行后各截一张图：

```bash
npm --prefix .claude/skills/generate-prd run capture -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets \
  --annotation {n} \
  --capture-entry-detail \
  --shot-name feature-{n}-{short-name}
```

如果功能路径超过“入口 -> 详情”一跳，或必须先打开菜单、切换 tab、选择选项、进入弹窗、触发空态或选中态，则使用动作链。动作链可以生成多张图：动作后的状态图，以及二级入口点击前的 `*-entry.png`：

```bash
npm --prefix .claude/skills/generate-prd run capture -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets \
  --feature "{功能名或目标文本}" \
  --actions "click:Aa;click:更多设置" \
  --capture-steps \
  --shot-name feature-{n}-{short-name}
```

`--actions` 支持常用动作：

- `click:按钮文本`
- `click:CSS selector`
- `click-text:文本`
- `click-selector:CSS selector`
- `fill:CSS selector|输入内容`
- `press:键名`
- `wait:毫秒`
- `scroll:CSS selector`

只有在目标感知截图和显式动作仍无法保证准确状态时，才使用确认模式：

```bash
npm --prefix .claude/skills/generate-prd run capture:confirm -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets \
  --feature "{功能名或目标文本}" \
  --shot-name feature-{n}-{short-name}
```

确认模式会打开真实 Demo 浏览器。把页面调整到准确功能状态，必要时让用户确认，再按 Enter 截图。

截图规则：

- 每个详细功能用例至少一张匹配截图，除非明确写出截图失败说明。
- 一个功能可以有多张截图；如果存在入口态、详情页、二级页面、弹窗、面板、选中态、输入态、空态或错误态，应按状态分别截图。
- 描述“功能 1”就必须截“功能 1”的真实状态，不能用整页概览图或其他功能图替代。
- 如果功能在菜单、tab、详情面板、弹窗、二级页面、选中态、输入态、空态或错误态中，必须先触发到该状态再截图；标注只标了入口时，入口和功能详情都要保留。
- 命令在项目根目录运行，截图资产使用本需求及版本专属的子目录或文件名前缀，避免覆盖其他文档引用的图片。
- Web 页面使用适合目标 Demo 的 `--viewport 1440x900 --capture-selector none`；手机端或缺少 `targetDevice` 时保留默认手机截图配置。
- 默认使用原始 viewport 截图。只有功能必须依赖长页面上下文时，才使用 `--full-page`。
- 截图服务默认使用 `--device iphone-17`：先用稳定的门户手机模板尺寸渲染，再自动裁剪 `.phone-screen` 内屏，因此不截模板手机壳，也不会触发小屏全屏断点导致面板边距、圆角或位置偏移。只有明确需要验证其他尺寸时，才手动传入 `--viewport WIDTHxHEIGHT`、`--device` 或 `--capture-selector none`。
- 默认不得为了命中标注目标调用横向或纵向居中滚动；截图应保留用户刚触发功能后的自然位置。只有显式传入 `--clip-target`、`scroll:CSS selector` 或用户要求裁剪目标时，才允许调整滚动位置。
- 不得把 `annotation-overview.png`、`prototype-overview.png`、DOM evidence 图、标注裁剪图、红框图作为功能截图插入 PRD。
- 目标感知截图会同时生成 `{shot-name}.json` 元数据文件。普通截图插入 PRD 前必须检查其中的 `finalState.visible`、`target` 和 `discovery.path`；`--capture-entry-detail` 和 `--capture-steps` 截图必须检查 `images[].screenState`、`images[].finalState`、`target` 和 `explicitActions`，确认每张图确实属于目标功能的入口、详情或后续状态。
- 如果截图服务无法命中目标，必须补充 `--actions` 或改用 `capture:confirm`。仍失败时，在该用例下写清楚“截图缺失原因”，不得用不相关图片凑数。

可选 DOM 证据截图只用于分析，不得插入 PRD 作为功能截图：

```bash
npm --prefix .claude/skills/generate-prd run capture:evidence -- \
  --page-dir src/pages/{project_id}/{page_id}/{version} \
  --out src/pages/{project_id}/{page_id}/docs/prd-assets
```

### 5. 编写 PRD

读取 `references/business-ai-ready-prd-contract.md`，保留现有章节顺序、标题、截图位置和表格格式；按需省略可选小节，不新增模板层级。最终 PRD 不要包含 `## 8. 给开发 AI 的 Prompt` 章节。

写作规则：

- 全文使用中文。
- 正文只描述本次要实现的功能、规则和结果；省略“不做什么”“未覆盖什么”“暂不支持什么”等范围排除、非目标和无关能力说明。必要的权限、互斥、限制和异常规则应写清触发条件、系统处理与结果，不要扩展成未实现能力清单。
- 默认写短：只保留本次变化、容易误解的规则和影响实现的决定。同一信息只写一次；背景、范围、需求说明各用短句，不展开读者已有的上下文。简单需求用一句需求说明、匹配截图和几条直接规则讲清，不逐项展开触发、默认值、状态、数据和异常。
- 英文源码词必须中文化转译。例如：
  - `loading` 写成“加载中”，`disabled` 写成“不可用”，`selected` 写成“已选中”。
- 除非是在文件路径、图片链接、字段表的技术字段列、命令示例或必要的接口名中，否则不要在正文出现英文变量名、CSS 类名、DOM 属性名、函数名、内部枚举值、`true/false`、`null`、`undefined`。
- 数据要求表里的“字段”列优先使用中文字段名。如果必须保留技术字段名，格式为“中文名称（技术字段：xxx）”，且只在确有实现价值时保留。
- 需求标题、需求结论、功能规则、边界异常、交互与状态补充都必须用中文业务语言表达，不要出现 `panel`、`modal`、`switch`、`toast`、`tab`、`slider`、`state`、`handler` 等源码/界面实现词；应分别转成“面板/弹窗/开关/提示/分类切换/滑杆/状态/处理逻辑”等中文词。
- 证据必须被综合归纳，不要直接复制标注列表或源码片段。
- 每个详细功能需求保留匹配的原始功能截图、简短需求说明和必要规则。边界异常、数据要求等仅在存在额外实现信息时补充，已在规则中写清的内容不另起小节重复。
- 简单功能直接用短句或单层短列表，不加分组标题、多层编号或嵌套列表。只有复杂判断、优先级或组合关系才用小表格或矩阵，以最容易读懂为准。
- 每条规则应尽量原子化，内容要能直接指导实现；避免“支持设置”“保持一致”“进行校验”“展示对应内容”这类没有明确条件和结果的描述。
- 只有在主规则结构无法表达复杂逻辑时，才使用“规则细化”补充计算公式、排序口径、状态机、权限矩阵或跨功能联动。
- “交互与状态补充”默认省略。仅当存在 Demo、截图和主规则无法讲清的关键交互或状态关系，且省略会导致实现歧义时，才在对应功能内保留原表格，只写新增信息。普通点击、开关、弹窗、保存反馈和常规状态变化无需单独补充。
- 不要花大量文字描述 UI 布局、颜色、间距、视觉层级和肉眼可见内容；截图已经承担界面上下文。
- 优先保留影响结果的规则、优先级和边界；省略逐步操作说明、显而易见的反馈和无依据的通用异常。
- 源码引用只在能减少歧义时使用。优先输出产品规则，而不是代码讲解。
- 没有内容的可选小节直接省略。

### 6. 自主判断并生成流程图

流程图按需提供。只有分支、回退、互斥、状态迁移或多方协作关系用简短文字难以说清，且图能明显减少阅读量时，才生成 Mermaid 图。是否配图由 AI 判断，不按步骤数、状态数或角色数自动触发。

简单流程、几条规则就能讲清的需求，以及 Demo 或截图已表达清楚的交互，直接省略流程图。配图后正文只补图中未表达的必要规则，不再逐节点复述。

判断与生成规则：

1. 先从本次 PRD 范围中选择最需要可视化的一段逻辑；一次 PRD 通常至多生成一张最有解释价值的图，不为每个功能机械配图。
2. 根据业务逻辑选择 Mermaid 图类型：流程用 `flowchart TD`，状态迁移用 `stateDiagram-v2`，多角色或模块时序协作用 `sequenceDiagram`。直接使用 Markdown 的 `mermaid` 围栏代码块，不调用 `$generate-flow-diagram`，不生成 `.drawio` 文件或 `:::drawio` 指令。
   - 只表达业务步骤、判断、状态和关系，不把 PRD 句子整段塞进节点。
   - 节点使用中文单行短语；补充说明留在 PRD 正文。节点标识与显示文案分开，流程图中文标签使用双引号包裹。
   - 流程图默认自上而下，判断分支标明条件，由 Mermaid 自动布局。
3. 如果复杂逻辑只属于单个功能，把 Mermaid 代码块插入该 `### 2.{n} {功能名称}` 中，放在“需求说明”之后、“功能规则”之前。
4. 如果图表达多个功能组成的端到端主流程，在 `### 1.2 需求范围` 之后新增 `### 1.3 核心业务流程`，并把 Mermaid 代码块放在该小节中。
5. 同一流程图只保留一次，直接嵌入对应位置。
6. 校验 Mermaid 代码块围栏完整、图类型语法正确、节点引用与分支条件一致，并确认其位于对应逻辑附近。若流程图生成失败，继续交付 PRD，并在交付说明中写明失败原因；不得插入空占位。
7. 如果判断不需要流程图，不添加流程图章节、占位符或“不需要流程图”的正文说明。

### 7. 质量门禁

交付前必须检查：

- `src/pages/{project_id}/{page_id}/docs/{需求名称}.md` 已存在，且文件名与一级标题使用具体需求名称。
- `## 2. 详细功能需求` 中每个用例都有真实匹配截图，或有明确截图失败说明。
- PRD 只覆盖本次范围，正文只描述要实现的内容，没有范围排除、非目标或无关能力的未实现说明。
- 标注被解释和重组，而不是按原始顺序复制成清单。
- PRD 正文没有非必要英文词、源码变量名、CSS 类名、DOM 属性名或内部枚举值；技术词已转译为中文业务表达。
- 文字已精简到足以准确实现；没有重复 Demo、截图或其他章节，简单需求使用直接规则，没有多余层级。
- “交互与状态补充”仅在省略会产生实现歧义时出现，保留时沿用原表格、使用简短中文，且没有重复主规则。
- 边界和异常处理是具体的，不是“需提示用户”“保持一致”这类空话。
- 影响实现且尚无依据的决定已列入“待确认”，没有把 Demo 模拟行为误写成产品规则。
- 只有文字难以简明表达且配图能减少阅读量时才有流程图；使用 Mermaid 围栏代码块，同一图只出现一次，位置、语法与业务逻辑有效。

### 8. 交付说明

最终回复用户时说明：

- 生成或更新的文件路径。
- 目标页面、版本和本次范围。
- 使用了哪些功能截图文件。
- 若生成流程图，说明其主题及在 PRD 中的插入位置。
- 有哪些推断、缺失证据或需要产品确认的点。
