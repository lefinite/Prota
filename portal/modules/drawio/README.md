# Draw.io module

This module integrates the upstream [jgraph/drawio](https://github.com/jgraph/drawio) editor through its official JSON embed protocol.

## Runtime and theme boundary

- `editor.html` is a same-origin host for the pinned draw.io `v30.2.5` web runtime. Runtime assets are loaded from jsDelivr's immutable GitHub release URL.
- `editor-prota.css` is the isolated Prota visual theme. It only changes editor chrome: menus, buttons, sidebars, inspectors, dialogs, floating windows, tooltips, controls, and page tabs.
- `editor-prota.js` keeps the theme stylesheet after draw.io's dynamically injected runtime styles so late-loaded UI cannot silently revert to the upstream appearance.
- Diagram rendering, shape styles, canvas colors, connectors, and `.drawio` document content are deliberately untouched.
- Keeping the runtime and theme separate lets draw.io remain independently replaceable while allowing Prota to control the complete editor UI.

The visual direction is deliberately lightweight: generous horizontal spacing, low-contrast boundaries, flat control groups, restrained shadows, and a single solid accent reserved for primary actions. The theme also covers secondary surfaces that are easy to miss, including context menus, template/library pickers, property tables, comments, notifications, tooltips, drag states, rulers, page navigation, and compact-width behavior.

Boundaries:

- `index.js` owns editor lifecycle, postMessage protocol, toolbar actions, and read-only presentation.
- `manager.js` owns diagram state and the Bridge API.
- `drawio.css` owns the outer Prota document-panel styling.
- `editor-prota.css` owns the internal draw.io application chrome.
- Diagram assets are standard editable XML under `src/pages/{project}/{page}/docs/diagrams/`.
- The Shell operation row is removed in diagram mode. File switching, panel maximization, and browser-native fullscreen are injected into draw.io's own top bar, while draw.io keeps its native save and zoom controls.
- When a diagram directory contains multiple `.drawio` files, the top-bar selector switches between them. Editable sessions save the current file before switching; shared sessions remain read-only.
- The module does not depend on PRD internals; the shell only selects which document module is active.

Run `npm run drawio:theme-check` after changing the editor integration or either theme file. The audit verifies required UI-surface coverage and fails if the Prota theme crosses into graph/canvas rendering.
