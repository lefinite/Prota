# 无限画布共享 Runtime

本地画布使用产品当前编辑器；分享和 ZIP 固定发布时的完整 Runtime。工具更新不再复制到每一个业务页面，也不依赖手动提高 runtimeVersion。

## 源码和业务文件

- `src/templates/infinite-canvas/` 继续作为编辑器视图、CSS 和引擎的唯一维护源，兼容现有测试夹具。没有另建一份手写视图或同步维护第二套 JS/CSS。
- `src/canvas-runtime/boot.js` 为经典脚本启动器。`editor-shell.js` 从唯一 `index.html` 视图自动生成，保留原有 DOM、选择器和消息接口。
- `src/templates/infinite-canvas-document/` 只包含轻量 `index.html` 和空 `canvas-data.js`，用于新建画布。
- 业务版本保存自己的布局、节点、`boards/`、`assets/`、批注和文档。普通 Web、手机和 canvas-frame 页面仍使用原来的独立文件规则。

保留原模板路径是实施时对方案目录建议的调整：已有大量测试、生成提示和旧页面兼容逻辑使用该路径。通过虚拟路由直接使用这唯一源码，避免为了目录迁移再制造一份必须同步的编辑器副本。

## 本地加载

`server/canvas_runtime_http.py` 在 GET/HEAD 中严格识别：

```
/src/pages/<project>/<page>/vN/__prota_runtime/<白名单文件>
```

只向实际存在无限画布文档的版本开放；拒绝路径穿越、符号链接和非白名单文件，不提供目录列表。资源 `Cache-Control: no-store`，修改产品源码后下次加载即生效。

对尚未迁移的旧画布，服务端只读地提供共享入口，布局与业务文件不变。因此旧画布无需等待复制修复便能使用当前工具。Portal 在无未保存编辑、恢复草稿、Agent/预览任务或工作区切换时，自动将其磁盘入口迁为共享入口；忙碌时延后重试。迁移只发生一次，此后的工具更新不再迁移页面。

本地文件内容根据所有源文件的 mtime/size 缓存并重新计算 SHA-256，内容哈希不以数字工具版本代替。Runtime manifest 包含每一个资源的 SHA-256；依赖顺序、文档兼容版本等也放入受哈希保护的 `runtime-contract.json`。打包与固定版本读取会校验清单、文件完整性及哈希。元信息脚本由同一 manifest 生成并校验，不通过 fetch 读取本地 JSON。

`window.protaCanvas` 保留原接口，新增 `runtimeHash`、`shellFormat`、`documentSchema`；原来的 `runtimeVersion` 保留兼容。文档 schema、业务 vN、BoardRevision 和工具哈希分别管理。

## 分享和下载

统一打包逻辑位于 `server/canvas_runtime_package.py`。

- 创建共享画布分享时，Runtime 固定到工作区 `data/share-archive/__prota_runtime/<hash>/`；业务文档及页面文档同时冻结到 `data/share-archive/__prota_canvas/<snapshotHash>/`。
- 分享元数据中的 `canvasRuntimeHash` 固定工具代码，`canvasEntryPath` 指向内容快照，避免后续发布其他分享覆盖先前分享的同一页面版本。PRD/图表文档路径也绑定同一快照。
- Vercel 暂存目录将已识别的共享 bootstrap 改写为 `/__prota_runtime/<hash>/boot.js`。相同 Runtime 只安装一份，业务 iframe 继续相对寻址。
- 只有暂存文件发生改写；工作区原页面、`canvas-data.js`、board 源码、素材和批注不因打包而变化。
- Gateway 对该分享引用的 Runtime、业务快照、图片和 ZIP 建立精确授权，沿用现有密码、会话、有效期及 `private, no-store`，没有公开的 Runtime 通配路由。
- ZIP 在 `vN/__prota_runtime/` 内实际放入完整固定 Runtime，入口仍用相对脚本路径。文件夹 ZIP 中每个页面自己的版本目录均可独立打开。ZIP 与 HTML 使用同一个冻结的业务快照和 Runtime。
- 旧格式及普通页面继续原打包分支；既有线上快照不迁移。撤回分享只清理其独占的 Runtime/业务快照，不删除其他分享还在引用的哈希资源。
- 冻结失败、缺资源、哈希不符或不兼容文档会中断构建；现有部署成功后的快照提交机制保持不变，不以半成品覆盖线上内容。

启动器、视图、CSS、引擎和 Mermaid 图表使用经典脚本与相对资源路径，支持解压后直接通过 `file://` 离线打开。Agent 生成的业务画板如果自行引用外部服务或 CDN，其外部依赖仍需另行处理。

## 迁移、迭代和回退

`/api/canvas/upgrade` 现在将旧入口迁为 shared shell，不再全量复制编辑器。迁移前校验文档兼容性并在 `.canvas-runtime-backup/shared-v1/` 保存旧入口及已知工具资源和校验表；入口原子替换后退役顶层已知旧工具文件，任何业务 `boards/*/app.js`、样式、布局或素材均不触碰。清理失败会恢复旧工具和入口。

