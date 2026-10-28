# Progressive Preview Engine（PPE）

PPE 被动读取 Agent 实际写入的页面文件，通过现有 SSE 发布 `preview_revision`。不修改 Prompt、Skill、工具顺序或生成文件，也不调用模型。

## 内部开关与回退

默认关闭，不增加普通用户设置项。开发时可在 Agent/Bridge 启动环境中设置 `PROTA_PROGRESSIVE_PREVIEW=1`。更推荐使用本机内部接口，它会将开关保存到产品配置目录的 `preview.json`，无需重启 Agent：

```sh
curl -X POST http://localhost:8080/api/preview/config \
  -H 'Content-Type: application/json' -d '{"progressivePreview":true}'
curl http://localhost:8080/api/preview/config
```

关闭时提交 `{"progressivePreview":false}`。此配置优先于环境变量；新任务恢复原预览链路，执行中的 Observer 最迟在下一次补偿扫描停止，并发出 `preview_disabled`。Portal 退出渐进预览、恢复正式页面及后续 `run_live_changes` 刷新。不会取消 Agent、覆盖本机画布草稿或修改源文件。关闭期间刚生成的页面仍由原有注册流程处理。

## 实现边界

- `server/preview/`：范围选择、逐目录 `fs.watch`、补偿扫描、SHA-256 去重、稳定性验证、快照和事件。250ms 稳定窗口、1000ms 最大合并窗口、500ms 刷新间隔，参数集中在 `config.mjs`。
- 创建页面/迭代版本时排除运行前已有的目录，避免把无关页面临时展示出来。目录和入口可以晚于任务启动出现。不为明确的 PRD、流程图等任务启动监听。
- 候选快照从内存中的同批文件生成；读取前后比较完整文件集、内容哈希及文件状态，通过验证后原子提交。HTML/本地静态依赖/JS 基础语法校验不执行业务脚本，不做完整构建。浏览器容忍的 HTML/CSS 不通过严格解析器强行拒绝。
- 快照位于系统临时目录，按配置目录、工作区、runId、revision 隔离。单页最多 2000 个文件/50 MiB，每任务保留最近 10 个修订，每工作区缓存最多 512 MiB，30 分钟过期。最多 256 个原生目录监听，其余由扫描补偿。
- `server/preview_http.py`：专用只读资源路由，检查 loopback、Host、Origin、Fetch Metadata、路径与符号链接；GET 和 HEAD 使用相同权限。仅映射当前工作区的缓存，不映射到业务目录。配置接口也仅供本机访问。
- `portal/preview/`：独立状态和控制器，拒绝旧任务/修订，合并待处理更新，CSS 优先更换样式表，HTML/JS 使用双 iframe 加载成功后再切换；支持 reduced motion。用户切项目、页面、版本或顶层视图后不会抢回焦点。
- 新页面可在未注册前临时显示；此时不改变元数据、活动页面标识或会话绑定。成功完成后关联已注册页面，切回正式 URL。失败时保留最后有效预览。
- 画布扩展 `reloadFromDisk(false, {previewSync:true, snapshotUrl})` 与 `refreshBoards(boardIds, {snapshotUrl})`。只读同步可绕过 Agent 编辑锁，但保留 dirty/editing/saving 保护，异步读取后再次检查；不写布局。画板业务 iframe 就绪后才替换，保留外层运行时、视角、选区与其他 iframe。事件中的目录 ID 可以映射到不同的节点 ID。布局新增节点始终来自真实 `canvas-data.js`。

根绝对资源引用、跨版本依赖、特殊构建输入、无法完成静态校验的源码会等待正式预览，不改写生成代码。运行期错误和所有外部资源健康无法在零注入条件下完全预判；目前以静态有效性和浏览器可显示内容作为保守门槛。双实例运行可能短暂重复网络/存储副作用，不能保证任意 Demo 的运行状态跨完整 iframe 重载保留。历史画布运行时缺少新接口时不会由 PPE 自动改写其文件，待任务结束按既有正式预览处理。

## 验证

```sh
node --test tests/preview-*.test.mjs tests/new-page-context.test.mjs tests/canvas-core.test.mjs
node tests/progressive-preview.browser.mjs
node tests/infinite-canvas.browser.mjs
node tests/page-presentation.browser.mjs
```

测试使用隔离的临时工作区和本机服务，不调用真实模型。覆盖不完整文件、延迟依赖、JS 错误、同内容去重、重复/丢失事件、重命名、重叠任务、工作区失效、容量限制、敏感文件与符号链接、路径穿越、请求来源、失败保留、CSS 状态保留、临时新页面、导航保护、正式结果源文件哈希，以及画布独立刷新和草稿保护。

尚需发布前实测：Windows 文件系统/浏览器运行、真实模型代表性任务的耗时与质量对照、P95 首次可用修订延迟以及 CPU/内存统计。不要将建议性能预算当成已测结果。灰度前保持默认关闭。
