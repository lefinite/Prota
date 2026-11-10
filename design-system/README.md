# Prota 产品 UI 设计系统

这是 **Prota 产品工具界面** 的可执行规范。用户生成的 Demo、内部画板与品牌模板不继承这些样式。

## 一张图理解结构

```text
design-system/product.tokens.json  ← 唯一 Token 源文件
  └─ npm run ui:tokens
     ├─ portal/ui/tokens.css              ← Portal 实际加载，兼容 --accent 等旧变量
     ├─ infinite-canvas/styles.css       ← 只同步产品编辑器 Token，自包含分享
     └─ drawio/editor-prota.css          ← 只同步第三方应用外壳 Token

portal/ui/components.css                ← 新产品 UI 复用的 pui-* 控件
portal/ui/showcase.html                 ← 可交互的视觉参照页
docs/prota-ui-guidelines.md             ← 设计、交互、Review 规范
docs/prota-ui-audit-2026-11-10.md       ← 旧代码设计债务基线
AGENTS.md + .github/PULL_REQUEST_TEMPLATE.md ← 开发与交付约束
tests/product-ui-* + tools/ui/lint.mjs  ← 自动检查与截图
```

## 新 UI 如何开发

1. 确认这是产品工具层 UI。若是用户业务 Demo/画板，遵守其自己的页面设计系统，不引用 `portal/ui/*`。
2. 阅读 `docs/prota-ui-guidelines.md`。先找 `portal/ui/components.css` 已有的 `.pui-button`、`.pui-icon-button`、`.pui-field`、`.pui-input`、`.pui-select`、`.pui-dialog`、`.pui-card` 等控件；新模块可以复用这些 class，旧模块按迁移计划逐步收敛。
3. 用 `var(--pui-color-*)`、`var(--pui-space-*)`、`var(--pui-radius-*)` 等语义 Token。新增 Token 只能修改 `product.tokens.json`，随后运行 `npm run ui:tokens`，提交所有生成变更。
4. 打开 `/portal/ui/showcase.html` 与相邻真实页面比较。核对 Hover、Focus、Disabled、Loading、错误、空态等适用状态。
5. 完成后运行以下命令，按 P0/P1/P2 自审并修复；有实际 UI 变更还需要目标业务页面的真实截图和交互回归。

```bash
npm run ui:tokens:check
npm run ui:test
npm run ui:lint
npm run ui:browser
```

PR 内增量 Lint 使用 `npm run ui:lint -- --base <base-commit>`，只拦截**新增**硬编码颜色、`!important`、行内 style 和过小字号；不把旧代码债务一次性变成成千上万的失败项。这不是完整的视觉判断，仍需按规范截图 Review。

`ui:browser` 使用 Playwright Chromium 验证组件参照页在 1440/1024/860/390 宽度无横向溢出、弹窗/Esc/焦点恢复及减少动态效果，截图生成在临时目录（CI 作为构建产物）。如果本地没有 Chromium，先安装依赖与浏览器：

```bash
npm ci --ignore-scripts
npx playwright install chromium
```

## 旧界面如何迁移

- 现阶段根 `--bg-main`、`--accent` 等变量由生成的 `portal/ui/tokens.css` 向后兼容。旧组件仍保留其 DOM/事件，**不自动全局套用新的按钮选择器**。
- 迁移某个旧组件时，先记下当前最终计算样式、相同组件实例和行为测试；再在原 CSS/DOM 位置收敛到 Token/`pui-*` 类，删除覆盖链，并保存前后截图。
- `#6366F1` 是品牌强调/描边色，与白色对比度约 4.47:1；**小字号白字实心主按钮**要用 `--pui-color-primary`（`#4F46E5`，约 6.29:1），Hover 用 `--pui-color-primary-hover`。旧样式仍使用 `--accent` 的地方属于后续迁移范围，不能宣称现有全部按钮已达标。
- 无限画布的编辑器运行时采用生成的**内嵌 Token**，不引用 Portal 外部 CSS；历史版本、业务画板的私有样式与分享 ZIP 不得因设计系统升级而改变。
- 第三方 draw.io 只同步工具外壳的基本色；不能全局覆盖图形颜色或编辑内容。

## 维护边界

- `product.tokens.json` 是唯一手改的 Token 源；生成 CSS 中被标记的段落禁止手改。
- `.pui-*` 必须是**显式 opt-in**。不能在产品层写影响 iframe 业务内容的无作用域元素选择器。
- CI 的静态 Lint 用于阻止新增设计债务；P0/P1 交互错误、信息层级和美观性仍需人工/Agent 视觉复审。
- 规范、组件、Token 和验收清单应在同一个 PR 中同步更新，不要只改变一份文档。
