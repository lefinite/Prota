/**
 * MindMap pure-function preview — renders Markdown nested lists to a
 * self-contained SVG with ZERO React and ZERO runtime dependencies.
 *
 * This reuses the headless rendering core of @xiangfa/mindmap (vendored under
 * ./vendor/esm): the markdown parser, the tree layout engine, and the SVG
 * builder. These modules are deliberately framework-free — only the React
 * *components* (MindMap / MindMapViewer) need React, and we do not use those.
 * The LaTeX plugin is excluded because it imports React; the remaining six
 * plugins are pure and cover the common syntax.
 *
 * Because there is no React, no iframe, and no CDN, every preview renders in
 * well under a millisecond after the tiny (~30 KB) pure modules load once.
 * The editor drawer (a Markdown textarea + live SVG) shares this same pipeline.
 */

import { parseMarkdownWithFrontMatter } from './vendor/esm/utils/markdown.js?v=20260701-xmind-v8';
import { layoutMultiRoot } from './vendor/esm/utils/layout.js?v=20260701-xmind-v8';
import { buildExportSVG } from './vendor/esm/utils/export.js?v=20260701-xmind-v8';
import { THEME } from './vendor/esm/utils/theme.js?v=20260701-xmind-v8';
import { frontMatterPlugin } from './vendor/esm/plugins/front-matter.js?v=20260701-xmind-v8';
import { dottedLinePlugin } from './vendor/esm/plugins/dotted-line.js?v=20260701-xmind-v8';
import { foldingPlugin } from './vendor/esm/plugins/folding.js?v=20260701-xmind-v8';
import { multiLinePlugin } from './vendor/esm/plugins/multi-line.js?v=20260701-xmind-v8';
import { tagsPlugin } from './vendor/esm/plugins/tags.js?v=20260701-xmind-v8';
import { crossLinkPlugin } from './vendor/esm/plugins/cross-link.js?v=20260701-xmind-v8';

// LaTeX is intentionally omitted: plugins/latex.js imports React, which would
// pull the whole React runtime into this otherwise framework-free pipeline.
const PLUGINS = [
    frontMatterPlugin,
    dottedLinePlugin,
    foldingPlugin,
    multiLinePlugin,
    tagsPlugin,
    crossLinkPlugin
];

const DIRECTIONS = new Set(['left', 'right', 'both']);

/**
 * Convert a Markdown nested-list string into a self-contained SVG string.
 * The returned SVG embeds its own <style> block, so it renders correctly
 * without the mindmap stylesheet — ideal for <img> preview cards.
 *
 * @param {string} markdown - Markdown nested list (mindmap source)
 * @returns {string} standalone SVG markup, or '' if the document is empty
 */
export function markdownToMindmapSvg(markdown) {
    const source = String(markdown || '').trim();
    if (!source) return '';

    const { roots, frontMatter } = parseMarkdownWithFrontMatter(source, PLUGINS);
    if (!roots || roots.length === 0) return '';

    // Default to "right" (all children on the right) to match the editor;
    // a frontmatter `direction` value can still override it per-document.
    const direction = DIRECTIONS.has(frontMatter?.direction) ? frontMatter.direction : 'right';
    // Argument shape mirrors MindMap.exportToSVG: layoutMultiRoot feeds the
    // nodes/edges that buildExportSVG serializes. The three object slots hold
    // interactive state (folded/selected/etc.) which is empty for a static render.
    const { nodes, edges } = layoutMultiRoot(roots, direction, {}, {}, PLUGINS, false, {});
    if (!nodes || nodes.length === 0) return '';

    const svg = buildExportSVG(nodes, edges, {}, THEME, PLUGINS);
    // The user does not want the thin underline beneath child-node text.
    // Strip any <line class="mindmap-node-underline"> elements and the
    // matching CSS rule from the exported SVG. (The live editor hides them
    // via editor.html CSS.)
    return svg
        .replace(/<line[^>]*mindmap-node-underline[^>]*\/?>/gi, '')
        .replace(/\.mindmap-node-underline\s*\{[^}]*\}/gi, '');
}

/**
 * Wrap an SVG string as a data URL suitable for an <img src>.
 * @param {string} svg
 * @returns {string}
 */
export function svgToDataUrl(svg) {
    const source = String(svg || '');
    if (!source) return '';
    const cleaned = source.trim().startsWith('<svg') ? source : '';
    if (!cleaned) return '';
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
}
