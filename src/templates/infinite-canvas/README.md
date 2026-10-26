# 页面级无限画布 · 编辑器运行时 2

完整复制本目录到工作区 `src/pages/{projectId}/{pageId}/{version}/`。注册一个顶层页面：`targetDevice: "canvas"`、`pageMode: "infinite-canvas"`。旧的 canvas-frame 保持不变。

## 页面与画板

画布是页面，不是项目总览。内部画板、组件、素材不注册为顶层页面。业务界面位于本版本 `boards/{节点ID}/index.html`、`styles.css`、`app.js`，在画板节点的 src 中关联。Agent 负责自动创建和关联，不要求用户填写文件路径。index.html、styles.css、app.js、canvas-core.js 是编辑器运行文件，不要改成业务页面。

`canvas-data.js` 是布局源文件：`window.PROTA_CANVAS = { ... };`，支持 file:// 和静态分享，不需要构建。顶层含 schemaVersion=1、revision、nodes、viewport。保持文件为纯 JSON 赋值，不加入执行逻辑。

节点有稳定 id、type（board/group/text/note/rect/ellipse/image）、name、x、y、width、height。可选 parentId、text、color、textColor、fontSize、padding、opacity、radius、locked、src。**坐标始终是世界坐标**，parentId 表示容纳关系，不能形成循环。数组顺序决定绘制顺序。分组包围盒由子级计算，改变分组位置会移动整个子树。移动画板也会移动子级；移动对象进入 / 移出画板会更新归属。图层树支持拖入画板和分组，属性区可移出容器。

图片拖入或粘贴后先临时嵌入，保存时服务端以内容哈希写入当前版本 assets/，更新节点引用，降低布局文件和撤销记录大小。单张上限 4 MB。外部 assets 引用必须是本版本相对路径。

复制已有业务画板会复制其代码目录，副本拥有独立 src。group 复制会重新映射所有后代 ID 与 parentId。按钮、输入框、信息卡、导航栏是可编辑的组合素材，属于设计对象；可运行的业务交互由 Agent 在画板 HTML 中实现。

## 编辑操作

- V 选择、H 抓手、T 文本、R 矩形、O 圆形、F 自由画板。绘制工具可拖出尺寸，或使用添加菜单。
- 空格拖动 / 中键平移，滚轮平移，Ctrl / Cmd + 滚轮缩放；触屏双指缩放。缩放范围 5%–400%。
- 框选与 Shift 多选，8 个方向尺寸手柄，Shift 保持宽高比 / 移动方向，Alt 拖动复制与暂时关闭吸附。
- 对齐辅助线、方向键移动（Shift 步长 10）、图层排序、锁定、F2 重命名、右键操作。
- Ctrl / Cmd + G 分组，Shift + Ctrl / Cmd + G 取消分组；Ctrl / Cmd + D 复制；Ctrl / Cmd + C/V 在当前编辑器内复制粘贴。
- 文本、便签双击原位编辑，Esc 取消当前文本编辑；画板双击进入业务交互，Esc 回到画布。
- 支持 60 步本地撤销重做。接收外部 / Agent 更新后清空旧撤销栈，避免用旧状态覆盖新结果。

## Agent 工作流

画布内输入框、选中对象工具栏、空画板生成按钮均指向现有 Portal Agent 会话。未选对象表示整张页面，选择对象后自动显示作用范围。

发送前保存当前文档，保存冲突时不启动 Agent。Portal 建立 / 复用当前页面会话，绑定项目、页面、版本与选中对象 ID。保留原聊天输入草稿；展开会话时属性栏让出空间，关闭会话恢复。可进入原有修改记录查看差异与撤销本轮。任务执行中可平移缩放，暂停对象编辑。完成后读取最新数据并更新画板内容，保留视角和仍存在的选中对象；有未保存更改时不覆盖。Agent 修改业务画板代码后刷新其 iframe，普通选择、拖动和属性调整不重载画板。

页面属性里的源码路径属于折叠的开发者选项。普通用户只需要选择画板并描述要求。

## 保存与恢复

结构编辑停止 800 ms 后自动保存，也支持保存按钮和 Ctrl / Cmd + S。本机接口 `/api/canvas/save` 以完整 baseline 与 revision 检查并发，原子替换布局文件。每次保存保留最近 10 个布局历史文件到 `.canvas-history/`，不进入分享或 ZIP。

浏览器维护当前文档的本机恢复草稿；重新打开可选择恢复。保存失败、并发修改、格式错误有明确提示和重试入口。冲突可先导出备份，再读取外部版本。视角单独记忆在当前浏览器会话中，不因平移缩放频繁保存文档。

Portal 检测旧运行时后升级当前打开的无限画布编辑器，保留 canvas-data.js、boards/、assets/，原运行文件备份在 `.canvas-runtime-backup/`。只读分享不触发升级。工作区切换期间禁止保存和升级。

迭代、分享和 ZIP 包含整个版本。分享只读，保留平移、缩放和画板交互；独立静态文件可临时编辑并导出，但无法直接写回磁盘。

## 范围与验证

这是一套面向 Agent 原型工作流的页面编辑器，不是完整的 Figma 文件兼容实现。暂不支持实时多人协作、矢量路径编辑、约束 / Auto Layout、跨文档组件实例同步、画板内部任意 DOM 的可视化拖拽。父子关系支持整体移动和组织，不提供子内容裁切或响应式约束。批注仍针对外层画布对象，内嵌 DOM 批注与分画板 PRD 尚未适配。

测试：`tests/canvas-core.test.mjs`、`tests/test_canvas_store.py`、`tests/infinite-canvas.browser.mjs`、`tests/page-presentation.browser.mjs`。Portal 测试使用真实会话 API 与 iframe 消息链，只替换模型响应，不产生模型费用。
