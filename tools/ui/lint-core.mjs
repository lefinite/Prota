// Incremental product-UI guard. Old debt remains visible in the audit rather
// than blocking unrelated PRs; newly introduced violations fail the build.
const productCss = path => /^portal\/.*\.css$/.test(path) || path === 'src/templates/infinite-canvas/styles.css';
const productHtml = path => /^portal\/.*\.html$/.test(path);
const generatedCss = new Set(['portal/ui/tokens.css']);
const generatedAliases = {
  'src/templates/infinite-canvas/styles.css': /\s*--(?:accent|accent-ink|line|muted):/,
  'portal/modules/drawio/editor-prota.css': /\s*--(?:primary-color|primary-hover-color|border-color|text-color):/
};

export function inspectLine(file, line, number) {
  if (!productCss(file) && !productHtml(file)) return [];
  if (generatedCss.has(file)) return [];
  if (generatedAliases[file]?.test(line)) return [];
  const errors = [];
  const report = (rule, message) => errors.push({ file, line: number, rule, message });

  if (productCss(file)) {
    if (/!important\b/.test(line)) report('no-important', '新增 !important；请解决样式优先级问题');
    if (/:[^;]*#[0-9a-f]{3,8}\b/i.test(line)) report('semantic-colors', '新增硬编码颜色；改用 --pui-color-* Token');
    if (/rgba?\(\s*99\s*,\s*102\s*,\s*241\s*[,)]/.test(line)) report('semantic-colors', '新增品牌色 RGB 字面量；改用 Token');
    const match = line.match(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|rem)\b/);
    if (match && Number(match[1]) * (match[2] === 'rem' ? 16 : 1) < 11) {
      report('readable-font', '新增字号小于 11px；请核对用途与可读性');
    }
  }
  if (productHtml(file) && /\sstyle\s*=/.test(line)) {
    report('no-inline-style', '产品 HTML 新增行内 style；请使用有作用域的 CSS 类');
  }
  return errors;
}

export function lintPatch(patch) {
  let file = '';
  let nextLine = 0;
  const issues = [];
  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) { file = line.slice(6); continue; }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { nextLine = Number(hunk[1]); continue; }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      issues.push(...inspectLine(file, line.slice(1), nextLine));
      nextLine += 1;
    } else if (line.startsWith(' ')) {
      nextLine += 1;
    }
  }
  return issues;
}
