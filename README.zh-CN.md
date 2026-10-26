<p align="center">
  <img src="./assets/readme/hero-zh.png" width="100%" alt="Prota：开源的产品经理 AI Agent，把一句话想法变成能点的 Demo 和完整的 PRD">
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>简体中文</b>
</p>

https://github.com/user-attachments/assets/e0dc3442-8645-49b1-8a80-172a8d871f55

## 一个想法，怎样最快变成 Demo，再变成完整的交付物？

**Prota 是专为产品经理打造的 AI Agent。** 你用一句话说出想法，它会自己拆解、设计、写页面，几分钟后交给你一个能直接体验的原型，再根据做出来的东西写出完整的 PRD。写好后发一个链接就能分享，也可以交给 AI 编程工具继续开发。

Prota 在你自己的电脑上运行，使用你自己的模型 API。

```txt
想法  →  能点的 Demo  →  完整 PRD  →  分享链接  →  交给 AI 编程工具
```

## 跟着视频走一遍

### 1. 内置 150 多套设计风格与 9 套 Web 框架

手机端有 150 多套设计风格，Web 端有 9 套组件框架模板：Ant Design、Arco Design、Chakra UI、Element Plus、Mantine、MUI、Semi Design、shadcn/ui、TDesign。设计规范和设计变量为 Agent 提供一致的视觉依据。也可以直接描述需求，让 Prota 自主选择合适的呈现方式与设计。

<img src="./assets/readme/zh/tpl-grid.jpg" width="100%" alt="设计风格模板库">

### 2. 预置产品经理专用技能

Agent 支持产品经理工作流：**产品思考**（分析需求与拆解任务）、**页面设计**（`create-new-page`）、**流程图**（`generate-flow-diagram`，生成可编辑的 draw.io）和 **PRD 生成**（`generate-prd`）。另外还有前端设计、极简风格、高级视觉、改版等设计类技能。技能可以在首页添加、启用或删除。

使用你自己的模型服务，可拉取可用模型列表，也可手动填写模型 ID。对于已支持的模型与接口，输入区会显示**思考强度**或思考开关，选项随模型能力变化；不适用时沿用模型默认策略。

<img src="./assets/readme/zh/skills.jpg" width="100%" alt="四个预置技能：产品思考、页面设计、流程图、PRD 生成">

### 3. 一句话进去，可体验的原型出来

说出想法，Prota 会分析任务、设计并写出页面（`index.html`、`styles.css`、`app.js`），检查代码，再展示实际效果。执行过程可以随时查看。

创建页面默认使用**智能判断**，由 Prota 根据核心任务选择呈现方式，也可以手动指定；本次需求中的明确文字要求优先。

| 呈现方式 | 适合的内容 |
| --- | --- |
| 手机页面 | App 页面与移动端操作流程，保留手机外框 |
| Web 页面 | 网站、看板和业务系统，使用自适应网页布局 |
| 自由画布 | 独立组件、桌面小组件、状态对比、配置与实时预览，不强制设备外框或 UI 框架 |

后续迭代沿用页面已有的呈现方式，除非你明确要求改变。

<img src="./assets/readme/zh/prototype.jpg" width="100%" alt="Prota Agent 根据一句话生成可体验的手机原型">

### 4. 大胆去试，每一版都保留

想换个思路时，就新开一个版本随便改。每个版本都是独立的目录（`v1`、`v2`……），旧版本不会被覆盖，随时可以切回去对比。

<img src="./assets/readme/zh/versions.jpg" width="100%" alt="V4（刷卡片挑目的地）与 V5（一页式行程看板）对比">

### 5. 圈出来写一句，只改你指的地方

打开标注模式，在页面上圈出不满意的地方，写一句要怎么改。Agent 只改这一处，其他地方保持不变。

<img src="./assets/readme/zh/annotate.jpg" width="100%" alt="被标注的按钮已修改，其他区域保持不变">

### 6. 方案定了，一键生成 PRD

原型满意后，可以针对单个功能、模块或整个页面生成 PRD。Prota 结合本次需求、标注与真实源码行为，写清需求范围、功能规则、必要的边界条件和待确认事项，并配上对应功能真实状态的截图。

文档按具体需求命名，统一保存在页面层级，同一页面的不同需求可分别留档。复杂逻辑适合配图时再生成流程图；工作台仍可查看和编辑思维导图、draw.io 图。

<img src="./assets/readme/zh/prd.jpg" width="100%" alt="生成的 PRD，包含需求范围、功能规则、思维导图、流程图和截图">

### 7. 分享只需要一个链接

通过 Vercel 分享单个页面或整个文件夹。有效期可选 **1 天、7 天、30 天或永久有效**，默认 30 天；可以加访问密码，一次复制包含链接、到期时间和密码的分享文本。接收者在浏览器里体验 Demo、查阅文档，你的电脑不需要一直开着。访问校验同时覆盖原型、文档、素材和 ZIP 下载包。

从分享菜单进入**分享管理**，可搜索和筛选记录、查看已发布／仅本地／已过期／已撤回状态、复制分享信息、记录接收对象或备注、导出 CSV 清单，并单条或批量撤回。线上发布成功后，固定分享地址的撤回才生效。

再次分享同一页面版本或文件夹，会更新原链接；发布失败时保留上次成功部署。有效期和撤回不影响接收者已经下载的文件，也不会自动清理 Vercel 历史部署的独立地址。

