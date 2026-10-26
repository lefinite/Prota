# Web 中性运行骨架

此目录用于初始化 `targetDevice: "web"` 页面的自包含文件，但它不再是页面设计模板，也不提供默认后台布局或业务组件组合。

## 框架选择

Web 页面仅在本次顶部“前端框架”选择器明确绑定时执行对应项目级 Prototype Skill。智能判断选择 Web 且未绑定框架时，按需求自主设计，不默认套后台布局。以下步骤只适用于已绑定框架的页面。可能是 Ant Design、Arco Design、Element Plus、Material UI、Chakra UI、Mantine、Semi Design、shadcn/ui 或 TDesign Web。

1. 完整读取选择器注入消息中指定的 `SKILL.md`。
2. 按该 Skill 自己的流程读取页面 Recipe、视觉语言、组件映射、实现说明和质量门槛。
3. 只使用这一套主要 UI 框架，不混入其他框架。
4. 将 React/Vue 页面结构和框架视觉等价实现为本项目自包含的 `index.html`、`styles.css`、`app.js`。
5. 确保不同框架不仅主色不同，布局密度、组件语法、容器、排版和交互反馈也具有清晰辨识度。

Ant Design Skill 判断需要多视图时，默认在同一个 `v1/` 内通过本地状态实现页面切换并保持共享视觉上下文；不要把内部视图误写成版本。

## 骨架职责

- `index.html`：只提供文档声明、样式/脚本相对引用和空白挂载点。
- `styles.css`：只提供浏览器重置与 iframe 运行边界。
- `app.js`：不带任何默认业务交互。

创建页面时必须完整替换占位根节点和注释，不得保留旧的侧边栏、指标卡、表格、Tabs、审批队列等建议型示例。`web-frame` 只提供框架无关的运行骨架，最终 `v1/` 仍只能引用自身的 `./styles.css` 与 `./app.js`。

mobile 页面继续使用 `src/templates/mobile-frame/`，不受此目录影响。
