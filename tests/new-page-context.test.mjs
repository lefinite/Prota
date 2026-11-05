import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const shellSource = readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server/agent-server.mjs', import.meta.url), 'utf8');

test('新建页面内部指令与用户可见消息分离', () => {
    assert.match(shellSource, /const internalInstructions = this\.getNewPageExecutionInstructions\(\);/);
    assert.match(shellSource, /message: finalMessage,\s+internalInstructions,/);
    assert.doesNotMatch(shellSource, /finalMessage = finalMessage\s*\? `\$\{newPageStylePrompt\}/);
    assert.match(serverSource, /buildActionPrompt\(session, descriptor, internalInstructions = ''\)/);
    assert.match(serverSource, /runSessionTask\(session, descriptor, \{ internalInstructions = '' \} = \{\}\)/);
    assert.match(shellSource, /stripLegacyNewPageExecutionPrompt\(descriptor\.message\)/);
});

test('全局新建页面任务保留 Portal 当前活动项目', () => {
    assert.match(shellSource, /当前活动项目 ID：\\`\$\{projectId\}\\`/);
    assert.match(shellSource, /不要从 data\/projects\.json 的 activeProjectId 重新推断项目/);
    assert.match(serverSource, /Portal 当前活动项目 ID 是 \$\{session\.context\.projectId\}/);
});

test('新建页面统一无限画布，旧页面模板仅为历史兼容保留', () => {
    assert.equal(existsSync(new URL('../src/templates/infinite-canvas/index.html', import.meta.url)), true);
    assert.equal(existsSync(new URL('../src/templates/web-frame/index.html', import.meta.url)), true);
    assert.equal(existsSync(new URL('../src/templates/mobile-frame/index.html', import.meta.url)), true);
    assert.match(shellSource, /this\.newPageTargetDevice = 'infinite-canvas'/);
    assert.match(shellSource, /new-page-mode-label/);
    assert.doesNotMatch(shellSource, /<select class="new-page-mode-select"/);
    assert.match(shellSource, /根据用户真正的设计对象，独立判断每个画板/);
    assert.match(shellSource, /targetDevice: "canvas".*pageMode: "infinite-canvas"/);
    assert.match(serverSource, /所有新增页面必须创建统一无限画布/);
});

test('视觉模板和 Web 框架可供无限画布共用且不锁定顶层设备', () => {
    assert.match(shellSource, /data-new-page-template-kind="auto"/);
    assert.match(shellSource, /data-new-page-template-kind="framework"/);
    assert.match(shellSource, /data-new-page-template-kind="style"/);
    assert.match(shellSource, /templateKind: isWeb \? 'framework' : 'style'/);
    assert.match(shellSource, /模板只作用于业务画板/);
});

test('框架模板 Skill 与普通 Skill 自动发现目录隔离', () => {
    const templateSkillIds = [
        'ant-design-skill',
        'arco-design-prototype',
        'chakra-ui-prototype',
        'element-plus-prototype',
        'mantine-prototype',
        'material-ui-prototype',
        'semi-design-prototype',
        'shadcn-prototype',
        'tdesign-web-prototype'
    ];

    for (const skillId of templateSkillIds) {
        assert.equal(
            existsSync(new URL(`../src/templates/framework-skills/${skillId}/SKILL.md`, import.meta.url)),
            true,
            `${skillId} 应存放在模板内置 Skill 目录`
        );
        assert.equal(
            existsSync(new URL(`../.claude/skills/${skillId}/SKILL.md`, import.meta.url)),
            false,
            `${skillId} 不应被普通 Skill 扫描器发现`
        );
    }

    const unsupportedSkillIds = [
        'antd-mobile-prototype',
        'ionic-react-prototype',
        'nutui-react-prototype',
        'tdesign-mobile-prototype',
        'ui-prototype-router',
        'vant-prototype'
    ];
    for (const skillId of unsupportedSkillIds) {
        assert.equal(
            existsSync(new URL(`../src/templates/framework-skills/${skillId}`, import.meta.url)),
            false,
            `${skillId} 不属于 Web 框架模板，不应收纳`
        );
        assert.equal(
            existsSync(new URL(`../.claude/skills/${skillId}`, import.meta.url)),
            false,
            `${skillId} 不应回到普通 Skill 目录`
        );
    }

    const webSkillIds = [
        'ant-design-skill',
        'shadcn-prototype',
        'mantine-prototype',
        'semi-design-prototype',
        'arco-design-prototype',
        'material-ui-prototype',
        'chakra-ui-prototype',
        'tdesign-web-prototype',
        'element-plus-prototype'
    ];
    for (const skillId of webSkillIds) {
        assert.equal(
            shellSource.includes(`skillPath: 'src/templates/framework-skills/${skillId}/SKILL.md'`),
            true,
            `Portal 应使用 ${skillId} 的模板内置路径`
        );
    }
    assert.doesNotMatch(shellSource, /skillPath: '\.claude\/skills\/(?:ant-design-skill|[^']+-prototype)\/SKILL\.md'/);
});
