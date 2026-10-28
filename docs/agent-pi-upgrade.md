# Pi 构建、发布与升级

## 开发构建

最低 Node.js 版本为 22.19.0。产品依赖和 Pi 依赖分别使用各自锁文件。

```sh
git submodule update --init --recursive
npm ci --ignore-scripts
npm run pi:build
npm run pi:verify
npm run agent:test
```

构建检查官方 origin、Release Tag、Commit 与干净源码，再使用上游固定模型目录和官方打包流程。Prota Extension 同时编译进运行时清单。开发构建需要访问 npm、官方源码和固定模型目录；用户安装完整产品后不需要这些操作。

源码白名单导出不复制 Git 历史。`pi-version.json` 与 `.gitmodules` 保留上游引用；若从无 Git 元数据的导出包建立开发仓库，先将 `vendor/pi` 注册为官方 Git Submodule，再检出版本锁中的 Tag/Commit。普通产品启动仅使用已打包的 `runtime/pi`，不访问 Submodule。

## 发布

```sh
python3 tools/public-release.py /absolute/path/to/new-release-directory
```

导出目录必须尚不存在且位于产品目录之外。脚本先验证 Pi 完整性和 RPC/Extension 启动，再按已验证 manifest 复制运行时；安装后的启动器再次验证清单。运行时内部 npm 相对链接仅在 manifest 验证通过且目标没有越界时保留。源码、扩展、版本锁、许可声明与相应测试随白名单导出。

`runtime/pi-artifacts`、用户配置、API Key、会话、上传文件、工作区页面和日志不属于 Pi 发布输入。整个导出仍须通过原有私有数据扫描；发现问题必须审查和修复，不能跳过审查发布。跨平台发布应在对应平台构建并验收；CI 上传的是保留链接和可执行位的 tar.gz。

启动器不会在用户机器拉取、重新构建或自动升级 Pi。缺失或被修改的运行时会得到明确错误，用户需安装完整产品包。产品 npm 依赖的就绪检查与 Pi 运行时校验分开，避免损坏 Pi 时反复执行 npm 安装。

## 检查与更新

```sh
npm run pi:update -- --check
npm run pi:update -- --tag vX.Y.Z
npm run pi:build
npm run pi:verify
npm run agent:test
```

`--check` 仅读取官方 GitHub Release。指定 `--tag` 才更新本地源码引用和版本锁，且只能选择比当前版本更新的已发布稳定 Release，不接受 main、草稿或预发布版本。精确 Commit 从拉取后的官方 Git Tag 解析。更新器不修改 Pi 核心、不自动提交或发布；构建失败时现有已验证运行时保留，版本锁与旧运行时不符时启动校验会拒绝使用。需要撤回失败升级时，恢复本轮版本锁和 Submodule 引用，再重新构建，不能继续发布半更新状态。

`.github/workflows/pi-upstream-update.yml` 每周检查一次新 Release。发现新版本后，在 macOS、Windows 和 Linux 上构建、校验并运行契约与 Gateway 集成测试。全部通过后才创建 `codex/pi-upgrade-*` 草稿 PR，包含旧/新版本、精确 Commit、上游摘要和测试范围；已有升级分支保持原样，不强推覆盖。流程不会自动合并或更改用户安装。

每次升级必须审查 RPC、Extension 和 Session 公开接口变化。自动化本机模型端点测试不能代替真实 Provider、图片/推理参数、完整原型/画布/PRD、全新桌面安装和人工视觉质量验收。这些是发布前仍需完成的验收门槛。
