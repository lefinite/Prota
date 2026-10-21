import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shellSource = readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');

test('新建模型配置不依赖 selectedProviderId 判断保存分支', () => {
    const start = shellSource.indexOf('async saveActiveProvider()');
    const end = shellSource.indexOf('deleteProvider(', start);
    const saveSource = shellSource.slice(start, end);

    assert.match(saveSource, /const creatingProvider = Boolean\(this\.newProviderDraft\)/);
    assert.doesNotMatch(saveSource, /selectedProviderId === null && Boolean\(this\.newProviderDraft\)/);
});

test('后台状态同步不会把新建表单切回编辑模式', () => {
    const start = shellSource.indexOf('syncAgentProviderStoreState()');
    const end = shellSource.indexOf('migrateLegacyProviderConfig()', start);
    const syncSource = shellSource.slice(start, end);

    assert.match(syncSource, /this\.newProviderDraft\s*\?\s*null/);
});
