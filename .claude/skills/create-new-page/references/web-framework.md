## 已绑定 Web 框架的执行规则

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

