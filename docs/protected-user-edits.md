# 人工文案持久化与恢复

2026-11-07。本次交付是安全优先的 P0 实现，不代表原方案 Phase A–C 全部上线门槛已通过。

## 保存行为

标准页面的静态 HTML 文本可以直接保存。编辑器在选中目标时取得文件基线；提交先记录原始意图，再唯一定位源码节点，保留修改前后完整快照，持久记录 prepared 状态，暂存并 fsync，复查基线，原子替换并读回校验。界面区分“已写入源码，预览确认中”和重新加载确认后的“已保存”。预览失败不撤销源码，不显示已保存。

文本前后空格、换行、HTML 实体、中文和 Emoji 原样处理。重复文本仅在目标唯一时修改；不写 CSS、注释、script 或隐藏节点。混排子节点、动态 JS/TSX、任意 JSON 数据绑定目前返回 unsupported，保留编辑意图，需通过代码修改。内部画板直改继续关闭，画布根运行时禁止作为业务文案目标。

`portal/modules/copy-edits/index.js` 提供修改历史、冲突提示、预览重试、带并发校验的撤销、明确接受当前源码和恢复记录下载。恢复下载包含提交前后源码及原/新文案，只通过本机接口获取。待处理冲突排在历史第一页。

`/api/copy-edits` 仅是旧请求格式的兼容入口，所有写入均调用新服务，不再生成运行时补丁，也不将旧的 patched 当成功。兼容客户端应提供每项 clientEditId；不提供的旧客户端只能获得服务端分配的新操作，不具备客户端重试幂等保证。

## 持久数据

- `data/user-edits.sqlite3`：SQLite WAL、synchronous FULL、schema version 1；操作、事件、文件效果、Agent 租约。
- `data/user-edit-assets/snapshots/{sha256}`：不自动清理的完整源码快照，写入和读取都验证哈希。
- 原/新文案及 DOM 上下文存于 request JSON；文件效果包含目标路径和 before/after SHA-256。

源码快照先于文件提交；prepared 记录同时是可恢复日志。中断后，当前文件为 before 时完成已准备的提交；为 after 时完成账本提交；两者均不匹配时保留外部源码并标冲突。未完整准备的意图可重新定位。相同 clientEditId 的不同请求返回冲突。

HTTP 静态服务明确拒绝账本及快照目录。页面 ZIP 不包含全局账本或快照。工作区迁移通过 SQLite backup API 复制包括 WAL 在内的已提交状态，并检查数据库内容与 integrity_check；恢复材料随工作区迁移。不得只复制 sqlite 主文件充当运行中数据库备份。

Agent 检查点排除账本和恢复资产，避免短期检查点回滚长期保护记录。不要对新 schema 强行降级；服务拒绝打开未来 schema。

## Agent 协调与版本

Agent gateway 通过 `server/user-edits.mjs` 调用 Python 协调器，和编辑服务共享跨进程锁。租约持久保存运行 ID 和 PID；Agent 活跃时编辑排队，结束时处理队列、检查人工目标并在结果中提示冲突。进程不存在的旧租约会回收。文件变更边界、Bridge 启动及每 5 秒后台扫描、历史查询均触发检查；未使用文件观察器作为唯一保护。

当前采取工作区级保守门禁：不同 Agent 仍可并行，但存在任一活跃 Agent 时直改统一排队。对源码中无法证明仍成立的人工目标生成冲突并保留快照，不强制重放覆盖 Agent。尚未实现语义三方自动合并及页面级并行直改租约；PID 复用的身份强化仍待补充。

通过现有 `copy_version` 复制标准页面时，在新版本创建独立保护记录并记录 copiedFromEditId；后续版本冲突不会影响原版本。Agent 绕过统一复制器自行复制目录时，暂不能自动继承账本身份，但已复制的业务源码仍包含生效文案。

## 旧补丁盘点与导入

只读盘点业务源码及已有 app.js 备份：

```sh
python3 -m server.user_edit_reconcile inventory --root '/工作区绝对路径'
```

