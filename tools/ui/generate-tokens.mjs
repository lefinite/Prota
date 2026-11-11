#!/usr/bin/env node
// Keep the product shell and the self-contained canvas runtime in sync.
// Usage: node tools/ui/generate-tokens.mjs [--check]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8');
const tokens = JSON.parse(read('design-system/product.tokens.json'));
const checking = process.argv.includes('--check');
const toKebab = value => value.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const variable = (group, name) => `--pui-${group}-${toKebab(name)}`;

const colors = tokens.color;
const legacy = {
  '--bg-main': 'var(--pui-color-workspace)',
  '--bg-sidebar': 'var(--pui-color-surface)',
  '--bg-header': 'var(--pui-color-header)',
  '--text-primary': 'var(--pui-color-text)',
  '--text-secondary': 'var(--pui-color-muted)',
  '--border': 'var(--pui-color-border)',
  '--accent': 'var(--pui-color-brand)',
  '--accent-glow': 'var(--pui-color-brand-soft)'
};

const entries = Object.entries(tokens)
  .filter(([group]) => ['color', 'space', 'radius', 'size', 'font', 'motion'].includes(group))
  .flatMap(([group, values]) => Object.entries(values).map(([name, value]) =>
    `  ${variable(group, name)}: ${value};`
  ));

const output = [
  '/* Generated from design-system/product.tokens.json. Do not edit by hand. */',
  ':root {',
  ...entries,
  '',
  '  /* Compatibility aliases used by existing Portal CSS. */',
  ...Object.entries(legacy).map(([name, value]) => `  ${name}: ${value};`),
  '}',
  ''
].join('\n');

const synchronized = [];
function sync(relativePath, desired) {
  const file = path.join(root, relativePath);
  const before = existsSync(file) ? read(relativePath) : '';
  if (before !== desired) {
    if (checking) throw new Error(`Out-of-date product tokens: ${relativePath}. Run npm run ui:tokens.`);
    writeFileSync(file, desired);
    synchronized.push(relativePath);
  }
}

function syncBlock(relativePath, lines) {
  const begin = '/* prota-ui tokens:start */';
  const end = '/* prota-ui tokens:end */';
  const source = read(relativePath);
  const start = source.indexOf(begin);
  const finish = source.indexOf(end);
  if (start < 0 || finish < start || source.indexOf(begin, start + 1) !== -1) {
    throw new Error(`Missing or duplicated token anchors in ${relativePath}`);
  }
  const desired = source.slice(0, start + begin.length) + '\n' + lines.join('\n') + '\n  ' + source.slice(finish);
  sync(relativePath, desired);
}

sync('portal/ui/tokens.css', output);
syncBlock('src/templates/infinite-canvas/styles.css', [
  `  --accent: ${colors.brand};`,
  `  --accent-ink: ${colors.primary};`,
  `  --line: ${colors.border};`,
  `  --muted: ${colors.muted};`
]);
syncBlock('portal/modules/drawio/editor-prota.css', [
  `    --primary-color: ${colors.brand};`,
  `    --primary-hover-color: ${colors.primary};`,
  `    --border-color: ${colors.border};`,
  `    --text-color: ${colors.text};`
]);
console.log(checking ? 'Product UI tokens are synchronized.' : `Product UI tokens synchronized (${synchronized.length} files).`);