<img src="./assets/readme/zh/share-doc.jpg" width="100%" alt="分享页：左侧可体验的 Demo，右侧 PRD 文档">

### 8. 交给 AI 继续开发

开发人员可以在分享页一键下载原型和 PRD 的 ZIP 包，直接作为上下文交给 AI 编程工具，让 AI 准确理解产品需求。

<img src="./assets/readme/zh/handoff.jpg" width="100%" alt="下载的 ZIP 包作为 AI 编程工具的上下文">

## 运行原理

<img src="./assets/readme/how-it-works-zh.png" width="100%" alt="浏览器里的 Portal 连接本机 Python 桥接服务和 Node Agent 网关；内容保存在你磁盘上的工作区，可以发布为分享链接或下载为 ZIP">

| 部分 | 作用 |
| --- | --- |
| `portal/` | 浏览器端应用：项目、页面呈现方式、版本、标注、PRD 阅读、思维导图、draw.io 图、分享管理和设置 |
| `server/bridge.py` | 本机桥接服务：提供 Portal 页面，读写工作区，处理截图、打包、分享和模型配置 |
| `server/agent-server.mjs` | Agent 网关：用技能、设计模板和你配置的模型运行 Agent 会话 |
| `src/templates/` | 手机、Web 与自由画布模板、150 多套设计风格、9 套 Web 框架模板 |
| `.claude/skills/` | 上面介绍的预置技能 |

你的项目保存在与程序分开的**工作区**里，默认位置是 `~/.config/prota/workspace`。可以在 **设置 → 存储位置** 里迁移或打开其他工作区，也可以用环境变量 `READIFY_WORKSPACE` 指定。页面、版本、会话、附件和文档随工作区保存，与产品更新分开。分享时会生成独立发布目录，直接上传 Vercel，不通过产品 GitHub 仓库发布业务内容。

## 快速开始

下载并解压完整产品文件夹：**Mac 双击 Prota.app，Windows 双击 Prota.exe**。请保留启动入口与源码目录的相对位置，不要从压缩包内直接运行。缺少环境或依赖时，原生窗口会显示准备步骤并自动安装；都已就绪时直接打开工作台，无需输入命令，也不需要保留终端窗口。支持 macOS、Windows 10/11 的 x64 电脑，以及 Windows 11 ARM64 电脑。

链接分享只需在设置里点击「连接 Vercel」，然后在浏览器中登录授权。Prota 会自动创建或沿用分享项目、获取地址并保存，保留现有数据与分享链接。默认地址不需要购买域名；自有域名托管在其他服务商时，仍需按提示添加 DNS 记录。

[启动与分享教程](./docs/share-setup-guide.md) · [开发者安装说明](./docs/developer-setup.md)

1. **接入模型：** 点击项目列表右上角的齿轮，进入 **设置 → 模型配置**。选择一个预设服务商，或者选「OpenAI 兼容 / 自定义」，填入 API Key。支持 Anthropic Messages 格式和 OpenAI 兼容格式的接口。
2. **新建项目和页面：** 保持「智能判断」并描述想法，或手动选择「手机页面」「Web 页面」「自由画布」，按需指定风格或框架。模型支持时可在输入区调整思考强度。
3. **迭代与文档：** 新开版本尝试方案，用标注提出修改，再针对需要交付的需求生成 PRD。
4. **（可选）分享：** 在 **设置 → 分享配置** 里连接 Vercel，设置有效期和可选密码后发布。已有链接可在「分享管理」中管理或撤回。发布细节见[启动与分享教程](./docs/share-setup-guide.md)。

## 使用须知

- 工作台界面与生成的 PRD 目前以**中文**为主；原型本身可按需求使用其他语言。
- 分享会包含所选版本及其文档，不会自动脱敏，分享前请检查内容。
- 模型 API Key 和个人设置只保存在本机，不会出现在分享内容里。
- 有效期与密码保护用于 Vercel 链接分享；旧的本机／公网服务入口不提供这些选项。历史分享会保留原来的访问策略，重新分享时才应用新设置。
- 更新产品时替换产品文件并重新启动即可，程序会检查依赖变化，沿用已有工作区与设置。

## 开发

```bash
npm run agent:check                                   # 检查 Agent 网关语法
node --test tests/*.test.mjs                          # Node 测试
python3 -m unittest discover -s tests -p "test_*.py"  # Python 测试
```

给 Agent 的项目规约（目录结构、版本迭代、页面注册）见 [AGENTS.md](./AGENTS.md)。

## 开源协议与致谢

Prota 采用 [MIT 协议](./LICENSE)，允许自由使用、修改、分发、商用及闭源使用，只需保留版权与许可声明，其中注明了原始项目为 [lefinite 的 Prota](https://github.com/lefinite/Prota)。

项目中的许多设计模板来自或改编自 [OpenDesign](https://github.com/nexu-io/open-design)，感谢原作者的分享。第三方模板、素材及依赖仍遵循各自的许可证与署名要求。

---

<p align="center">从想法到交付，<b>Prota，让好想法更快落地。</b></p>

<p align="center">如果 Prota 对你有帮助，欢迎赞助一点 Token。</p>
<p align="center">
  <img src="./assets/readme/sponsor.jpg" width="320" alt="微信赞赏码：赞助 Token">
</p>
