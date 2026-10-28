# 无限画布 DOM 标注修复验收

验证日期：2026-10-27。基于当前工作区已有的标注实现与 Runtime V7 继续修复，保留其他未提交修改。本次 Runtime 升至 V8，确保已有 V7 画布也能触发升级；没有将当前版本降为方案中的 V5。

## 原因与修复

画布未激活时事件发生在外层，激活后事件发生在画板 iframe。两层必须共用右键计数，并将 Inspector 的文档、消息、坐标及保存目标统一限定到所属画板。现有部分实现还存在延迟菜单取消激活、重载同一 iframe 不重绑 Inspector、列表作用域混用、嵌套状态同步仍指向外层等缺口。

- 未激活三次、已激活两次右键进入标注；相邻间隔 420ms、距离 12 屏幕像素。超时、跨画板、位置超限、编辑拖动、切换和 Esc 重置。画板内容区域延迟显示菜单，标题与画板外菜单保留直接显示。
- 单次右键或 Esc 退出标注，保留画板激活；单次右键显示菜单也保留激活。执行实际编辑操作时退出画板预览，保持原有创建、图片与选择工具可用。
- Inspector 注入所属画板文档；iframe 重载重新绑定，替换或销毁时清理监听器。编辑手势与快捷键受标注状态保护；其他画板不能成为标注目标。
- 选择、悬停消息验证来源、同源性、画板 ID、节点 ID 与路径。父子选择、历史定位与隐藏状态同步均使用画板上下文。
- 坐标按两层 iframe 的真实渲染比例映射，跟随画布平移缩放及画板滚动，标记和高亮裁切到画板边界。
- 沿用原标注弹窗和 annotations.json，以画板归属加 selector 匹配；当前列表按激活画板过滤，全部列表保留其他画板记录。普通页面仍使用原有无 target 数据。
- Agent 反馈沿用现有发送流程，携带 boardId、boards/{boardId}/index.html、selector、真实 DOM 与样式上下文。

## 修改文件

| 文件 | 核心内容 |
| --- | --- |
| `src/templates/infinite-canvas/app.js` | 手势与激活状态、监听器生命周期、消息转发、滚动通知、编辑保护、Runtime V8 |
| `portal/shell.js` | 标注上下文、消息校验、作用域、坐标裁切、嵌套状态同步、页面切换状态清理、升级及草稿保护 |
| `server/canvas_store.py` | 升级接口返回 V8，继续使用原编辑器文件白名单 |
| `tests/infinite-canvas-annotation.browser.mjs` | Portal + Bridge + Agent 服务、真实嵌套 iframe 的完整闭环测试 |
| `tests/infinite-canvas.browser.mjs` | Runtime V8 断言 |
| `tests/test_canvas_store.py` | V4 升级及布局、业务源码、图片、标注和元数据保留断言 |

以上文件部分在本轮开始时已有未提交实现，本轮未覆盖或撤销其他工作。

## 实际运行命令与结果

以下命令均从项目根目录运行，最终结果通过：

```sh
node --test tests/canvas-core.test.mjs tests/canvas-connections.test.mjs tests/canvas-version-model.test.mjs tests/canvas-baseline.test.mjs
```

30 个测试通过，其中 canvas-core 的 11 个测试通过。

```sh
python3 -m unittest tests/test_canvas_store.py tests/test_canvas_versions.py tests/test_canvas_export_versions.py tests/test_canvas_baseline.py tests/test_page_presentation.py
```

22 个测试通过，其中 canvas_store 的 9 个测试通过。

```sh
node tests/infinite-canvas.browser.mjs
node tests/infinite-canvas-annotation.browser.mjs
node tests/canvas-connections.browser.mjs
node tests/page-presentation.browser.mjs
node --check portal/shell.js
node --check src/templates/infinite-canvas/app.js
git diff --check
```

四组浏览器测试、两项语法检查及差异格式检查均通过。标注测试覆盖 15 个主场景及附加断言：三击/双击、菜单、超时/跨板/距离重置、真实 DOM 悬停与点击、右键/Esc、父子选择、重载绑定、消息伪造隔离、编辑快捷键保护、多板同名选择器、保存/重读/更新/删除/定位、实际 50%/100%/200% 缩放、平移、画板滚动及边界裁切、嵌套状态同步、Agent 反馈、手机/Web 普通页面、V4 自动升级、脏状态与恢复草稿保护。最终浏览器 pageerror 为空。

## 兼容性与验证边界

- 复用现有升级接口，只更新编辑器文件并备份原 Runtime；测试逐字节确认 canvas-data.js、画板源码与 annotations.json 保留，后端测试同时确认 assets 与项目元数据保留。
- 本次不改变节点 schema，也不改变工作区已有的 schema 迁移策略；业务工作区和产品代码保持隔离。
- 运行中未保存修改或浏览器恢复草稿存在时延迟升级，不覆盖草稿。清理未保存状态后可在下次加载或修复时继续升级。
- 未新增 UI 系统、数据库或 Agent。没有修改真实业务画板或业务项目配置，也没有提交或发布代码。
- Agent 测试验证真实反馈组装和提交到执行入口的载荷，在模型执行边界截获请求；未调用真实模型修改业务文件。
- 跨域画板保留不可标注提示；当前验收没有发现未解决的功能失败，但未声明跑过整个仓库所有测试。
