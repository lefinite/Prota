# Prototype Edition — Optimization Notes

本版本由原 Ant Design 中后台 Skill 重构为 **高保真产品原型 Demo 优先**版本；支持单页，也允许 Agent 按产品意图主动生成多页面原型。

## 核心变化

1. `SKILL.md` 从 production-ready 工程生成改为 product prototype generation。
2. 决策顺序从“组件类型 → 模板”改成“业务目标 → Page Archetype → 信息架构 → 页面模板 → 组件”。
3. 新增 Prototype Completeness：需求不完整时主动补齐合理字段、状态、操作与页面内容。
4. 新增 Prototype Scope / Page Flow：不限制单页；当列表、详情、编辑、配置、结果或流程无法在一个页面自然表达时，Agent 可主动新增页面并建立演示跳转。
5. 新增 Mock Data 规范：禁止 Test 1 / User A 等低真实感数据。
6. 新增 Demo Interaction 规范：允许本地 state、setTimeout、静态数据模拟真实交互。
7. 新增 6 个页面级模板：数据管理、对象详情、Dashboard、项目工作台、设置、AI 工作台。
8. 原 component reference 降级为高级视觉细节参考；与原型目标冲突时以 `SKILL.md` 为准。
9. 弱化 Router、权限、真实 API、生产部署、严格 TS、测试等工程要求。
10. 保留 `global-style.css`、原组件模板和高价值视觉约束。
11. 修复原始 Skill 的 4 步 Steps 选型重叠，以及 BatchTable 操作列模板与 reference 冲突。

## 使用建议

典型原型流程：

`SKILL.md → prototype-flow.md（判断单页 / 多页） → page-archetypes.md（逐页选型） → scripts/pages/最接近模板 → mock-data.md / demo-interaction.md（按需） → component reference（只在需要细节时）`
