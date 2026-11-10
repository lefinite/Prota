## 变更内容

- 影响范围与主要行为：
- 验证命令与结果：
- 兼容性、回滚与未验证项目：

## Prota 产品 UI Review（不涉及产品 UI 可标 N/A）

参考：`docs/prota-ui-guidelines.md` 和 `design-system/README.md`。

- [ ] 已复用产品 Token、现有组件与交互模式，或说明新增例外
- [ ] 已核对默认、Hover、Focus、Disabled、Loading、Error、Empty 等适用状态
- [ ] 已检查 1440、1024、860 宽度及适用窄屏，无关键操作裁切
- [ ] 已检查键盘/Esc、焦点恢复、中文长文案、未保存内容保护
- [ ] 已附前后截图/录屏，或解释为什么不涉及可见 UI
- [ ] 已运行 `npm run ui:tokens:check`、`npm run ui:test`、`npm run ui:lint -- --base <base-ref>`；有视觉变更时运行 `npm run ui:browser`
- [ ] P0/P1 问题已修复；P2/例外与风险已列明
- [ ] 若涉及画布，已确认产品外壳与业务画板隔离、版本/分享行为不退化

### UI 问题记录

| 级别 | 区域 / 代码或截图证据 | 不一致点 | 修复与验证 |
| --- | --- | --- | --- |
| N/A | | | |
