# MindMap module

Interactive, XMind-style mind maps based on [@xiangfa/mindmap](https://www.npmjs.com/package/@xiangfa/mindmap), with two rendering paths and **zero runtime CDN**.

## Two rendering paths

**Previews (inside PRD documents)** — pure functions, no React. Reuses the
framework-free core of the library (`parseMarkdownWithFrontMatter` →
`layoutMultiRoot` → `buildExportSVG`) vendored under `./vendor/esm`. Each card
renders in ~0.1 ms, so a document full of mind maps paints instantly. See
`preview.js`. (The LaTeX plugin is skipped — it imports React; the other six
plugins are pure.)

**Editor (the drawer)** — interactive canvas editing via the library's React
`MindMap` component, running in an isolated iframe (`editor.html`). The whole
React 19 + react-dom + mindmap stack is bundled ahead-of-time into a single
local file (`vendor/mindmap-react.bundle.mjs`) by esbuild, so there is no
runtime CDN, no import map, no network dependency. The parent portal never
imports React — it only exchanges `postMessage` with the iframe.

### Editor interactions

- **Double-click** a node to edit its text
- **Enter** adds a sibling, **Tab** adds a child (XMind convention; the
  library defaults Enter to "child", so `editor-app.js` captures keydown and
  rewrites Enter/Tab via `getData`/`setData`)
- **Delete / Backspace** removes the selected node
- Drag to reorder siblings; wheel / pinch to zoom; right-click for menu
- Built-in toolbar (zoom, text-mode, fullscreen) at the bottom corners

Shared pages are read-only: preview cards render as static SVG and never open
the editor.

## Rebuilding the bundle

The bundle is checked in (`vendor/mindmap-react.bundle.mjs`), so normal use
needs no build. To rebuild after upgrading React or the mindmap library:

```bash
npm install                # installs devDependencies (esbuild, react, @xiangfa/mindmap, …)
npm run mindmap:bundle     # esbuild → vendor/mindmap-react.bundle.mjs
```

`bundle-entry.js` is the build entry; mindmap `style.css` is copied to
`vendor/style.css`.

## Module boundaries

- `index.js` — controller. Owns the editor iframe lifecycle + `postMessage`
  protocol, and the SVG preview cards. Mirrors the DrawioModule surface.
- `manager.js` — document state + `/api/mindmap-diagram`. Documents are
  Markdown nested lists stored as `.mindmap` under `docs/mindmaps/`.
- `preview.js` — pure Markdown→SVG renderer (previews).
- `editor.html` + `editor-app.js` — the isolated React editor host + XMind
  keyboard adapter.
- `vendor/` — `esm/` (pure core for previews), `mindmap-react.bundle.mjs`
  (React editor), `style.css`.
- `mindmap.css` — drawer chrome (`is-mindmap-mode`) + self-contained
  `.prd-mindmap-card` styling. Does not depend on prd.css.

## Replacing the renderer

Everything mindmap-specific is isolated. For previews: `preview.js` +
`vendor/esm`. For the editor: `editor.html` + `editor-app.js` +
`vendor/mindmap-react.bundle.mjs`. The manager, the controller, and the shell
wiring are inert to that choice.
