/**
 * Build-time entry for the mindmap editor bundle.
 *
 * esbuild bundles React + ReactDOM + @xiangfa/mindmap (and scheduler) into a
 * single self-contained ESM file at vendor/mindmap-react.bundle.mjs. This is a
 * BUILD-TIME step only (see scripts below); the project itself stays build-free
 * and loads the resulting bundle directly in the browser.
 *
 *   ./node_modules/.bin/esbuild portal/modules/mindmap/bundle-entry.js \
 *       --bundle --format=esm --minify \
 *       --outfile=portal/modules/mindmap/vendor/mindmap-react.bundle.mjs
 *
 * The bundle isolates the entire React runtime so the parent portal never
 * imports React. Only the editor iframe uses it; previews stay on the
 * framework-free pure-function pipeline (preview.js).
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
// Import from the vendored local copy (./vendor/esm) rather than
// @xiangfa/mindmap so the Prota patches (e.g. MindMap ref.startEdit) live in
// the repo and survive npm install. esbuild still resolves React/ReactDOM/
// scheduler from node_modules.
import {
    MindMap,
    MindMapViewer,
    MindMapTextEditor,
    allPlugins,
    toMarkdownMultiRoot
} from './vendor/esm/index.js';

export {
    React,
    createRoot,
    MindMap,
    MindMapViewer,
    MindMapTextEditor,
    allPlugins,
    toMarkdownMultiRoot
};
