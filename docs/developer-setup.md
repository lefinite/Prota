# 开发安装与维护

普通用户在 Mac 双击 `Prota.app`，在 Windows 双击 `Prota.exe`，不需要以下命令。图形启动流程见[启动与云分享](share-setup-guide.md)。

开发环境需要 Node.js 22.9+、Python 3.9+。开发者可以执行 `npm ci` 后运行 `bash scripts/run.sh`。后者保留前台日志，属于开发入口。

`npm ci` 或 `npm install` 的 postinstall 会在独立的 `node_modules/.prota-vercel/` 中安装 `vercel@latest`。此工具依赖与产品锁文件分开，安装时显式查询 latest，正常启动及分享不会升级。

开发者可以运行 `npm run vercel -- --version`、`npm run vercel -- login` 和 `npm run vercel:update`。使用 `--ignore-scripts` 安装时需要另外运行更新命令。终端操作不是普通用户的安装或连接流程。

两端共用 `scripts/desktop-launcher.mjs` 的依赖检查、工作区初始化和服务就绪检测。macOS 使用系统 JavaScript for Automation 图形界面；Windows 的 GUI 子系统 `Prota.exe` 在后台运行系统自带的 Windows PowerShell 5.1 / Windows Forms。Node/Python 均缺失时也能显示准备状态，无需预装 Go、Node 或 Python，无需管理员权限。

启动器从 Node.js 官方下载站获取当前 LTS（24 或更高版本），从 Astral python-build-standalone 获取 Python 3.13 稳定构建；下载后均验证 SHA-256，再安装到用户配置目录的 `runtime/`，不改系统 Python。Windows 使用便携式 ZIP Node 和 standalone Python，原生架构为 x64 或 ARM64，后台服务不打开控制台。产品安装路径支持空格、中文和单引号。

维护者修改 Windows 入口源码后，使用 Go 和 Pillow 运行 `python3 scripts/build-windows-launcher.py`，从 `tools/windows-launcher/main.go` 重建 `Prota.exe` 并嵌入现有 Logo。图标资源生成器 `github.com/akavel/rsrc@v0.10.2` 仅用于构建，不是用户运行依赖。Windows PowerShell 中文源码使用 UTF-8 BOM，执行策略参数只作用于启动器进程，不更改注册表或公司组策略。

手动触发仓库的 Windows desktop launcher 检查，可在独立工作区验证无环境首次启动、准备进度、暖启动、端口归属和业务元数据保持不变。此测试不使用维护者业务数据或 Vercel 凭据。

主产品依赖通过锁文件校验版本及安装指纹，缺失或依赖清单变化时自动重新安装；Vercel CLI 则接受当前已安装的版本。准备与修复失败保留本机日志，用户可点击重试。首次下载需要网络，不应将工作区、凭据、运行环境或 node_modules 加入产品仓库。

Vercel 授权复用官方 CLI 设备授权流程，由本机服务在后台等待；授权 URL 只提供给本机产品界面，不返回 Token。项目创建、域名发现、配置保存由本机服务调用官方接口，所有连接接口仅允许同源本机请求。新建项目初始化只部署空白静态输出；已有项目配置过程不部署、不修改访问保护、不替换域名。

为保持既有链接，已有项目无法访问时必须报错，不得自动创建替代项目。自有域名验证完成前不得覆盖可用配置。正常业务分享继续使用独立 Build Output 目录，禁止 Git 发布业务内容。

分发的 app 入口目前未附 Apple 开发者证书签名；需要无系统安全确认的正式分发时，维护者应使用自己的 Apple Developer 身份签名和公证，不能由源码自动替用户授予系统信任。

Windows 入口也尚未附 Authenticode 发行证书。正式发行可由维护者签名以建立系统信任；源码中的自动准备流程不能替用户绕过组织设备策略。

上游说明：[Windows PowerShell 启动参数](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1)、[Astral Python 发行结构](https://github.com/astral-sh/python-build-standalone/blob/main/docs/distributions.rst)、[Windows 11 ARM 应用兼容性](https://learn.microsoft.com/en-us/windows/arm/overview)。
