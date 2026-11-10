import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { inspectLine, lintPatch } from '../tools/ui/lint-core.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = relativePath => readFileSync(path.join(root, relativePath), 'utf8');
const tokens = JSON.parse(file('design-system/product.tokens.json'));

function luminance(hex) {
  const rgb = hex.match(/[a-f0-9]{2}/gi)?.map(channel => parseInt(channel, 16) / 255);
  assert.equal(rgb?.length, 3, `RGB hex required: ${hex}`);
  const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}
function contrast(a, b) {
  const levels = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (levels[0] + .05) / (levels[1] + .05);
}

test('Product foregrounds meet WCAG AA normal-text contrast', () => {
  for (const name of ['text', 'muted', 'primary', 'primaryHover', 'danger', 'success', 'warning']) {
    assert.ok(contrast(tokens.color[name], tokens.color.surface) >= 4.5, `${name} must reach 4.5:1 on white`);
  }
  // The current brand accent (#6366f1) is reserved for accents and outlines.
  // Filled buttons must use the WCAG-safe primary token, even if brand changes.
});

test('Generated tokens are current and preserve standalone canvas runtime', () => {
  execFileSync(process.execPath, ['tools/ui/generate-tokens.mjs', '--check'], { cwd: root, stdio: 'pipe' });
  assert.match(file('src/templates/infinite-canvas/index.html'), /href="\.\/styles\.css"/);
  assert.doesNotMatch(file('src/templates/infinite-canvas/index.html'), /portal\/ui\/tokens/);
});

test('Portal loads product tokens and primitives before legacy CSS', () => {
  const html = file('portal/index.html');
  const tokensIndex = html.indexOf('ui/tokens.css');
  const componentsIndex = html.indexOf('ui/components.css');
  const shellIndex = html.indexOf('shell.css');
  assert.ok(tokensIndex >= 0 && tokensIndex < componentsIndex && componentsIndex < shellIndex);
});

test('Agent governance points to the live contract and excludes business demos', () => {
  const agents = file('AGENTS.md');
  assert.match(agents, /docs\/prota-ui-guidelines\.md/);
  assert.match(agents, /Review → 修复 → 复检/);
  assert.match(agents, /不强制套用于用户生成的业务 Demo/);
});

test('Public release includes the canonical tokens, UI assets and guidance', () => {
  const exporter = file('tools/public-release.py');
  assert.match(exporter, /'design-system'/);
  assert.match(exporter, /'docs\/prota-ui-guidelines\.md'/);
  assert.match(exporter, /'docs\/prota-ui-audit-2026-11-10\.md'/);
  assert.match(exporter, /'tests\/product-ui-contract\.test\.mjs'/);
  assert.match(exporter, /'tests\/product-ui-smoke\.browser\.mjs'/);
  assert.match(exporter, /'portal'/);
});

test('The incremental UI linter rejects new debt and ignores old context lines', () => {
  const sample = `diff --git a/portal/new.css b/portal/new.css\n+++ b/portal/new.css\n@@ -4,2 +4,4 @@\n .old { color: #fff; }\n+ .new { color: #ff00ff !important; }\n+ .small { font-size: 10px; }\n+ .safe { color: var(--pui-color-primary); }\n`;
  const issues = lintPatch(sample);
  assert.equal(issues.length, 3);
  assert.deepEqual(new Set(issues.map(item => item.rule)), new Set(['semantic-colors', 'no-important', 'readable-font']));
  assert.equal(inspectLine('src/pages/project/board/v1/styles.css', 'color:#ffffff;', 1).length, 0);
  assert.equal(inspectLine('portal/index.html', '<div style="color:red">', 2)[0]?.rule, 'no-inline-style');
});
