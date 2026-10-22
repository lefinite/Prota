# 开发安装与维护

普通 macOS 用户直接双击 `Prota.app`，不需要以下命令。图形启动流程见[启动与云分享](share-setup-guide.md)。

开发环境需要 Node.js 22.9+、Python 3.9+。开发者可以执行 `npm ci` 后运行 `bash scripts/run.sh`。后者保留前台日志，属于开发入口。

`npm ci` 或 `npm install` 的 postinstall 会在独立的 `node_modules/.prota-vercel/` 中安装 `vercel@latest`。此工具依赖与产品锁文件分开，安装时显式查询 latest，正常启动及分享不会升级。

开发者可以运行 `npm run vercel -- --version`、`npm run vercel -- login` 和 `npm run vercel:update`。使用 `--ignore-scripts` 安装时需要另外运行更新命令。终端操作不是普通用户的安装或连接流程。

macOS 启动器先使用可用环境，缺失时从 Node.js 官方下载站和 Astral python-build-standalone 上游下载，校验 SHA-256 后安装到用户配置目录的 `runtime/`，不改系统 Python。图形窗口由 macOS 自带的 JavaScript for Automation 提供，在 Node/Python 均缺失时也能显示准备状态。

主产品依赖通过锁文件校验版本及安装指纹，缺失或依赖清单变化时自动重新安装；Vercel CLI 则接受当前已安装的版本。准备与修复失败保留本机日志，用户可点击重试。首次下载需要网络，不应将工作区、凭据、运行环境或 node_modules 加入产品仓库。

Vercel 授权复用官方 CLI 设备授权流程，由本机服务在后台等待；授权 URL 只提供给本机产品界面，不返回 Token。项目创建、域名发现、配置保存由本机服务调用官方接口，所有连接接口仅允许同源本机请求。新建项目初始化只部署空白静态输出；已有项目配置过程不部署、不修改访问保护、不替换域名。

为保持既有链接，已有项目无法访问时必须报错，不得自动创建替代项目。自有域名验证完成前不得覆盖可用配置。正常业务分享继续使用独立 Build Output 目录，禁止 Git 发布业务内容。

分发的 app 入口目前未附 Apple 开发者证书签名；需要无系统安全确认的正式分发时，维护者应使用自己的 Apple Developer 身份签名和公证，不能由源码自动替用户授予系统信任。