导入前完整保留现场；以下命令只新增本地快照和待审查记录，不改业务源码、不删除旧补丁：

```sh
python3 -m server.user_edit_reconcile legacy-import --root '/工作区绝对路径'
```

导入幂等，以来源路径、原始文件哈希和补丁序号标识。旧原文无法从补丁中推断时保留空 originalText，绝不伪造已保存。发现根 app.js 仍含旧补丁时，画布运行时升级、共享入口迁移和会丢弃根运行时的画布版本复制会拒绝继续。待人工验证真实业务源码和恢复点后，再另行清理补丁。本次未执行用户真实工作区导入或事故恢复。

## 关闭与回滚

设置 `PROTA_PROTECTED_USER_EDITS=0` 可停止接受新的直接源码修改和队列写入；新输入仍写账本并返回无法直改，绝不退回旧补丁路径。历史、快照和冲突保留。回退产品版本前先完整备份工作区；旧产品不理解新保护契约，不应继续运行旧直接编辑入口。

公开发布仍应使用项目既有白名单导出流程；本次没有推送、部署或清理用户业务数据。

## 验证结果

所有数据写入和故障注入均在临时独立工作区进行。

| 命令 | 结果 |
| --- | --- |
| `python3 -m unittest discover -s tests -p 'test_copy_edits*.py' -v` | 26 通过；含 100 次修改、重试、唯一定位、基线竞争、替换前后中断、快照、撤销、版本继承、旧补丁升级保护 |
| `node --test tests/protected-user-edits.test.mjs` | 3 通过；真实跨进程租约、并行 Agent 排队、终态冲突、保护服务失败关闭 |
| `node tests/copy-edits.browser.mjs` | 通过；真实标注界面、空格/Emoji、重载验证、100 个不同目标、Bridge 重启、3 轮模拟 Agent 文件变更、ZIP、可见冲突、静态访问拒绝 |
| `python3 -m unittest discover -s tests -p 'test_canvas_*.py' -q` | 42 通过 |
| `python3 -m unittest discover -s tests -p 'test_workspace.py' -q` | 11 通过；含活动 WAL 数据库安全迁移 |
| `node --test tests/canvas-editor-upgrade.test.mjs tests/preview-*.test.mjs tests/annotation-page-mode.test.mjs` | 29 通过 |
| `node --test tests/pi-*.test.mjs tests/magpie-gateway.test.mjs` | 85 通过；含真实 Pi 工具调用与恢复 |
| `node tests/normal-page-annotation.browser.mjs` | 通过 |
| `node tests/infinite-canvas-annotation.browser.mjs` | 未通过：第一阶段右键激活画板 interacting 为 0；另一次运行遇到运行时重载中的 editor 未定义 |
| `node tests/pi-canvas-concurrency.browser.mjs` | 未通过：切换会话后两个画板目标保护高亮未同时保留 |

最后两项在隔离副本移除本次新增界面入口、Agent 租约包装、文件变更扫描及后台恢复接入后，仍复现同一失败。此对照证明这些接入点不是必要触发条件，并不等同于全部原始基线已通过。未跳过或修改失败断言。

## 与完整方案的差距

完整 T01–T18 发布门槛尚未达成，不能据此标记整个 P0 方案正式完成：

- 缺少 JS/TSX/JSON 的语法级定位、内部画板身份验证和直改开放。
- 缺少语义三方合并、页面粒度租约和 PID 复用强化；当前明确冲突兜底。
- 旧补丁已提供安全盘点/备份导入，但未提供自动源码迁移与验证后退役。
- 存在上述两条画布浏览器回归失败；跨平台、真实进程强杀的所有 fsync 边界和完整升级/复制/分享全链路矩阵未完成。
- 未取证或恢复用户历史事故，不作历史丢失内容可全部恢复的承诺。

非合作外部进程仍可在最终哈希检查与 rename 的极短窗口直接写文件。租约消除受管理 Agent 的并发写入，后置检查和长期快照提供外部写入冲突证据；普通文件系统没有面向任意写入者的原子 compare-and-swap，不能声称能阻止所有外部程序覆盖。
