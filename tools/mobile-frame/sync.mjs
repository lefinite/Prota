import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getWorkspaceRoot, applicationRoot} from '../../server/workspace.mjs';
const root = getWorkspaceRoot();
const source = readFileSync(resolve(applicationRoot, 'tools/mobile-frame/frame-fit.js'), 'utf8');
const data = JSON.parse(readFileSync(resolve(root, 'data/projects.json'), 'utf8'));
const dirs = [resolve(applicationRoot, 'src/templates/mobile-frame')];
for (const project of data.projects) {
  for (const page of project.pages || []) {
    if (['web', 'canvas'].includes(String(page.targetDevice || '').trim().toLowerCase())) continue;
    for (const version of page.versions || []) {
      const dir = resolve(root, 'src/pages', project.id, page.id, version);
      const index = resolve(dir, 'index.html');
      if (existsSync(index) && readFileSync(index, 'utf8').includes('phone-shell')) dirs.push(dir);
    }
  }
}
for (const dir of dirs) {
  // file:// allows loading local CSS but blocks cssRules access. Keep the
  // version's original geometry in its own script for offline fitting.
  const css = readFileSync(resolve(dir, 'styles.css'), 'utf8');
  function frameProperties(selector, properties) {
    const block = css.match(new RegExp('\\.' + selector + '\\s*\\{([^}]+)'))?.[1] || '';
    return Object.fromEntries(properties.flatMap(property => {
      const value = block.match(new RegExp('(?:^|;)\\s*' + property + '\\s*:\\s*([^;]+)'))?.[1]?.trim();
      return value ? [[property, value]] : [];
    }));
  }
  const fallback = {
    phone: frameProperties('phone-shell', ['width', 'height', 'padding', 'border-radius', 'box-shadow', 'background']),
    screen: frameProperties('phone-screen', ['border-radius'])
  };
  writeFileSync(resolve(dir, 'frame-fit.js'), `${source}\ninstallProtaMobileFrameFit(window, ${JSON.stringify(fallback)});\n`);
  const index = resolve(dir, 'index.html');
  const html = readFileSync(index, 'utf8');
  if (!html.includes('src="./frame-fit.js"')) {
    writeFileSync(index, html.replace('</body>', '  <script src="./frame-fit.js"></script>\n</body>'));
  }
}
const shell = resolve(root, 'portal/shell.js');
const shellSource = readFileSync(shell, 'utf8');
const marker = '/* Self-contained mobile preview fitting.';
const start = shellSource.lastIndexOf(marker);
if (start < 0) throw new Error('Portal frame fitting implementation missing');
writeFileSync(shell, shellSource.slice(0, start) + source);
console.log(`Synced ${dirs.length} self-contained mobile frame scripts.`);