`scripts/iterate.sh` 与 Portal 迭代共用 `scripts/copy-page-version.py`：无限画布只复制业务文件并生成共享入口，普通 Demo 仍整体复制。原版本不变，稳定 ID 与独立版本目录保留。

供维护人员使用的诊断命令（正常使用不需要操作）：

```
python3 scripts/canvas-runtime.py status
python3 scripts/canvas-runtime.py build --output /绝对路径/runtime-build
python3 scripts/canvas-runtime.py migrate --workspace /绝对路径/工作区
python3 scripts/canvas-runtime.py rollback --workspace /绝对路径/工作区
```

批量迁移命令只应在无人编辑和 Agent 空闲时使用；日常迁移由 Portal 的编辑/任务保护控制。批处理逐项输出 legacy/shared/blocked/failed，失败返回非零，不静默忽略。

可通过服务进程环境变量回退创建、迁移和打包行为：

| 环境变量 | 默认 | 设为 0 |
| --- | --- | --- |
| `PROTA_SHARED_CANVAS_RUNTIME` | 1 | 新建退回旧模板，未迁移入口使用原文件；已创建的 shared 页面仍保留资源服务 |
| `PROTA_CANVAS_LEGACY_MIGRATION` | 1 | 暂停入口迁移，保留业务与旧文件 |
| `PROTA_CANVAS_PACKAGE_V2` | 1 | 阻断新的共享格式打包，保留现有导出和普通格式 |

`PROTA_CANVAS_RUNTIME_HASH=<已缓存的完整哈希>` 将本地共享资源切到已校验的固定 Runtime，无需回滚业务数据。首次加载本地 boot 即持久固定当前完整 Runtime，因此后续可选择已保留的版本。首次从 legacy 过渡需要回退时，可关闭 legacy 自动迁移并恢复备份入口；不能简单停止为既有 shared 页面提供资源。

## 验证记录（2026-11-05）

通过的重点检查：

- `tests/test_canvas_runtime_package.py`：哈希变化与篡改/缺失阻断、GET/HEAD 和路径白名单、业务无损迁移及回退、独立迭代、ZIP 固定、混合文件夹 Runtime 去重、Gateway 精确授权、冻结 PRD/MCP、旧分享在发布其他分享后不变、撤回不误删。
- `tests/canvas-editor-upgrade.test.mjs`：共享页不按数字版本复制文件，强制刷新不丢草稿，旧入口在 Agent/预览/未保存状态下延后。
- `tests/canvas-shared-runtime.browser.mjs`：真实 Bridge 创建/加载两张画布，修改一次 CSS 且不提高数字版本后两张均更新；旧入口兼容及迁移；业务 iframe 不因面板编辑重载、样式不污染；实际 `VercelDeployer.prepare()` + `prepare_gateway()` 产物经真实 Gateway 和浏览器访问；关闭本地产品服务后密码分享、固定工具哈希、ZIP 和有效期控制正常；实际解压并在断网 `file://` 下操作业务按钮、渲染 Mermaid，无 HTTP 请求。
- Agent 渐进预览通过同一 Bridge 获取并校验 Runtime，再与业务快照一起冻结到预览缓存；预览资源仍通过原有本机权限路由提供。真实浏览器已验证共享画布预览的工具和业务 iframe。
- 现有画布后端、发布打包、分享管理、文本编辑、画板固定状态和渐进预览专项回归。

`tests/canvas-runtime-performance.browser.mjs` 在当前机器 Chromium headless、1440×1000、1000 节点/50 个 iframe 下，各运行三次，记录实际结果：

| 指标 | 旧方式 | 共享 Runtime |
| --- | ---: | ---: |
| 场景就绪中位数 | 238 ms | 213 ms |
| 平移帧耗时 p95（三次中位数） | 27.8 ms | 26.9 ms |
| 编辑至自动保存完成中位数 | 87 ms | 131 ms |

这是本机抽样结果，不是跨机器性能保证；渲染与保存引擎未更换。保存测量包含浏览器输入和轮询开销。

已知基线问题：旧 `tests/infinite-canvas.browser.mjs` 在第 117 行用 `textContent()` 读取 textarea 的编辑值，失败结果为空；关闭共享 Runtime 后同样失败。当前文本专项测试通过。本次保留原总览测试，未为通过测试改变现有编辑体验。画板固定状态专项首次与多项浏览器测试并行执行时有一次状态时序断言失败，单独复跑新旧两种加载方式均通过。

当前工作区实测：11 个既有无限画布入口均解析到同一个共享 Runtime；首次对 1312 个布局、业务画板、素材、批注和页面文档文件逐字节哈希核对，均保持不变。后续收尾期间 `readify/reader-landscape/v2/boards/` 下 14 个业务 JS/CSS 出现外部并行更新，重构未写入这些路径，也未覆盖这些更新；所有布局和其余 1298 个记录文件不变。产品服务和 Agent 服务已在空闲时更新。
