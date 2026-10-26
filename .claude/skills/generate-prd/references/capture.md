# 截取功能状态

生成图文 PRD 时默认逐功能截图；完整截图与质量要求以 SKILL.md 为准。本文件提供命令速查，命令在项目根目录运行。

```bash
npm --prefix .claude/skills/generate-prd run capture -- --page-dir src/pages/{project_id}/{page_id}/{version} --out src/pages/{project_id}/{page_id}/docs/prd-assets/{需求名称} --feature "{目标功能或精确文本}" --actions "click:更多;click:背景乐" --shot-name "{version}-background-music"
```

`--actions` 按真实路径替换；目标已可见时省略。`--feature` 可替换为 `--annotation {序号}` 或 `--selector "{CSS选择器}"`。参数中的路径含空格时加引号。

- 列出目标：`node tools/capture/prd-evidence.mjs --page-dir {版本目录} --list-targets`。
- 动作支持 `click:文本`、`click-selector:选择器`、`fill:选择器|内容`、`press:键名`、`scroll:选择器`、`wait:毫秒`，多个动作以分号分隔。
- 确实需要入口及详情时加 `--capture-entry-detail`；需要动作链各状态时加 `--capture-steps`，不默认把所有中间状态放进文档。
- 截图工具按页面元数据自动选择：手机端默认使用 `iphone-17` 并裁剪 `.phone-screen`；Web 与自由画布默认使用桌面视口且不裁剪手机内屏，可传入 `--viewport 1440x900 --capture-selector none` 覆盖。默认保留触发后的自然位置，长页确有需要时才加 `--full-page`。
- 查看生成的图片及同名 JSON 元数据，核对 `target`、`finalState.visible`、`discovery.path`；多图核对 `images[].screenState`、`images[].finalState` 和 `explicitActions`。元数据命中不代表图一定正确。
- 失败时修正目标或动作；仍失败则在交付说明中说明缺失，不用概览图、标注红框图或其他功能图代替。

使用相对链接插入对应规则附近：`![背景乐设置](prd-assets/{需求名称}/{version}-background-music.png)`。有空格等特殊字符时对链接路径编码。新需求和新版本使用独立资产名，避免覆盖其他文档引用的图片。
