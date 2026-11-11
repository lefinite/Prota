# 已有埋点页面与命名索引

生成前先查本索引，再按页面 code 在 [existing-tracking-catalog.json](existing-tracking-catalog.json) 中读取对应事件、区块、元素、操作和参数定义。不需要整份 Excel，也不必整份 JSON 都加载。

## 公司现有记录

来源：公司埋点合并结果.xlsx。下表保留原来的大小写和中文名称；来源工作表是匹配线索，不是强制平台分类。

| 来源工作表 | 页面 code | 页面中文名 | 已有 key 数 |
|---|---|---|---|
| Web端 | `webHome` | web首页 | 23 |
| Web端 | `webReader` | web阅读器 | 46 |
| Web端 | `webNotes` | Web笔记页 | 6 |
| Web端 | `webFindBooks` | web搜书页 | 8 |
| Web端 | `webMyVoice` | web我的音色 | 7 |
| Web端 | `webDownloadPage` | web下载页 | 4 |
| Web端 | `webAccountSetting` | web账号设置 | 4 |
| Web端 | `webBookDetail` | web书籍详情页 | 2 |
| Web端 | `newHome` | 新首页 | 9 |
| Web端 | `searchInBook` | 书内搜索 | 8 |
| Web端 | `reader` | 阅读器 | 5 |
| App端 | `reader` | 阅读器 | 45 |
| App端 | `voice` | 音色选择 | 6 |
| App端 | `askAI` | AI问答页 | 3 |
| App端 | `bookContents` | 书籍目录页 | 3 |
| App端 | `readifyProfile` | Readify个人中心 | 10 |
| App端 | `readingNotesList` | 阅读笔记列表页 | 2 |
| App端 | `findBook` | 搜索书籍页 | 3 |
| App端 | `bookSearchResult` | 书籍搜索结果页 | 2 |
| App端 | `bookDetail` | 书籍详情页 | 2 |
| App端 | `findBooksPage` | 书籍搜索页 | 6 |
| App端 | `loginPage` | 登录页 | 2 |
| App端 | `accountSetting` | 账号设置 | 5 |
| App端 | `readifyHome` | 首页 | 19 |
| 插件端 | `webHome` | web首页 | 1 |
| 插件端 | `webReader` | web阅读器 | 1 |
| 插件端 | `extBar` | 插件条 | 2 |

## 当前手机号登录原型

来源：auth-phone / v1，2026-11-10 修正后的方案。内部事件 ID、页面 code、区块、元素、参数保存在 JSON 的 prototypeSnapshots 中；未登记事件不具有公司数字编号。

| 内部 screenId | 当前页面 code | 页面中文名 |
|---|---|---|
| `entry` | `loginPage` | 登录页 |
| `sms_login` | `phoneLoginPage` | 短信验证码登录页 |
| `phone_pwd_login` | `phonePasswordLoginPage` | 手机号密码登录页 |
| `pwd_login` | `emailPasswordLoginPage` | 邮箱密码登录页 |
| `register` | `registerPage` | 注册设密页 |
| `verify_code` | `verifyCodePage` | 验证码校验页 |
| `recover` | `recoverPasswordPage` | 找回密码页 |
| `set_pwd` | `setPasswordPage` | 设置新密码页 |
| `change_pwd` | `changePasswordPage` | 修改密码页 |
| `account` | `accountPage` | 账户管理页 |
| `identity_check` | `identityCheckPage` | 身份验证页 |
| `bind` | `bindAccountPage` | 绑定登录方式页 |
| `bind_pwd` | `bindEmailPasswordPage` | 绑定邮箱设密页 |
| `delete_done` | `deleteAccountDonePage` | 注销完成页 |
| `bookshelf` | `bookshelf` | 书架 |

## 如何选用

1. 用户本次明确指定的命名优先。否则先匹配公司已有页面：结合业务用途、页面内容、进入路径和原有事件，不仅比较页面标题。已有页面即使改版、换目录或新增一个画板，也沿用原 page code 和中文页面名。
2. 同一页面新增事件，复用该页面 code；已有区块和元素含义相同就沿用原 code/中文名及已分配数字编号。只是参数值不同，优先使用参数区分。
3. 公司表中没有记录时，沿用当前页面版本的有效方案；当前也没有时，再查原型快照。不要用原型中的提议覆盖公司已登记命名。
4. 同名不同业务、跨端含义不同或多个候选无法判断时，不自动合并、不自动重命名；标出候选并只询问有歧义的页面。其余页面继续处理。
5. 确认是全新业务页面，才创建新的 page code。仅因旧名字不够漂亮、缺少 Page 后缀或 web/ext 前缀，不得另起名字。
6. 来源存在差异时保留差异。例如公司表已有 `accountSetting`，原型快照使用 `accountPage`；后续设计应先判断是否是同一个账户设置页面，同一页面优先公司既有名。不得仅凭相似标题悄悄改写已保存方案。
7. 本目录保存命名/配置参考，不是所有页面都要复制的埋点清单。仍要重新评估埋点价值和控件是否存在；历史敏感字段不自动沿用。新生成的业务方案写入当前工作区版本，不自动回写本目录；用户确认新增/更名后再增量更新参考，保留来源和冲突记录。
