import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

// Exercise the shipped shell methods without starting the Portal or contacting an AI model.
// The browser E2E additionally verifies the DOM, focus and network pipeline when Chromium is available.
const source = readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');
const preambleStart = source.indexOf('const WEB_FRAMEWORK_PREVIEW_BASE');
const classStart = source.indexOf('class DemoShell {');
const classEnd = source.indexOf('\n}', classStart) + 2;
assert.ok(preambleStart >= 0 && classStart > preambleStart && classEnd > classStart);

const storage = new Map();
const localStorage = {
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
};
const DemoShell = runInNewContext(
    `${source.slice(preambleStart, classStart)}\n${source.slice(classStart, classEnd)}\nDemoShell`,
    { window: { localStorage }, workspaceStorageKey: key => key }
);

function shellFixture() {
    const shell = Object.create(DemoShell.prototype);
    shell.templatesData = {
        templates: [
            { id: 'midnight-terminal', name: '暗夜终端', enabled: true, filePath: 'src/templates/design-systems/midnight-terminal/DESIGN.md', preview: { background: '#121212' } },
            { id: 'disabled-style', name: '禁用风格', enabled: false, filePath: 'unused' },
            { id: 'disabled-list', name: '已停用', enabled: true, filePath: 'unused' }
        ],
        disabled: ['disabled-list']
    };
    shell.projects = { projects: [{ id: 'demo', name: '测试项目', pages: [] }], activeProjectId: 'demo' };
    shell.activeProjectId = 'demo';
    shell.newPageTargetDevice = 'infinite-canvas';
    shell.newPageTemplateKind = 'auto';
    shell.newPageStyleId = 'default';
    shell.newPageFrameworkId = 'ant-design-skill';
    shell.agentActiveSkill = { id: 'create-new-page' };
    shell.agentRunState = { active: false };
    shell.syncNewPagePrompt = () => {};
    shell.closeNewPageStyleMenu = () => {};
    shell.renderAgentStatusContextControl = () => {};
    shell.showToast = () => {};
    return shell;
}

test('unified template picker has one intelligent default and both enabled template families', () => {
    const shell = shellFixture();
    const options = shell.getNewPagePickerOptions();
    assert.equal(options[0].kind, 'auto');
    assert.ok(options.some(item => item.kind === 'style' && item.id === 'midnight-terminal'));
    assert.ok(options.some(item => item.kind === 'framework' && item.id === 'shadcn-prototype'));
    assert.ok(!options.some(item => item.id === 'disabled-style' || item.id === 'disabled-list'));
    const markup = shell.renderNewPageStyleMenuItems();
    assert.match(markup, /data-new-page-template-kind="auto"/);
    assert.match(markup, /data-new-page-template-kind="style"/);
    assert.match(markup, /data-new-page-template-kind="framework"/);
    assert.match(markup, /视觉风格.*Web 框架/s);
});

test('template selection changes only the business board instructions, not the page type', () => {
    const shell = shellFixture();
    const initial = shell.getNewPageExecutionInstructions();
    assert.match(initial, /targetDevice: "canvas".*pageMode: "infinite-canvas"/);
    assert.match(initial, /手机 H5.*桌面 Web.*自定义尺寸/);
    assert.match(initial, /src\/templates\/infinite-canvas-document\//);
    assert.match(initial, /共享 Runtime/);
    assert.doesNotMatch(initial, /完整复制产品模板 src\/templates\/infinite-canvas\//);
    assert.doesNotMatch(initial, /design-systems\/|framework-skills\//);

    shell.setNewPageStyle('midnight-terminal', { syncPrompt: false });
    const style = shell.getNewPageExecutionInstructions();
    assert.equal(shell.newPageTargetDevice, 'infinite-canvas');
    assert.match(style, /design-systems\/midnight-terminal\/DESIGN.md/);
    assert.doesNotMatch(style, /framework-skills\//);

    shell.setNewPageFramework('shadcn-prototype', { syncPrompt: false });
    const framework = shell.getNewPageExecutionInstructions();
    assert.match(framework, /framework-skills\/shadcn-prototype\/SKILL.md/);
    assert.doesNotMatch(framework, /design-systems\/midnight-terminal/);

    shell.setNewPageTemplateAuto({ syncPrompt: false });
    assert.equal(shell.newPageTemplateKind, 'auto');
    assert.equal(shell.getNewPageExecutionInstructions(), initial);
    shell.setNewPageTargetDevice('mobile', { syncPrompt: false });
    assert.equal(shell.newPageTargetDevice, 'infinite-canvas', 'legacy entry cannot re-enable mobile pages');
});

test('rendered new-page controls expose a single canvas label, template and blank action', () => {
    const shell = shellFixture();
    const optionsHost = { dataset: {}, innerHTML: '', querySelector: () => null };
    const context = {
        hidden: true,
        classList: { add() {}, remove() {} },
        title: '',
        html: '',
        set innerHTML(value) { this.html = value; },
        get innerHTML() { return this.html; },
        querySelector: selector => selector === '[data-new-page-presentation-options]' && context.html ? optionsHost : null
    };
    shell.agentStatusContext = context;
    shell.renderNewPageStyleMenuPortal = () => {};
    shell.renderAgentStatusContextControl = DemoShell.prototype.renderAgentStatusContextControl;
    shell.renderAgentStatusContextControl();
    assert.match(context.html, /new-page-mode-label[^>]*>无限画布/);
    assert.doesNotMatch(context.html, /<select|data-new-page-mode=/);
    assert.match(optionsHost.innerHTML, /模板：智能选择/);
    assert.match(optionsHost.innerHTML, /data-new-page-blank-canvas/);
    shell.setNewPageStyle('midnight-terminal', { syncPrompt: false });
    assert.match(optionsHost.innerHTML, /模板：暗夜终端/);
});

test('template catalog routes both a style and a web framework into canvas creation', async () => {
    const shell = shellFixture();
    shell.selectProjectForTemplate = async () => 'demo';
    shell.currentTopView = 'page';
    const calls = [];
    shell.openNewPageAgentFlow = async args => { calls.push(args); };
    await shell.applyCatalogTemplateForNewPage({ id: 'midnight-terminal', name: '暗夜终端', enabled: true, targetDevice: 'mobile' });
    await shell.applyCatalogTemplateForNewPage({ id: 'shadcn-prototype', name: 'shadcn/ui', enabled: true, targetDevice: 'web' });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].templateKind, 'style');
    assert.equal(calls[1].templateKind, 'framework');
    assert.equal(calls[1].frameworkId, 'shadcn-prototype');
    assert.ok(calls.every(call => !Object.hasOwn(call, 'targetDevice')));
});
