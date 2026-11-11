#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lintPatch } from './lint-core.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
const baseFlag = process.argv.indexOf('--base');
let patch;

if (baseFlag >= 0) {
  const base = process.argv[baseFlag + 1];
  if (!base || base.startsWith('--')) throw new Error('Use --base <commit/ref>');
  // A PR compares the base with the committed head. This intentionally does
  // not inspect untracked files in CI: they cannot enter a committed PR.
  patch = git('diff', '--no-ext-diff', '--unified=0', `${base}...HEAD`, '--', 'portal', 'src/templates/infinite-canvas');
} else {
  patch = git('diff', '--no-ext-diff', '--unified=0', 'HEAD', '--', 'portal', 'src/templates/infinite-canvas');
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'portal', 'src/templates/infinite-canvas')
    .trim().split('\n').filter(Boolean);
  for (const filename of untracked) {
    const contents = readFileSync(path.join(repo, filename), 'utf8');
    const lines = contents.split('\n');
    patch += `\ndiff --git a/${filename} b/${filename}\n+++ b/${filename}\n@@ -0,0 +1,${lines.length} @@\n`;
    patch += lines.map(line => `+${line}`).join('\n') + '\n';
  }
}

const issues = lintPatch(patch);
if (issues.length) {
  console.error(`New Prota UI violations: ${issues.length}`);
  for (const issue of issues) console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`);
  process.exitCode = 1;
} else {
  console.log('No new product UI token/style violations in the changed lines.');
}
