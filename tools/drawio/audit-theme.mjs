#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const THEME_PATH = path.join(ROOT, 'portal/modules/drawio/editor-prota.css');
const OUTER_PATH = path.join(ROOT, 'portal/modules/drawio/drawio.css');
const EDITOR_PATH = path.join(ROOT, 'portal/modules/drawio/editor.html');
const RUNTIME_PATH = path.join(ROOT, 'portal/modules/drawio/editor-prota.js');
const MODULE_PATH = path.join(ROOT, 'portal/modules/drawio/index.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const theme = read(THEME_PATH);
const outer = read(OUTER_PATH);
const editor = read(EDITOR_PATH);
const runtime = read(RUNTIME_PATH);
const moduleSource = read(MODULE_PATH);

const requiredContracts = [
    ['pinned draw.io runtime', editor.includes('jgraph/drawio@v30.2.5')],
    ['same-origin editor URL', moduleSource.includes('/portal/modules/drawio/editor.html?')],
    ['same-origin message target', moduleSource.includes("postMessage(JSON.stringify(message), window.location.origin)")],
    ['internal Prota theme', editor.includes('/portal/modules/drawio/editor-prota.css?v=20260630-drawio-modes-v17')],
    ['theme runtime guard', editor.includes('/portal/modules/drawio/editor-prota.js?v=20260630-drawio-modes-v17')],
    ['theme runtime loads after editor window', editor.includes("window.addEventListener('load'") && editor.indexOf('editor-prota.js') < editor.indexOf('js/bootstrap.js')],
    ['theme kept after runtime styles', runtime.includes('keepThemeLast') && runtime.includes('MutationObserver')],
    ['menu chrome normalization', runtime.includes('normalizeMenuChrome') && theme.includes('.prota-menu-check')],
    ['submenu shortcut separation', runtime.includes('prota-menu-row--submenu') && theme.includes('tr.prota-menu-row--submenu')],
    ['menu shortcut labels', runtime.includes('prota-menu-shortcut') && theme.includes('.prota-menu-shortcut')],
    ['rounded menu hover cells', /mxPopupMenuItemHover > td:first-child\s*\{[^}]*border-radius:\s*7px 0 0 7px/s.test(theme)],
    ['compact menu label grid', /mxPopupMenuIcon \+ td\.mxPopupMenuItem\s*\{[^}]*padding:\s*0 13px 0 30px/s.test(theme)],
    ['integrated draw.io controls', runtime.includes('renderIntegratedControls') && theme.includes('.prota-drawio-integrated-controls')],

    ['integrated fullscreen actions', runtime.includes("'panelFullscreen'") && runtime.includes("'browserFullscreen'")],
    ['shell diagram meta row removed', /is-drawio-mode \.annotation-drawer__meta-row\s*\{[^}]*display:\s*none/s.test(outer)],
    ['legacy shell controls removed', !outer.includes('.drawio-action-btn') && !moduleSource.includes('data-drawio-action')],
    ['shared diagrams keep toolbar access', /drawio-readonly-shield\s*\{[^}]*inset:\s*48px 0 0/s.test(outer)],
    ['self-contained editor fonts', editor.includes('family=Inter') && editor.includes('family=Outfit')],
    ['airy top-bar spacing', /\.geMinimal \.geMenubarContainer\s*\{[^}]*padding:\s*8px 18px/s.test(theme)],
    ['full-page diagram hides shell header', /is-drawio-mode \.annotation-drawer__header\s*\{[^}]*display:\s*none/s.test(outer)],
    ['embedded PRD preview mode', moduleSource.includes("preview: '1'") && runtime.includes('prota-drawio-preview')],
    ['preview chooses populated page', moduleSource.includes('normalizePreviewXml') && moduleSource.includes('mxCell[vertex="1"]')],
    ['preview supports pan interaction', moduleSource.includes('bindPreviewPan') && moduleSource.includes('--preview-pan-x')],
    ['diagram editor exit action', runtime.includes("'exitDiagram'") && moduleSource.includes("message.action === 'exitDiagram'")],
    ['left-side editor controls', runtime.includes('prota-drawio-left-controls') && theme.includes('.prota-drawio-left-controls')],
    ['compact and full editor modes', runtime.includes("'switchEditorMode'") && moduleSource.includes('switchEditorMode(mode)')],
    ['top application bar', theme.includes('/* Top application bar */')],
    ['alternative top bars', theme.includes('/* Full/classic and alternative top bars */')],
    ['menus and dropdowns', theme.includes('/* Popup menus, context menus and dropdowns */')],
    ['shape library', theme.includes('/* Shape library */')],
    ['format inspector', theme.includes('/* Format inspector */')],
    ['floating windows', theme.includes('/* Floating windows */')],
    ['compact shared panel titles', /td\.mxWindowTitle\s*\{[^}]*height:\s*36px/s.test(theme)],
    ['centered panel title controls', theme.includes('.mxWindowTitle > div') && theme.includes('align-items: center')],
    ['restyled format controls', theme.includes('[title="网格大小"]') && theme.includes('.geFormatSection .geColorBtn > div')],
    ['conditional dialog scrolling', runtime.includes('normalizeDialogs') && theme.includes('.geDialog.prota-dialog-scrollable')],

    ['icon-only native save', runtime.includes('prota-drawio-save-button') && theme.includes('.prota-drawio-save-button svg')],
    ['draw.io drawer resizing', /is-drawio-mode \.prd-drawer-resize-handle\s*\{[^}]*display:\s*block/s.test(outer)],
    ['bottom attribution removed', theme.includes('.geTabContainer > a')],
    ['shape observer loop guarded', runtime.includes("button.textContent.trim() !== '更多图形'")],
    ['unified page tab menu hover', theme.includes('.gePageTab:hover + .gePageMenu')],
    ['native page arrow unified hover', theme.includes('.geTabScroller .gePageTab + .geButton')],
    ['modal dialogs', theme.includes('/* Modal dialogs */')],
    ['templates and pickers', theme.includes('/* Templates, libraries and advanced pickers */')],
    ['comments and notifications', theme.includes('/* Comments, notifications and alerts */')],
    ['runtime status surfaces', theme.includes('.geSpinnerStatus') && theme.includes('.geStatusDiv')],
    ['validation states', theme.includes('.gePropEditor input:invalid')],
    ['tooltips', theme.includes('/* Tooltips */')],
    ['page navigation', theme.includes('/* Bottom page navigation */')],
    ['vertical toolbar and ruler', theme.includes('/* Vertical toolbar and ruler */')],
    ['selection and drag chrome', theme.includes('/* Selection and drag chrome */')],
    ['compact widths', theme.includes('/* Compact editor widths */')],
    ['forced-colour accessibility', theme.includes('@media (forced-colors: active)')],
    ['reduced motion', theme.includes('@media (prefers-reduced-motion: reduce)')]
];

const prohibitedContracts = [
    ['unscoped graph container styling', /(^|})\s*\.geDiagramContainer\s*[{,]/m],
    ['canvas page styling', /\.geBackgroundPage\s*[{,]/],
    ['graph cell styling', /\.mxCell\b/],
    ['SVG graph styling', /\.mxGraph\b/]
];

const failures = [];

for (const [name, passed] of requiredContracts) {
    if (!passed) failures.push(`Missing contract: ${name}`);
}

for (const [name, pattern] of prohibitedContracts) {
    if (pattern.test(theme)) failures.push(`Theme crosses rendering boundary: ${name}`);
}

const braceBalance = (source) => {
    let depth = 0;
    let quote = '';
    let inComment = false;

    for (let i = 0; i < source.length; i += 1) {
        const pair = source.slice(i, i + 2);
        const char = source[i];

        if (inComment) {
            if (pair === '*/') {
                inComment = false;
                i += 1;
            }
            continue;
        }
        if (quote) {
            if (char === '\\') i += 1;
            else if (char === quote) quote = '';
            continue;
        }
        if (pair === '/*') {
            inComment = true;
            i += 1;
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth < 0) return false;
        }
    }

    return depth === 0 && !quote && !inComment;
};

if (!braceBalance(theme)) failures.push('Invalid editor-prota.css brace/comment structure');
if (!braceBalance(outer)) failures.push('Invalid drawio.css brace/comment structure');

if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
}

console.log(`Draw.io theme audit passed (${requiredContracts.length} UI contracts, ${prohibitedContracts.length} rendering boundaries).`);
