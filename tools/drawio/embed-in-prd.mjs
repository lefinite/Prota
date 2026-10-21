#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const readArgs = (argv) => {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i];
        if (!key.startsWith('--')) continue;
        args[key.slice(2)] = argv[i + 1] || '';
        i += 1;
    }
    return args;
};

const fail = (message) => {
    console.error(`[drawio-embed] ${message}`);
    process.exit(1);
};

const args = readArgs(process.argv.slice(2));
const projectId = String(args.project || '').trim();
const pageId = String(args.page || '').trim();
const version = String(args.version || '').trim();
const diagramArg = String(args.diagram || '').trim();
const title = String(args.title || '流程图').trim() || '流程图';
const dryRun = args['dry-run'] === '1' || args['dry-run'] === 'true';

if (!projectId || !pageId || !/^v\d+$/.test(version) || !diagramArg) {
    fail('Required: --project <id> --page <id> --version <vN> --diagram <path>');
}

const pageRoot = path.join(ROOT, 'src', 'pages', projectId, pageId);
const docsRoot = path.join(pageRoot, 'docs');
if (!fs.existsSync(path.join(pageRoot, version, 'index.html'))) {
    fail(`Version not found: ${projectId}/${pageId}/${version}`);
}

const normalizeProjectFile = (input) => {
    const absolute = path.isAbsolute(input) && input.startsWith(ROOT)
        ? path.resolve(input)
        : path.resolve(ROOT, input.replace(/^\/+/, ''));
    if (!absolute.startsWith(`${ROOT}${path.sep}`)) fail('Path escapes repository root');
    return absolute;
};

const diagramPath = normalizeProjectFile(diagramArg);
if (!diagramPath.startsWith(`${path.join(docsRoot, 'diagrams')}${path.sep}`) || !diagramPath.endsWith('.drawio')) {
    fail('Diagram must be inside the active page docs/diagrams directory');
}
if (!fs.existsSync(diagramPath)) fail(`Diagram not found: ${diagramArg}`);

let prdPath = '';
const contextPath = path.join(ROOT, 'data', 'active-prd-context.json');
if (fs.existsSync(contextPath)) {
    try {
        const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
        if (
            context.projectId === projectId
            && context.pageId === pageId
            && context.version === version
            && context.path
        ) {
            const candidate = normalizeProjectFile(context.path);
            if (candidate.startsWith(`${docsRoot}${path.sep}`) && candidate.endsWith('.md') && fs.existsSync(candidate)) {
                prdPath = candidate;
            }
        }
    } catch {
        // Fall through to the deterministic document fallback.
    }
}

if (!prdPath) {
    const preferred = path.join(docsRoot, 'product-doc.md');
    if (fs.existsSync(preferred)) {
        prdPath = preferred;
    } else if (fs.existsSync(docsRoot)) {
        const documents = fs.readdirSync(docsRoot)
            .filter((name) => name.toLowerCase().endsWith('.md'))
            .map((name) => {
                const file = path.join(docsRoot, name);
                return { file, mtime: fs.statSync(file).mtimeMs };
            })
            .sort((left, right) => right.mtime - left.mtime);
        prdPath = documents[0]?.file || '';
    }
}

if (!prdPath) fail('No PRD document is available for this page');

const publicDiagramPath = `/${path.relative(ROOT, diagramPath).split(path.sep).join('/')}`;
const safeTitle = title.replace(/"/g, '\\"');
const directive = `:::drawio path="${publicDiagramPath}" title="${safeTitle}"`;
const content = fs.readFileSync(prdPath, 'utf8');

const alreadyEmbedded = content.includes(`path="${publicDiagramPath}"`);
if (!alreadyEmbedded && !dryRun) {
    const next = `${content.replace(/\s*$/, '')}\n\n${directive}\n`;
    fs.writeFileSync(prdPath, next, 'utf8');
}

console.log(JSON.stringify({
    status: 'success',
    prdPath: `/${path.relative(ROOT, prdPath).split(path.sep).join('/')}`,
    diagramPath: publicDiagramPath,
    directive,
    alreadyEmbedded,
    dryRun
}, null, 2));
